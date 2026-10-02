import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { logger } from "@/lib/logger";
import { assembleDocument, hasReadableText } from "./assemble";
import { chunkDocument } from "./chunker";
import { extractDocxPages } from "./docx";
import { runOcr } from "./ocr";
import { extractPdfPages, type ExtractedPage } from "./pdf";
import type { DocumentType } from "./validate";

export const UNREADABLE_MESSAGE =
  "We could not extract readable text from this file. If it is a scan, try a text-based PDF or a higher-quality scan.";

/**
 * Runs the processing pipeline and records every stage in the database so the UI can show
 * progress. An empty extraction is a failure, never a "ready" document.
 */
export async function processDocument(documentId: string, buffer: Buffer, type: DocumentType): Promise<void> {
  const setStatus = (status: "extracting" | "ocr" | "chunking" | "failed", statusMessage: string | null = null) =>
    prisma.document.update({ where: { id: documentId }, data: { status, statusMessage } });
  const started = Date.now();

  try {
    await setStatus("extracting");
    let pages: ExtractedPage[] = type === "pdf" ? await extractPdfPages(buffer) : await extractDocxPages(buffer);

    if (!hasReadableText(pages)) {
      let ocrPages: ExtractedPage[] | null = null;
      if (type === "pdf") {
        await setStatus("ocr");
        ocrPages = await runOcr(buffer);
      }
      if (!ocrPages || !hasReadableText(ocrPages)) {
        await setStatus("failed", UNREADABLE_MESSAGE);
        logger.info({ operation: "process", documentId, status: "failed", errorCode: "NO_READABLE_TEXT" });
        return;
      }
      pages = ocrPages;
    }

    await setStatus("chunking");
    const assembled = assembleDocument(pages);
    const chunks = chunkDocument(assembled.fullText, assembled.pages);

    // One transaction so a re-run never leaves half-written pages or chunks behind.
    await prisma.$transaction([
      prisma.chunk.deleteMany({ where: { documentId } }),
      prisma.page.deleteMany({ where: { documentId } }),
      prisma.page.createMany({
        data: assembled.pages.map((p, i) => ({
          documentId,
          pageNumber: p.pageNumber,
          text: p.text,
          startOffset: p.startOffset,
          items: pages[i].items as unknown as Prisma.InputJsonValue,
        })),
      }),
      prisma.chunk.createMany({ data: chunks.map((c) => ({ documentId, ...c })) }),
      prisma.document.update({
        where: { id: documentId },
        data: { status: "ready", statusMessage: null, pageCount: pages.length, fullText: assembled.fullText },
      }),
    ]);
    logger.info({ operation: "process", documentId, status: "ready", durationMs: Date.now() - started });
  } catch (error) {
    logger.error({ operation: "process", documentId, status: "failed", errorCode: "PROCESSING_ERROR", error });
    await setStatus("failed", "We could not process this file. Check that it is a valid PDF or DOCX and try again.").catch(() => undefined);
  }
}
