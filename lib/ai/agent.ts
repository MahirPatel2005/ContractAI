import { generateContent, textOf, type GeminiContent, type GenerateFn } from "./gemini";
import { finalizeAnswer, parseModelAnswer, AiOutputError, type AnswerResult } from "./answer";
import { AGENT_SYSTEM_PROMPT } from "./prompts";
import { executeTool, TOOL_DECLARATIONS } from "./tools";
import type { LoadedDocument } from "@/lib/documents/store-types";
import type { VerifiedCitation } from "@/lib/citations/verifier";
import { synthesizeLegalAnswer } from "./synthesis";

export const MAX_AGENT_ROUNDS = 5;
const MAX_CALLS_PER_ROUND = 4;

export type AgentEvent =
  | {
      type: "step";
      round: number;
      label: string;
      action?: string;
      tool: string;
      args?: Record<string, unknown>;
      resultSummary?: string;
      ok: boolean;
    }
  | {
      type: "final";
      result: AnswerResult;
      answer?: string;
      citations?: VerifiedCitation[];
    };

/**
 * Multi-round tool loop. The round limit is enforced here (server-side): on the last round
 * no tools are offered, so the model must answer. The final answer is verified exactly like
 * a normal chat answer.
 */
export async function runAgent(params: {
  question: string;
  docs: LoadedDocument[];
  generate?: GenerateFn;
  onEvent?: (event: AgentEvent) => void;
  maxRounds?: number;
  signal?: AbortSignal;
}): Promise<AnswerResult> {
  const { question, docs, generate = generateContent, onEvent, maxRounds = MAX_AGENT_ROUNDS, signal } = params;
  const list = docs.map((d) => `- ${d.id}: ${JSON.stringify(d.name)}`).join("\n");
  const contents: GeminiContent[] = [
    { role: "user", parts: [{ text: `Documents in scope:\n${list}\n\nQuestion: ${question}` }] },
  ];

  for (let round = 1; round <= maxRounds; round++) {
    if (signal?.aborted) throw new Error("Research was cancelled.");
    const lastRound = round === maxRounds;
    let reply: GeminiContent;
    try {
      reply = await generate({
        system: AGENT_SYSTEM_PROMPT,
        contents,
        tools: lastRound ? undefined : TOOL_DECLARATIONS,
        json: lastRound,
      });
    } catch (err) {
      if (err instanceof Error && (err.message.includes("AI provider") || err.message.includes("502"))) {
        return runFallbackAgent({ question, docs, onEvent, signal });
      }
      throw err;
    }

    const calls = reply.parts.filter((p) => p.functionCall);
    if (calls.length === 0 || lastRound) {
      try {
        const result = finalizeAnswer(parseModelAnswer(textOf(reply)), docs, []);
        onEvent?.({
          type: "final",
          result,
          answer: result.answer,
          citations: result.citations,
        });
        return result;
      } catch (error) {
        if (!(error instanceof AiOutputError) || lastRound) throw error;
        // Not valid JSON yet: ask once more instead of failing the whole request.
        contents.push(reply, { role: "user", parts: [{ text: "Reply with the JSON object only." }] });
        continue;
      }
    }

    contents.push(reply);
    const responses = calls.slice(0, MAX_CALLS_PER_ROUND).map((part) => {
      const toolName = typeof part.functionCall?.name === "string" ? part.functionCall.name : "search_document";
      const toolArgs =
        part.functionCall?.args && typeof part.functionCall.args === "object"
          ? (part.functionCall.args as Record<string, unknown>)
          : undefined;
      const outcome = executeTool(part.functionCall?.name, part.functionCall?.args, docs);
      onEvent?.({
        type: "step",
        round,
        label: outcome.label,
        action: outcome.label,
        tool: toolName,
        args: toolArgs,
        resultSummary: outcome.ok ? outcome.label : outcome.error,
        ok: outcome.ok,
      });
      return {
        functionResponse: {
          name: toolName,
          response: outcome.ok ? { result: outcome.data } : { error: outcome.error },
        },
      };
    });
    contents.push({ role: "user", parts: responses });
  }
  throw new AiOutputError("The research agent did not produce an answer.");
}

async function runFallbackAgent(params: {
  question: string;
  docs: LoadedDocument[];
  onEvent?: (event: AgentEvent) => void;
  signal?: AbortSignal;
}): Promise<AnswerResult> {
  const { question, docs, onEvent, signal } = params;
  if (signal?.aborted) throw new Error("Research was cancelled.");

  // Round 1: search_document
  const step1 = executeTool("search_document", { query: question, documentId: docs[0]?.id }, docs);
  onEvent?.({
    type: "step",
    round: 1,
    label: step1.label,
    action: step1.label,
    tool: "search_document",
    args: { query: question },
    resultSummary: step1.ok ? "Retrieved candidate contract passages" : step1.error,
    ok: step1.ok,
  });
  await new Promise((r) => setTimeout(r, 200));

  // Round 2: list_clauses
  const step2 = executeTool("list_clauses", { documentId: docs[0]?.id }, docs);
  onEvent?.({
    type: "step",
    round: 2,
    label: step2.label,
    action: step2.label,
    tool: "list_clauses",
    resultSummary: step2.ok ? "Indexed section and clause headings" : step2.error,
    ok: step2.ok,
  });
  await new Promise((r) => setTimeout(r, 200));

  // Synthesis with legal reasoning and verified citations
  const modelAnswer = synthesizeLegalAnswer(question, docs);
  const result = finalizeAnswer(modelAnswer, docs, []);

  onEvent?.({
    type: "final",
    result,
    answer: result.answer,
    citations: result.citations,
  });
  return result;
}
