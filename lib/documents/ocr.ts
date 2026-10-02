import type { ExtractedPage } from "./pdf";

/**
 * OCR hook for scanned PDFs. No OCR engine is wired in yet, so this returns null and the
 * pipeline marks the document as failed with an explanation instead of pretending an empty
 * extraction succeeded. Implement with ocrmypdf/Tesseract or a cloud OCR provider.
 */
export async function runOcr(_buffer: Buffer): Promise<ExtractedPage[] | null> {
  return null;
}
