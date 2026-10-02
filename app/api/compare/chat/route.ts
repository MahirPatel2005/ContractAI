import type { NextRequest } from "next/server";
import { z } from "zod";
import { compareContracts } from "@/lib/comparison/compare";
import { loadDocuments } from "@/lib/documents/store";
import { fail, handleError, ok } from "@/lib/http";
import { clientKey, isRateLimited } from "@/lib/rateLimit";
import { retrieveChunks } from "@/lib/retrieval/keyword";
import { verifyQuote, type VerifiedCitation } from "@/lib/citations/verifier";
import { generateContent, textOf } from "@/lib/ai/gemini";
import { parseModelAnswer, type ModelAnswer } from "@/lib/ai/answer";

export const runtime = "nodejs";
export const maxDuration = 60;

const Body = z.object({
  leftDocumentId: z.string().min(1).max(64),
  rightDocumentId: z.string().min(1).max(64),
  question: z.string().trim().min(2).max(1000),
});

export async function POST(req: NextRequest) {
  try {
    if (isRateLimited(`cmp-chat:${clientKey(req)}`, 15)) {
      return fail("RATE_LIMITED", "Too many comparison questions. Please wait a moment.", 429);
    }

    const { leftDocumentId, rightDocumentId, question } = Body.parse(await req.json());
    if (leftDocumentId === rightDocumentId) {
      return fail("INVALID_INPUT", "Select two different documents to compare.", 400);
    }

    const docs = await loadDocuments([leftDocumentId, rightDocumentId]);
    const docLeft = docs.find((d) => d.id === leftDocumentId);
    const docRight = docs.find((d) => d.id === rightDocumentId);

    if (!docLeft || !docRight) {
      return fail("NOT_FOUND", "One or both documents not found.", 404);
    }

    // 1. Get structured comparison report
    const report = compareContracts(docLeft, docRight);

    // 2. Retrieve relevant chunks from both
    const { chunks } = retrieveChunks([docLeft, docRight], question, 4);

    const hasGemini = Boolean(process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY.trim() !== "");

    let modelAnswer: ModelAnswer;

    if (hasGemini) {
      try {
        const prompt = `You are a contract comparison legal assistant.
Analyze the differences between the two contract versions regarding the user's question.

QUESTION: "${question}"

COMPARISON SUMMARY:
Total clauses: ${report.summary.totalSections}, Modified: ${report.summary.modifiedCount}, High impact: ${report.summary.highSignificanceCount}

DOCUMENT EVIDENCE:
${chunks.map((c) => `[Document ${c.documentId}]: ${c.text.slice(0, 800)}`).join("\n\n")}

RULES:
1. Explain how Version 1 and Version 2 differ regarding the question.
2. Explain the legal/business impact and which party benefits.
3. Every citation quote MUST be verbatim text from the respective document.
4. Output valid JSON matching schema: {"answer": string, "insufficientEvidence": boolean, "citations": [{"documentId": string, "quote": string}]}`;

        const reply = await generateContent({
          system: "You are a professional legal comparison assistant. Output valid JSON only.",
          contents: [{ role: "user", parts: [{ text: prompt }] }],
          json: true,
        });

        modelAnswer = parseModelAnswer(textOf(reply));
      } catch {
        modelAnswer = generateComparativeFallback(question, report, docLeft, docRight, chunks);
      }
    } else {
      modelAnswer = generateComparativeFallback(question, report, docLeft, docRight, chunks);
    }

    // 3. Verify all candidate quotes independently against their respective documents
    const verifiedCitations: VerifiedCitation[] = [];
    const docMap = new Map(docs.map((d) => [d.id, d]));

    for (const cand of modelAnswer.citations) {
      const doc = docMap.get(cand.documentId);
      if (doc) {
        const result = verifyQuote(doc, cand.quote);
        if (result.verified) {
          verifiedCitations.push(result.citation);
        }
      }
    }

    return ok({
      answer: modelAnswer.answer,
      insufficientEvidence: modelAnswer.insufficientEvidence,
      citations: verifiedCitations,
      leftDocumentName: docLeft.name,
      rightDocumentName: docRight.name,
      summary: report.summary,
    });
  } catch (error) {
    return handleError(error, "comparison_chat");
  }
}

function generateComparativeFallback(
  question: string,
  report: ReturnType<typeof compareContracts>,
  docLeft: { id: string; name: string; fullText: string },
  docRight: { id: string; name: string; fullText: string },
  chunks: Array<{ text: string; documentId: string }>
): ModelAnswer {
  const citations: Array<{ documentId: string; quote: string }> = [];

  // Find relevant modified sections
  const relevantSections = report.sections.filter(
    (s) =>
      s.status === "modified" &&
      (s.title.toLowerCase().includes(question.toLowerCase()) ||
        s.explanation.toLowerCase().includes(question.toLowerCase()) ||
        s.detectedChanges.length > 0)
  );

  const topSection = relevantSections[0] || report.sections.find((s) => s.status === "modified") || report.sections[0];

  let answerText = `Comparative analysis regarding "${question}":\n\n`;

  if (topSection && topSection.leftText && topSection.rightText) {
    answerText += `In ${topSection.title}:\n`;
    answerText += `• In ${docLeft.name} (Previous): ${topSection.detectedChanges[0] || "Original terms were in effect."}\n`;
    answerText += `• In ${docRight.name} (Revised): ${topSection.explanation}\n\n`;
    answerText += `Legal Impact: ${topSection.significance.toUpperCase()} impact on contract obligations.`;

    const leftSentences = topSection.leftText.split(/(?<=[.!?])\s+/).filter((s) => s.length >= 25);
    const rightSentences = topSection.rightText.split(/(?<=[.!?])\s+/).filter((s) => s.length >= 25);

    if (leftSentences[0]) citations.push({ documentId: docLeft.id, quote: leftSentences[0] });
    if (rightSentences[0]) citations.push({ documentId: docRight.id, quote: rightSentences[0] });
  } else {
    answerText += `Compared ${docLeft.name} and ${docRight.name}. Across ${report.summary.totalSections} clauses analyzed, ${report.summary.modifiedCount} clauses were modified with ${report.summary.highSignificanceCount} high-significance changes.`;
  }

  return {
    answer: answerText,
    insufficientEvidence: false,
    citations,
  };
}
