import { describe, expect, it } from "vitest";
import { verifyQuote } from "@/lib/citations/verifier";
import { finalizeAnswer } from "@/lib/ai/answer";
import { makeDoc } from "./helpers";

const CAP = "The aggregate liability of the parties shall not exceed $1,000,000.";

describe("verifyQuote", () => {
  it("verifies an exact quote and reports real offsets", () => {
    const doc = makeDoc("a", ["Intro text here.", `Clause 8. ${CAP} End.`]);
    const r = verifyQuote(doc, CAP);
    expect(r.verified).toBe(true);
    if (!r.verified) return;
    expect(doc.fullText.slice(r.citation.startOffset, r.citation.endOffset)).toBe(CAP);
    expect(r.citation.pageStart).toBe(2);
  });

  it("tolerates whitespace, case and curly-quote differences", () => {
    const doc = makeDoc("a", ["The Supplier’s   obligations\n\tsurvive termination of this Agreement."]);
    const r = verifyQuote(doc, "the supplier's obligations survive termination of this agreement.");
    expect(r.verified).toBe(true);
  });

  it("verifies a multi-line quote and returns the original text span", () => {
    const doc = makeDoc("a", ["The liability\nof the parties\nshall not exceed\n$1,000,000."]);
    const r = verifyQuote(doc, "The liability of the parties shall not exceed $1,000,000.");
    expect(r.verified).toBe(true);
    if (r.verified) expect(r.citation.quote).toBe("The liability of the parties shall not exceed $1,000,000.");
  });

  it("rejects a quote that is not in the document", () => {
    const doc = makeDoc("a", [CAP]);
    expect(verifyQuote(doc, "Either party may terminate on thirty days notice.")).toEqual({ verified: false, reason: "not_found" });
  });

  it("rejects fragments too short to prove anything", () => {
    const doc = makeDoc("a", [CAP]);
    expect(verifyQuote(doc, "shall")).toEqual({ verified: false, reason: "too_short" });
  });

  it("verifies a quote that crosses a page boundary", () => {
    const doc = makeDoc("a", ["…the parties agree that the total liability", "shall not exceed the fees paid in the prior year."]);
    const r = verifyQuote(doc, "the total liability shall not exceed the fees paid");
    expect(r.verified).toBe(true);
    if (r.verified) {
      expect(r.citation.pageStart).toBe(1);
      expect(r.citation.pageEnd).toBe(2);
    }
  });

  it("reports repeated quotes and picks the occurrence inside the preferred range", () => {
    const repeated = "Payment is due within thirty days of invoice.";
    const doc = makeDoc("a", [repeated, "filler ".repeat(20), repeated]);
    const first = verifyQuote(doc, repeated);
    const lastStart = doc.fullText.lastIndexOf(repeated);
    const preferred = verifyQuote(doc, repeated, { preferRanges: [{ start: lastStart - 5, end: lastStart + 60 }] });
    expect(first.verified && first.citation.occurrences).toBe(2);
    expect(first.verified && first.citation.pageStart).toBe(1);
    expect(preferred.verified && preferred.citation.startOffset).toBe(lastStart);
    expect(preferred.verified && preferred.citation.pageStart).toBe(3);
  });
});

describe("finalizeAnswer (multi-document)", () => {
  const a = makeDoc("doc-a", [CAP]);
  const b = makeDoc("doc-b", ["Liability is capped at the total fees paid in the preceding twelve months."]);

  it("verifies each citation against its own document and drops mismatches", () => {
    const result = finalizeAnswer(
      {
        answer: "A caps at $1M; B caps at fees paid.",
        insufficientEvidence: false,
        citations: [
          { documentId: "doc-a", quote: CAP },
          { documentId: "doc-b", quote: "capped at the total fees paid in the preceding twelve months" },
          { documentId: "doc-b", quote: CAP }, // real text, but from the other document
          { documentId: "doc-zzz", quote: CAP }, // document not in scope
        ],
      },
      [a, b],
      [],
    );
    expect(result.citations.map((c) => c.documentId)).toEqual(["doc-a", "doc-b"]);
    expect(result.rejectedCitationCount).toBe(2);
    expect(result.unverified).toBe(false);
  });

  it("flags an answer with no verified citations and prefixes insufficient evidence", () => {
    const none = finalizeAnswer({ answer: "It is capped.", insufficientEvidence: false, citations: [{ documentId: "doc-a", quote: "invented text that is not present" }] }, [a], []);
    expect(none.unverified).toBe(true);
    const weak = finalizeAnswer({ answer: "Nothing found.", insufficientEvidence: true, citations: [] }, [a], []);
    expect(weak.answer.startsWith("I could not verify this from the retrieved document evidence.")).toBe(true);
  });
});
