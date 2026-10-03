import type { NextRequest } from "next/server";
import { deleteDocumentFile } from "@/lib/documents/storage";
import { fail, handleError, ok } from "@/lib/http";
import { prisma } from "@/lib/prisma";
import { getSessionId } from "@/lib/session";

export const runtime = "nodejs";
type Ctx = { params: Promise<{ id: string }> };

export async function GET(req: NextRequest, { params }: Ctx) {
  try {
    const { id } = await params;
    const { sessionId } = await getSessionId(req);
    const document = await prisma.document.findUnique({
      where: { id },
      select: { id: true, name: true, type: true, status: true, statusMessage: true, pageCount: true, createdAt: true, sessionId: true, isSample: true },
    });
    if (!document) return fail("NOT_FOUND", "Document not found.", 404);
    if (!document.isSample && document.sessionId && document.sessionId !== sessionId) {
      return fail("FORBIDDEN", "You do not have access to this document.", 403);
    }
    return ok({ document });
  } catch (error) {
    return handleError(error, "get_document");
  }
}

export async function DELETE(req: NextRequest, { params }: Ctx) {
  try {
    const { id } = await params;
    const { sessionId } = await getSessionId(req);
    const document = await prisma.document.findUnique({
      where: { id },
      select: { storageKey: true, type: true, sessionId: true, isSample: true },
    });
    if (!document) return fail("NOT_FOUND", "Document not found.", 404);

    // Protect sample contracts from deletion
    if (document.isSample) {
      return fail("FORBIDDEN", "Sample contracts cannot be deleted.", 403);
    }

    // Verify session ownership
    if (document.sessionId && document.sessionId !== sessionId) {
      return fail("FORBIDDEN", "You do not have permission to delete this contract.", 403);
    }

    // Pages, chunks, chats, messages and citations are removed by cascading foreign keys.
    await prisma.document.delete({ where: { id } });
    await deleteDocumentFile(document.storageKey, document.type as "pdf" | "docx");

    return ok({ deleted: true });
  } catch (error) {
    return handleError(error, "delete_document");
  }
}
