import { describe, expect, it } from "vitest";
import { makeDoc } from "./helpers";

describe("chunkDocument", () => {
  it("keeps exact offsets and page ranges for a long document", () => {
    const page = (n: number) => Array.from({ length: 12 }, (_, i) => `Clause ${n}.${i} ${"lorem ipsum dolor sit amet ".repeat(12)}`).join("\n\n");
    const doc = makeDoc("big", Array.from({ length: 40 }, (_, i) => page(i + 1)));
    expect(doc.chunks.length).toBeGreaterThan(20);
    for (const c of doc.chunks) {
      expect(doc.fullText.slice(c.startOffset, c.endOffset)).toBe(c.text);
      expect(c.pageStart).toBeLessThanOrEqual(c.pageEnd);
      expect(c.text.length).toBeLessThanOrEqual(2800);
    }
    // Chunks cover the whole text with overlap and no gaps.
    for (let i = 1; i < doc.chunks.length; i++) {
      expect(doc.chunks[i].startOffset).toBeLessThanOrEqual(doc.chunks[i - 1].endOffset);
      expect(doc.chunks[i].startOffset).toBeGreaterThan(doc.chunks[i - 1].startOffset);
    }
    expect(doc.chunks.at(-1)?.pageEnd).toBe(40);
  });
});
