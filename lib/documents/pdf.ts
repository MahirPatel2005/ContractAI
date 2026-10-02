export interface PageTextItem {
  str: string;
  /** Character range of this item inside the page text. */
  start: number;
  end: number;
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface ExtractedPage {
  pageNumber: number;
  text: string;
  items: PageTextItem[];
}

interface PdfTextItem {
  str: string;
  hasEOL: boolean;
  width: number;
  height: number;
  transform: number[];
}
interface PdfPage {
  getTextContent(): Promise<{ items: Array<PdfTextItem | { type: string }> }>;
}
interface PdfDocument {
  numPages: number;
  getPage(n: number): Promise<PdfPage>;
  destroy(): Promise<void>;
}
interface PdfJs {
  getDocument(src: Record<string, unknown>): { promise: Promise<PdfDocument> };
}

/**
 * Extracts page-level text and keeps each text item's character range and coordinates, so a
 * verified character range can later be turned into highlight rectangles.
 */
export async function extractPdfPages(buffer: Buffer): Promise<ExtractedPage[]> {
  const pdfjs = (await import("pdfjs-dist/legacy/build/pdf.mjs")) as unknown as PdfJs;
  const doc = await pdfjs.getDocument({
    data: new Uint8Array(buffer),
    useSystemFonts: true,
    isEvalSupported: false,
  }).promise;

  try {
    const pages: ExtractedPage[] = [];
    for (let n = 1; n <= doc.numPages; n++) {
      const content = await (await doc.getPage(n)).getTextContent();
      let text = "";
      const items: PageTextItem[] = [];
      for (const raw of content.items) {
        if (!("str" in raw)) continue;
        const start = text.length;
        text += raw.str;
        items.push({
          str: raw.str,
          start,
          end: text.length,
          x: raw.transform[4],
          y: raw.transform[5],
          width: raw.width,
          height: raw.height,
        });
        if (raw.hasEOL) text += "\n";
      }
      pages.push({ pageNumber: n, text, items });
    }
    return pages;
  } finally {
    await doc.destroy();
  }
}
