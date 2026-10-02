import type { NextRequest } from "next/server";
import { z } from "zod";
import { compareContracts } from "@/lib/comparison/compare";
import { diffWords } from "@/lib/comparison/diff";
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

    const changedSections = report.sections.filter((s) => s.status !== "unchanged");

    // Augment chunks with text from changed sections so evidence is never empty
    const augmentedChunks = [...chunks];
    for (const sec of changedSections) {
      if (sec.leftText) {
        augmentedChunks.push({
          id: `sec-left-${sec.id}`,
          documentId: docLeft.id,
          pageStart: 1,
          pageEnd: 1,
          text: sec.leftText,
          score: 1.0,
          startOffset: 0,
          endOffset: sec.leftText.length,
        });
      }
      if (sec.rightText) {
        augmentedChunks.push({
          id: `sec-right-${sec.id}`,
          documentId: docRight.id,
          pageStart: 1,
          pageEnd: 1,
          text: sec.rightText,
          score: 1.0,
          startOffset: 0,
          endOffset: sec.rightText.length,
        });
      }
    }

    const hasGemini = Boolean(process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY.trim() !== "");

    let modelAnswer: ModelAnswer;

    if (hasGemini) {
      try {
        const diffSummaries = changedSections.map((sec) => {
          let changeDetail = "";
          if (sec.leftText && sec.rightText) {
            const diff = diffWords(sec.leftText, sec.rightText);
            const deleted = diff.leftTokens.filter((t) => t.op === "deleted").map((t) => t.text).join(" ").trim();
            const inserted = diff.rightTokens.filter((t) => t.op === "inserted").map((t) => t.text).join(" ").trim();
            if (deleted || inserted) {
              changeDetail = `\n  - Prior language (V1): "${deleted.slice(0, 300)}"\n  - Revised language (V2): "${inserted.slice(0, 300)}"`;
            }
          }
          return `Clause: "${sec.title}" [${sec.status.toUpperCase()}]
  - Impact: ${sec.explanation} (Favors: ${sec.favorsParty}, Risk: ${sec.riskLevel})${changeDetail}`;
        }).join("\n\n");

        const prompt = `You are an expert contract comparison and redline assistant.
Analyze the differences between the two contract versions regarding the user's question.

QUESTION: "${question}"

COMPARISON SUMMARY:
Total clauses: ${report.summary.totalSections}, Modified: ${report.summary.modifiedCount}, Added: ${report.summary.addedCount}, Deleted: ${report.summary.deletedCount}, High impact: ${report.summary.highSignificanceCount}

DETECTED CLAUSE DIFFERENCES:
${diffSummaries || "No differences detected between documents."}

DOCUMENT EVIDENCE (EXACT TEXT FROM CONTRACTS):
${augmentedChunks.slice(0, 6).map((c) => `[Document ${c.documentId}]:\n${c.text.slice(0, 1200)}`).join("\n\n")}

RULES:
1. Explain specifically how Version 1 and Version 2 differ, addressing the user's question. If the user asks generally what changed or has minor typos, explain the detected modified clauses clearly.
2. Clearly explain what language was removed/modified in Version 1, what was added in Version 2, and the legal/business significance (who benefits, risk level).
3. Every citation quote MUST be verbatim exact text from the respective document evidence.
4. Output valid JSON matching schema: {"answer": string, "insufficientEvidence": boolean, "citations": [{"documentId": string, "quote": string}]}`;

        const reply = await generateContent({
          system: "You are a professional legal comparison assistant. Output valid JSON only.",
          contents: [{ role: "user", parts: [{ text: prompt }] }],
          json: true,
        });

        modelAnswer = parseModelAnswer(textOf(reply));
      } catch {
        modelAnswer = generateComparativeFallback(question, report, docLeft, docRight, augmentedChunks);
      }
    } else {
      modelAnswer = generateComparativeFallback(question, report, docLeft, docRight, augmentedChunks);
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
  const changedSections = report.sections.filter((s) => s.status !== "unchanged");

  if (changedSections.length === 0) {
    return {
      answer: `Identical contract versions: Both ${docLeft.name} and ${docRight.name} contain identical clause language across all ${report.summary.totalSections} analyzed sections. No material changes or risk deviations were detected.`,
      insufficientEvidence: false,
      citations: [],
    };
  }

  let answerText = `### Contract Comparison Analysis\n\n`;
  answerText += `Across **${report.summary.totalSections} clauses** analyzed between **${docLeft.name}** (Version 1) and **${docRight.name}** (Version 2), **${report.summary.modifiedCount} clause(s)** have been modified.\n\n`;

  for (const sec of changedSections.slice(0, 3)) {
    answerText += `#### ${sec.title} (${sec.status.toUpperCase()})\n`;
    answerText += `• **Legal Risk:** ${sec.riskLevel} (${sec.significance} significance, favors ${sec.favorsParty})\n`;
    answerText += `• **Analysis:** ${sec.explanation}\n`;

    if (sec.leftText && sec.rightText) {
      const diff = diffWords(sec.leftText, sec.rightText);
      const del = diff.leftTokens.filter((t) => t.op === "deleted").map((t) => t.text).join(" ").trim();
      const ins = diff.rightTokens.filter((t) => t.op === "inserted").map((t) => t.text).join(" ").trim();
      if (del || ins) {
        if (del) answerText += `• **Removed in Version 1:** ~~"${del.slice(0, 160)}"~~\n`;
        if (ins) answerText += `• **Added in Version 2:** **"${ins.slice(0, 160)}"**\n`;
      }

      if (del && sec.leftText.includes(del)) {
        citations.push({ documentId: docLeft.id, quote: del });
      }
      if (ins && sec.rightText.includes(ins)) {
        citations.push({ documentId: docRight.id, quote: ins });
      }
    }
    answerText += "\n";
  }

  return {
    answer: answerText.trim(),
    insufficientEvidence: false,
    citations,
  };
}
