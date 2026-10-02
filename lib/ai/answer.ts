import { z } from "zod";
import { verifyQuote, type OffsetRange, type VerifiedCitation } from "@/lib/citations/verifier";
import type { LoadedDocument } from "@/lib/documents/store-types";
import { retrieveChunks, type RetrievalCoverage } from "@/lib/retrieval/keyword";
import { generateContent, textOf, type GenerateFn } from "./gemini";
import { ANSWER_SYSTEM_PROMPT, buildAnswerPrompt, buildEvidence } from "./prompts";
import { synthesizeLegalAnswer } from "./synthesis";

export const INSUFFICIENT_PREFIX = "I could not verify this from the retrieved document evidence.";

export class AiOutputError extends Error {}

const ModelAnswerSchema = z.object({
  answer: z.string().min(1).max(8000),
  insufficientEvidence: z.boolean().default(false),
  citations: z.array(z.object({ documentId: z.string(), quote: z.string().min(1).max(2000) })).max(20).default([]),
});
export type ModelAnswer = z.infer<typeof ModelAnswerSchema>;

export interface AnswerResult {
  answer: string;
  insufficientEvidence: boolean;
  /** Only citations that application code located in stored document text. */
  citations: VerifiedCitation[];
  rejectedCitationCount: number;
  /** True when no claim in the answer is backed by a verified quote. The UI must flag this. */
  unverified: boolean;
  coverage: RetrievalCoverage[];
}

export function parseModelAnswer(raw: string): ModelAnswer {
  const cleaned = raw.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
  let json: unknown;
  try {
    json = JSON.parse(cleaned);
  } catch {
    throw new AiOutputError("The AI returned an answer in an unexpected format.");
  }
  const parsed = ModelAnswerSchema.safeParse(json);
  if (!parsed.success) throw new AiOutputError("The AI returned an answer in an unexpected format.");
  return parsed.data;
}

/** Every citation goes through the verifier, against its own document. Nothing is trusted. */
export function finalizeAnswer(
  parsed: ModelAnswer,
  docs: LoadedDocument[],
  coverage: RetrievalCoverage[],
  preferRanges: Map<string, OffsetRange[]> = new Map(),
): AnswerResult {
  const byId = new Map(docs.map((d) => [d.id, d]));
  const citations: VerifiedCitation[] = [];
  const seen = new Set<string>();
  let rejected = 0;

  for (const candidate of parsed.citations) {
    const doc = byId.get(candidate.documentId);
    const result = doc ? verifyQuote(doc, candidate.quote, { preferRanges: preferRanges.get(doc.id) }) : null;
    if (!result?.verified) {
      rejected++;
      continue;
    }
    const key = `${result.citation.documentId}:${result.citation.startOffset}:${result.citation.endOffset}`;
    if (!seen.has(key)) {
      seen.add(key);
      citations.push(result.citation);
    }
  }

  return {
    answer: parsed.insufficientEvidence ? `${INSUFFICIENT_PREFIX} ${parsed.answer}` : parsed.answer,
    insufficientEvidence: parsed.insufficientEvidence,
    citations,
    rejectedCitationCount: rejected,
    unverified: !parsed.insufficientEvidence && citations.length === 0,
    coverage,
  };
}

export async function answerQuestion(params: {
  question: string;
  docs: LoadedDocument[];
  generate?: GenerateFn;
}): Promise<AnswerResult> {
  const { question, docs, generate = generateContent } = params;
  const { chunks, coverage } = retrieveChunks(docs, question);

  const ranges = new Map<string, OffsetRange[]>();
  for (const c of chunks) {
    ranges.set(c.documentId, [...(ranges.get(c.documentId) ?? []), { start: c.startOffset, end: c.endOffset }]);
  }

  try {
    const reply = await generate({
      system: ANSWER_SYSTEM_PROMPT,
      contents: [{ role: "user", parts: [{ text: buildAnswerPrompt(question, docs, buildEvidence(docs, chunks)) }] }],
      json: true,
    });
    return finalizeAnswer(parseModelAnswer(textOf(reply)), docs, coverage, ranges);
  } catch (error) {
    const modelAnswer = synthesizeLegalAnswer(question, docs);
    return finalizeAnswer(modelAnswer, docs, coverage, ranges);
  }
}
