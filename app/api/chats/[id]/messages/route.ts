import type { NextRequest } from "next/server";
import { z } from "zod";
import { answerQuestion, finalizeAnswer, parseModelAnswer, INSUFFICIENT_PREFIX, type ModelAnswer } from "@/lib/ai/answer";
import { generateContent, textOf } from "@/lib/ai/gemini";
import { ANSWER_SYSTEM_PROMPT, buildAnswerPrompt, buildEvidence } from "@/lib/ai/prompts";
import { synthesizeLegalAnswer } from "@/lib/ai/synthesis";
import { registerChatAbort, unregisterChatAbort } from "@/lib/chat/cancellation";
import { loadDocuments } from "@/lib/documents/store";
import { fail, handleError } from "@/lib/http";
import { logger } from "@/lib/logger";
import { prisma } from "@/lib/prisma";
import { clientKey, isRateLimited } from "@/lib/rateLimit";
import { retrieveChunks } from "@/lib/retrieval/keyword";
import type { OffsetRange } from "@/lib/citations/verifier";

export const runtime = "nodejs";
export const maxDuration = 120;
type Ctx = { params: Promise<{ id: string }> };

const Body = z.object({
  question: z.string().trim().min(2).max(1000),
});

export async function POST(req: NextRequest, { params }: Ctx) {
  let chatId: string;
  let question: string;

  try {
    if (isRateLimited(`msg:${clientKey(req)}`, 10)) {
      return fail("RATE_LIMITED", "Too many messages. Wait a moment and try again.", 429);
    }
    const resolvedParams = await params;
    chatId = resolvedParams.id;
    const body = Body.parse(await req.json());
    question = body.question;
  } catch (error) {
    return handleError(error, "chat_message_validation");
  }

  const chat = await prisma.chat.findUnique({
    where: { id: chatId },
    include: { document: true },
  });

  if (!chat) return fail("NOT_FOUND", "Chat not found.", 404);
  if (chat.document.status !== "ready" || !chat.document.fullText) {
    return fail("NOT_READY", "This document is not ready yet.", 409);
  }

  // 1. Create the user message in DB
  const userMessage = await prisma.message.create({
    data: {
      chatId,
      role: "user",
      content: question,
    },
  });

  // 2. Create the placeholder assistant message in DB
  const assistantMessage = await prisma.message.create({
    data: {
      chatId,
      role: "assistant",
      content: "",
      cancelled: false,
    },
  });

  const abortController = registerChatAbort(chatId);
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      let accumulatedText = "";
      let isCancelled = false;

      const send = (data: Record<string, unknown>) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
      };

      const handleAbort = async () => {
        if (isCancelled) return;
        isCancelled = true;
        try {
          await prisma.message.update({
            where: { id: assistantMessage.id },
            data: { content: accumulatedText, cancelled: true },
          });
        } catch {
          // Ignore write failure on abort
        }
      };

      req.signal.addEventListener("abort", handleAbort);
      abortController.signal.addEventListener("abort", handleAbort);

      try {
        send({
          type: "start",
          userMessage: { id: userMessage.id, content: userMessage.content, createdAt: userMessage.createdAt },
          assistantMessageId: assistantMessage.id,
        });

        const docs = await loadDocuments([chat.documentId]);
        const doc = docs[0];
        const { chunks, coverage } = retrieveChunks(docs, question);

        const ranges = new Map<string, OffsetRange[]>();
        for (const c of chunks) {
          ranges.set(c.documentId, [...(ranges.get(c.documentId) ?? []), { start: c.startOffset, end: c.endOffset }]);
        }

        let parsed: ModelAnswer;

        // Check if Gemini is configured
        const hasGeminiKey = Boolean(process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY.trim() !== "");

        if (hasGeminiKey) {
          try {
            const reply = await generateContent({
              system: ANSWER_SYSTEM_PROMPT,
              contents: [{ role: "user", parts: [{ text: buildAnswerPrompt(question, docs, buildEvidence(docs, chunks)) }] }],
              json: true,
            });
            parsed = parseModelAnswer(textOf(reply));
          } catch (geminiError) {
            logger.info({ operation: "gemini_call", status: "fallback_synthesis", error: geminiError });
            parsed = synthesizeLegalAnswer(question, docs);
          }
        } else {
          // Intelligent legal reasoning fallback when no Gemini key is set
          parsed = synthesizeLegalAnswer(question, docs);
        }

        if (isCancelled || abortController.signal.aborted) {
          await handleAbort();
          return;
        }

        const final = finalizeAnswer(parsed, docs, coverage, ranges);

        // Stream answer text in chunks to provide typewriter effect
        const fullAnswer = final.answer;
        const words = fullAnswer.split(" ");
        for (let i = 0; i < words.length; i++) {
          if (isCancelled || abortController.signal.aborted) {
            await handleAbort();
            return;
          }
          const word = words[i] + (i < words.length - 1 ? " " : "");
          accumulatedText += word;
          send({ type: "token", text: word });
          // Micro delay for smooth reading experience
          await new Promise((r) => setTimeout(r, 20));
        }

        // Persist citations in Prisma
        const createdCitations = [];
        for (const cit of final.citations) {
          const record = await prisma.citation.create({
            data: {
              messageId: assistantMessage.id,
              documentId: cit.documentId,
              quote: cit.quote,
              pageNumber: cit.pageStart,
              startOffset: cit.startOffset,
              endOffset: cit.endOffset,
              verified: true,
            },
          });
          createdCitations.push({
            id: record.id,
            documentId: record.documentId,
            documentName: doc.name,
            quote: record.quote,
            pageNumber: record.pageNumber,
            pageStart: cit.pageStart,
            pageEnd: cit.pageEnd,
            startOffset: record.startOffset,
            endOffset: record.endOffset,
            occurrences: cit.occurrences,
            verified: true,
          });
        }

        // Update assistant message with completed text
        await prisma.message.update({
          where: { id: assistantMessage.id },
          data: {
            content: accumulatedText,
            cancelled: false,
          },
        });

        // Send citations and done event
        send({
          type: "done",
          messageId: assistantMessage.id,
          answer: accumulatedText,
          citations: createdCitations,
          unverified: final.unverified,
          insufficientEvidence: final.insufficientEvidence,
          rejectedCitationCount: final.rejectedCitationCount,
          coverage,
        });
      } catch (error) {
        logger.error({ operation: "chat_stream", error });
        if (!isCancelled) {
          send({
            type: "error",
            message: "We encountered an error generating the response. Please try again.",
          });
        }
      } finally {
        unregisterChatAbort(chatId);
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}

/**
 * Intelligent extractive answer generator for contracts when Gemini key is not yet set
 * or as reliable fallback. Finds direct quotes in retrieved chunks.
 */
function generateExtractiveAnswer(question: string, chunks: Array<{ text: string; documentId: string }>): ModelAnswer {
  if (chunks.length === 0) {
    return {
      answer: "No relevant contract clauses were found for your query.",
      insufficientEvidence: true,
      citations: [],
    };
  }

  // Find most relevant sentences/paragraphs
  const topChunk = chunks[0];
  const sentences = topChunk.text
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter((s) => s.length >= 25);

  const bestSentence = sentences[0] || topChunk.text.slice(0, 150);

  return {
    answer: `Based on the contract provisions retrieved regarding "${question}":\n\n${bestSentence}`,
    insufficientEvidence: false,
    citations: [
      {
        documentId: topChunk.documentId,
        quote: bestSentence,
      },
    ],
  };
}
