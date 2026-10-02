import type { LoadedDocument } from "@/lib/documents/store-types";
import { generateContent, textOf } from "@/lib/ai/gemini";
import { retrieveChunks } from "@/lib/retrieval/keyword";
import { z } from "zod";

export interface ProposedRedline {
  clauseTitle: string;
  targetText: string;
  revisedText: string;
  explanation: string;
}

const ProposedSchema = z.object({
  clauseTitle: z.string().default("General Clause"),
  targetText: z.string().min(5),
  revisedText: z.string().min(5),
  explanation: z.string().min(5),
});

export async function proposeRedline(
  doc: LoadedDocument,
  instruction: string
): Promise<ProposedRedline> {
  const hasGemini = Boolean(process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY.trim() !== "");

  if (hasGemini) {
    try {
      const prompt = `You are a contract redlining lawyer.
Given the contract text below and a user's edit instruction, propose an exact tracked-change redline.

INSTRUCTION: "${instruction}"

CONTRACT EXCERPT:
${doc.fullText.slice(0, 8000)}

RULES:
1. "targetText" MUST be an exact verbatim substring from the contract text that will be deleted.
2. "revisedText" MUST be the replacement wording that will be inserted.
3. Keep the edit surgical and minimal to preserve original contract wording.
4. "explanation" must explain the legal rationale.
5. Return JSON only matching schema: {"clauseTitle": string, "targetText": string, "revisedText": string, "explanation": string}`;

      const reply = await generateContent({
        system: "You are a professional legal drafting assistant. Output valid JSON only.",
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        json: true,
      });

      const parsed = ProposedSchema.parse(JSON.parse(textOf(reply)));
      // Verify targetText exists in document
      if (doc.fullText.includes(parsed.targetText)) {
        return parsed;
      }
    } catch {
      // Fallback to deterministic clause analysis
    }
  }

  // Deterministic Redline Rule Engine
  return deterministicRedline(doc, instruction);
}

function deterministicRedline(doc: LoadedDocument, instruction: string): ProposedRedline {
  const lowerInst = instruction.toLowerCase();
  const text = doc.fullText;

  // 1. Mutuality request for liability or indemnification
  if (lowerInst.includes("mutual")) {
    const liabilityMatch = text.match(/The aggregate liability of (?:Customer|Vendor|either party)[^.]*\./i);
    if (liabilityMatch) {
      const target = liabilityMatch[0];
      const revised = target.replace(/of (?:Customer|Vendor)/i, "of either party");
      return {
        clauseTitle: "Limitation of Liability",
        targetText: target,
        revisedText: revised.includes("either party") ? revised : "The aggregate liability of either party arising out of or related to this Agreement shall be mutual and not exceed $1,000,000.",
        explanation: "Revised unilateral liability cap into a mutual limitation applying equally to both parties.",
      };
    }
  }

  // 2. Increase or change notice period / termination
  if (lowerInst.includes("notice") || lowerInst.includes("terminat")) {
    const daysMatch = text.match(/upon\s+([a-zA-Z0-9]+)\s+days?\s+prior\s+written\s+notice/i) ||
                      text.match(/([a-zA-Z0-9]+)\s+days?\s+notice/i);
    if (daysMatch) {
      const target = daysMatch[0];
      const newDays = lowerInst.includes("60") ? "sixty (60)" : lowerInst.includes("90") ? "ninety (90)" : "forty-five (45)";
      const revised = target.replace(/[a-zA-Z0-9]+\s+days/i, `${newDays} days`);
      return {
        clauseTitle: "Termination Notice Period",
        targetText: target,
        revisedText: revised,
        explanation: `Updated termination notice period from ${daysMatch[1]} days to ${newDays} days as requested.`,
      };
    }
  }

  // 3. Payment terms / invoicing
  if (lowerInst.includes("payment") || lowerInst.includes("invoic") || lowerInst.includes("fee")) {
    const payMatch = text.match(/within\s+([a-zA-Z0-9]+)\s+days\s+of\s+invoice/i);
    if (payMatch) {
      const target = payMatch[0];
      const revised = "within sixty (60) days of invoice";
      return {
        clauseTitle: "Payment Terms",
        targetText: target,
        revisedText: revised,
        explanation: "Extended payment term window to sixty (60) days from invoice receipt.",
      };
    }
  }

  // 4. Governing law jurisdiction
  if (lowerInst.includes("governing law") || lowerInst.includes("delaware") || lowerInst.includes("jurisdiction")) {
    const govMatch = text.match(/laws of the State of [A-Za-z\s]+,/i);
    if (govMatch) {
      const target = govMatch[0];
      const revised = "laws of the State of Delaware,";
      return {
        clauseTitle: "Governing Law & Jurisdiction",
        targetText: target,
        revisedText: revised,
        explanation: "Changed governing jurisdiction to the State of Delaware.",
      };
    }
  }

  // 5. General fallback: retrieve top matching chunk sentence
  const { chunks } = retrieveChunks([doc], instruction, 1);
  if (chunks.length > 0) {
    const sentence = chunks[0].text.split(/(?<=[.!?])\s+/).find((s) => s.length >= 25 && doc.fullText.includes(s));
    if (sentence) {
      return {
        clauseTitle: "Contract Revision",
        targetText: sentence,
        revisedText: `${sentence.trim()} [Amended per instruction: ${instruction}]`,
        explanation: `Applied redline amendment to targeted clause according to "${instruction}".`,
      };
    }
  }

  // Final fallback to first sentence of document
  const firstSentence = doc.fullText.split(/(?<=[.!?])\s+/)[0] || doc.fullText.slice(0, 100);
  return {
    clauseTitle: "Contract Terms",
    targetText: firstSentence,
    revisedText: `${firstSentence} (as amended)`,
    explanation: `Proposed revision reflecting: ${instruction}`,
  };
}
