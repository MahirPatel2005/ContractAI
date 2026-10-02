import type { NextRequest } from "next/server";
import { deleteDocumentFile } from "@/lib/documents/storage";
import { fail, handleError, ok } from "@/lib/http";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: Ctx) {
  try {
    const { id } = await params;
    const document = await prisma.document.findUnique({
      where: { id },
      select: { id: true, name: true, type: true, status: true, statusMessage: true, pageCount: true, createdAt: true },
    });
    return document ? ok({ document }) : fail("NOT_FOUND", "Document not found.", 404);
  } catch (error) {
    return handleError(error, "get_document");
  }
}

export async function DELETE(_req: NextRequest, { params }: Ctx) {
  try {
    const { id } = await params;
    const document = await prisma.document.findUnique({
      where: { id },
      select: { storageKey: true, type: true },
    });
    if (!document) return fail("NOT_FOUND", "Document not found.", 404);

    // Pages, chunks, chats, messages and citations are removed by cascading foreign keys.
    await prisma.document.delete({ where: { id } });
    await deleteDocumentFile(document.storageKey, document.type as "pdf" | "docx");

    return ok({ deleted: true });
  } catch (error) {
    return handleError(error, "delete_document");
  }
}
