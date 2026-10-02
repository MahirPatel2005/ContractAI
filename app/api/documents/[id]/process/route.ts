import { after, type NextRequest } from "next/server";
import { processDocument } from "@/lib/documents/pipeline";
import { getDocumentFile } from "@/lib/documents/storage";
import { fail, handleError, ok } from "@/lib/http";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const maxDuration = 60;
type Ctx = { params: Promise<{ id: string }> };

export async function POST(_req: NextRequest, { params }: Ctx) {
  try {
    const { id } = await params;
    const document = await prisma.document.findUnique({
      where: { id },
      select: { id: true, type: true, storageKey: true, status: true },
    });
    if (!document) return fail("NOT_FOUND", "Document not found.", 404);

    const buffer = await getDocumentFile(document.storageKey, document.type as "pdf" | "docx");
    if (!buffer) return fail("NOT_FOUND", "Original file buffer not found. Please upload again.", 404);

    await prisma.document.update({
      where: { id },
      data: { status: "queued", statusMessage: null },
    });

    after(() => processDocument(id, buffer, document.type as "pdf" | "docx"));

    return ok({ documentId: id, status: "queued" });
  } catch (error) {
    return handleError(error, "reprocess_document");
  }
}
