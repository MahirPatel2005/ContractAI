import mammoth from "mammoth";
import type { ExtractedPage } from "./pdf";

// DOCX has no fixed pagination, so paragraphs are grouped into virtual pages of similar size.
const VIRTUAL_PAGE_CHARS = 3000;

export async function extractDocxPages(buffer: Buffer): Promise<ExtractedPage[]> {
  const { value } = await mammoth.extractRawText({ buffer });
  const paragraphs = value.split(/\n{2,}/).map((p) => p.trim()).filter(Boolean);

  const pages: ExtractedPage[] = [];
  let current: string[] = [];
  let length = 0;
  const flush = () => {
    if (current.length === 0) return;
    pages.push({ pageNumber: pages.length + 1, text: current.join("\n\n"), items: [] });
    current = [];
    length = 0;
  };
  for (const paragraph of paragraphs) {
    if (length > 0 && length + paragraph.length > VIRTUAL_PAGE_CHARS) flush();
    current.push(paragraph);
    length += paragraph.length;
  }
  flush();
  return pages;
}
