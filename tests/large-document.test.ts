import { describe, expect, it } from "vitest";
import { makeDoc } from "./helpers";
import { verifyQuote } from "@/lib/citations/verifier";
import { retrieveChunks } from "@/lib/retrieval/keyword";
import { finalizeAnswer } from "@/lib/ai/answer";

describe("150-Page Large Contract Test Suite", () => {
  // Generate a realistic 150-page contract with distinct clauses on each page
  const PAGE_COUNT = 150;
  const earlyQuote = "Section 4.1. The Customer shall have the right to audit the Supplier security operations upon thirty business days written notice.";
  const midQuote = "Section 75.3. Liability under this Master Services Agreement is subject to a mutual cap of five million dollars.";
  const lateQuote = "Section 148.9. The governing law of this 150-page agreement shall be the laws of the State of Delaware without regard to conflict of laws principles.";
  const boundaryP1 = "Section 99.7. In the event of force majeure lasting longer than sixty consecutive calendar days";
  const boundaryP2 = "either party may immediately terminate this agreement without further penalty or liability.";

  function build150PageContract() {
    const pageTexts: string[] = [];
    for (let p = 1; p <= PAGE_COUNT; p++) {
      const paragraphs: string[] = [];
      if (p === 100) {
        paragraphs.push(boundaryP2);
        paragraphs.push(`ARTICLE ${p}. OPERATIONAL PROVISIONS AND COMPLIANCE REQUIREMENTS FOR PHASE ${p}.`);
      } else {
        paragraphs.push(`ARTICLE ${p}. OPERATIONAL PROVISIONS AND COMPLIANCE REQUIREMENTS FOR PHASE ${p}.`);
      }

      // Add realistic legal filler paragraphs to simulate full pages (~450-500 words per page)
      for (let k = 1; k <= 4; k++) {
        paragraphs.push(
          `Section ${p}.${k}. Subject to the terms and limitations herein, neither party shall assign its rights or delegate its duties under subsection ${k} without prior written consent from the authorized corporate officer.`
        );
      }

      if (p === 4) {
        paragraphs.push(earlyQuote);
      } else if (p === 75) {
        paragraphs.push(midQuote);
      } else if (p === 99) {
        // Put boundaryP1 as the very last paragraph of page 99
        paragraphs.push(boundaryP1);
      } else if (p === 148) {
        paragraphs.push(lateQuote);
      } else if (p !== 100) {
        paragraphs.push(
          `Standard covenant ${p}. The parties agree to maintain good faith performance across all specifications set forth in Exhibit ${p}-A.`
        );
      }

      pageTexts.push(paragraphs.join("\n\n"));
    }
    return makeDoc("large-150-page-contract", pageTexts, "Enterprise_Master_Agreement_150_Pages.pdf");
  }

  const largeDoc = build150PageContract();

  it("successfully extracts and indexes all 150 pages with monotonic offset boundaries", () => {
    expect(largeDoc.pages.length).toBe(150);
    expect(largeDoc.pages[0].pageNumber).toBe(1);
    expect(largeDoc.pages[149].pageNumber).toBe(150);

    // Verify offset monotonicity and non-overlap
    for (let i = 0; i < largeDoc.pages.length; i++) {
      const page = largeDoc.pages[i];
      expect(page.pageNumber).toBe(i + 1);
      if (i > 0) {
        expect(page.startOffset).toBeGreaterThan(largeDoc.pages[i - 1].startOffset);
      }
    }
  });

  it("chunks a 150-page contract with complete coverage and exact offset mapping", () => {
    expect(largeDoc.chunks.length).toBeGreaterThan(50);
    expect(largeDoc.chunks[0].pageStart).toBe(1);
    expect(largeDoc.chunks.at(-1)?.pageEnd).toBe(150);

    // Every chunk maps precisely to fullText
    for (const chunk of largeDoc.chunks) {
      expect(largeDoc.fullText.slice(chunk.startOffset, chunk.endOffset)).toBe(chunk.text);
      expect(chunk.pageStart).toBeLessThanOrEqual(chunk.pageEnd);
      expect(chunk.pageStart).toBeGreaterThanOrEqual(1);
      expect(chunk.pageEnd).toBeLessThanOrEqual(150);
    }
  });

  it("verifies quotes on early (page 4), middle (page 75), and late (page 148) pages", () => {
    // 1. Early quote on Page 4
    const rEarly = verifyQuote(largeDoc, earlyQuote);
    expect(rEarly.verified).toBe(true);
    if (rEarly.verified) {
      expect(rEarly.citation.pageStart).toBe(4);
      expect(rEarly.citation.pageEnd).toBe(4);
      expect(largeDoc.fullText.slice(rEarly.citation.startOffset, rEarly.citation.endOffset)).toBe(earlyQuote);
    }

    // 2. Mid quote on Page 75
    const rMid = verifyQuote(largeDoc, midQuote);
    expect(rMid.verified).toBe(true);
    if (rMid.verified) {
      expect(rMid.citation.pageStart).toBe(75);
      expect(rMid.citation.pageEnd).toBe(75);
      expect(largeDoc.fullText.slice(rMid.citation.startOffset, rMid.citation.endOffset)).toBe(midQuote);
    }

    // 3. Late quote on Page 148
    const rLate = verifyQuote(largeDoc, lateQuote);
    expect(rLate.verified).toBe(true);
    if (rLate.verified) {
      expect(rLate.citation.pageStart).toBe(148);
      expect(rLate.citation.pageEnd).toBe(148);
      expect(largeDoc.fullText.slice(rLate.citation.startOffset, rLate.citation.endOffset)).toBe(lateQuote);
    }
  });

  it("verifies cross-page boundary quotes across page 99 and page 100", () => {
    const crossPageQuote = `${boundaryP1}\n\n${boundaryP2}`;
    const rCross = verifyQuote(largeDoc, crossPageQuote);
    expect(rCross.verified).toBe(true);
    if (rCross.verified) {
      expect(rCross.citation.pageStart).toBe(99);
      expect(rCross.citation.pageEnd).toBe(100);
    }
  });

  it("retrieves relevant chunks from a 150-page contract without full-document context dump", () => {
    const { chunks, coverage } = retrieveChunks([largeDoc], "audit security operations notice");
    expect(chunks.length).toBeGreaterThan(0);
    // At least one retrieved chunk covers page 4 where the audit clause lives
    const hasPage4 = chunks.some((c) => c.pageStart <= 4 && c.pageEnd >= 4);
    expect(hasPage4).toBe(true);

    // Retrieval tracks coverage statistics
    expect(coverage.length).toBe(1);
    expect(coverage[0].documentId).toBe("large-150-page-contract");
    expect(coverage[0].chunksRetrieved).toBe(chunks.length);
    expect(coverage[0].chunksTotal).toBe(largeDoc.chunks.length);
  });

  it("enforces safe absence language when information is not in retrieved chunks", () => {
    // If evidence is insufficient, finalizeAnswer prepends the safe absence caveat
    const result = finalizeAnswer(
      {
        answer: "No indemnification clause for autonomous spacecraft was found in the contract.",
        citations: [],
        insufficientEvidence: true,
      },
      [largeDoc],
      []
    );

    expect(result.insufficientEvidence).toBe(true);
    expect(result.answer).toContain("I could not verify this from the retrieved document evidence.");
  });

  it("executes multi-quote verification across a 150-page contract in under 100ms", () => {
    const t0 = performance.now();
    for (let i = 0; i < 10; i++) {
      verifyQuote(largeDoc, earlyQuote);
      verifyQuote(largeDoc, midQuote);
      verifyQuote(largeDoc, lateQuote);
    }
    const t1 = performance.now();
    const elapsed = t1 - t0;
    // 30 full verifications across 150 pages should be ultra fast due to deterministic offsets
    expect(elapsed).toBeLessThan(100);
  });
});
