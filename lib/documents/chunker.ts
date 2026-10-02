import { pageForOffset, type SourcePage } from "@/lib/citations/locator";

// ~700 tokens and ~100 tokens of overlap at roughly 4 characters per token.
export const DEFAULT_CHUNK_CHARS = 2800;
export const DEFAULT_OVERLAP_CHARS = 400;

export interface ChunkDraft {
  pageStart: number;
  pageEnd: number;
  text: string;
  startOffset: number;
  endOffset: number;
}

interface Segment {
  start: number;
  end: number;
}

function splitIntoSegments(text: string, maxChars: number): Segment[] {
  const segments: Segment[] = [];
  const paragraph = /\S[\s\S]*?(?=\n\s*\n|$)/g;
  for (const match of text.matchAll(paragraph)) {
    let pos = match.index ?? 0;
    const end = pos + match[0].length;
    while (end - pos > maxChars) {
      const limit = pos + maxChars;
      const sentence = text.lastIndexOf(". ", limit);
      const space = text.lastIndexOf(" ", limit);
      const cut = sentence > pos + maxChars / 2 ? sentence + 2 : space > pos ? space + 1 : limit;
      segments.push({ start: pos, end: cut });
      pos = cut;
    }
    if (end > pos) segments.push({ start: pos, end });
  }
  return segments;
}

/** Paragraph-aware chunking. Every chunk records exact source offsets and its page range. */
export function chunkDocument(
  fullText: string,
  pages: SourcePage[],
  size = DEFAULT_CHUNK_CHARS,
  overlap = DEFAULT_OVERLAP_CHARS,
): ChunkDraft[] {
  const segments = splitIntoSegments(fullText, size);
  const chunks: ChunkDraft[] = [];
  let i = 0;
  while (i < segments.length) {
    let j = i;
    while (j + 1 < segments.length && segments[j + 1].end - segments[i].start <= size) j++;
    const start = segments[i].start;
    const end = segments[j].end;
    chunks.push({
      text: fullText.slice(start, end),
      startOffset: start,
      endOffset: end,
      pageStart: pageForOffset(pages, start),
      pageEnd: pageForOffset(pages, end - 1),
    });
    if (j === segments.length - 1) break;
    let next = j + 1;
    while (next - 1 > i && segments[j].end - segments[next - 1].start <= overlap) next--;
    i = next;
  }
  return chunks;
}
