import type { NextRequest } from "next/server";
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
      include: {
        pages: {
          orderBy: { pageNumber: "asc" },
          select: {
            pageNumber: true,
            text: true,
            startOffset: true,
            items: true,
          },
        },
      },
    });

    if (!document) return fail("NOT_FOUND", "Document not found.", 404);
    if (!document.isSample && document.sessionId && document.sessionId !== sessionId) {
      return fail("FORBIDDEN", "You do not have access to this document.", 403);
    }

    return ok({
      document: {
        id: document.id,
        name: document.name,
        type: document.type,
        status: document.status,
        statusMessage: document.statusMessage,
        pageCount: document.pageCount,
        createdAt: document.createdAt,
      },
      pages: document.pages,
    });
  } catch (error) {
    return handleError(error, "get_document_content");
  }
}
