import type { SourcePage } from "@/lib/citations/locator";

// Pages are joined with a blank line so a page break is also a paragraph break, and so
// quotes spanning two pages still match after whitespace normalization.
export const PAGE_SEPARATOR = "\n\n";

export function assembleDocument(pages: { pageNumber: number; text: string }[]): {
  fullText: string;
  pages: SourcePage[];
} {
  let offset = 0;
  const out: SourcePage[] = [];
  for (const page of pages) {
    out.push({ pageNumber: page.pageNumber, startOffset: offset, text: page.text });
    offset += page.text.length + PAGE_SEPARATOR.length;
  }
  return { fullText: pages.map((p) => p.text).join(PAGE_SEPARATOR), pages: out };
}

// A real text PDF has hundreds of characters per page; scans typically yield ~0.
const MIN_CHARS_PER_PAGE = 40;

export function hasReadableText(pages: { text: string }[]): boolean {
  if (pages.length === 0) return false;
  const chars = pages.reduce((sum, p) => sum + p.text.replace(/\s/g, "").length, 0);
  return chars / pages.length >= MIN_CHARS_PER_PAGE;
}
