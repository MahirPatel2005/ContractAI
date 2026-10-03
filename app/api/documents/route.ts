import type { NextRequest } from "next/server";
import { handleError, ok } from "@/lib/http";
import { prisma } from "@/lib/prisma";
import { attachSessionCookie, getSessionId } from "@/lib/session";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  try {
    const { sessionId, isNew } = await getSessionId(req);
    const documents = await prisma.document.findMany({
      where: {
        OR: [
          { sessionId },
          { isSample: true },
        ],
      },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        name: true,
        type: true,
        status: true,
        statusMessage: true,
        pageCount: true,
        isSample: true,
        createdAt: true,
      },
    });

    const res = ok({ documents, sessionId });
    if (isNew) {
      attachSessionCookie(res, sessionId);
    }
    return res;
  } catch (error) {
    return handleError(error, "list_documents");
  }
}
