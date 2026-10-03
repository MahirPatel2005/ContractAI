import type { NextRequest } from "next/server";
import { z } from "zod";
import { fail, handleError, ok } from "@/lib/http";
import { prisma } from "@/lib/prisma";

import { getSessionId } from "@/lib/session";

export const runtime = "nodejs";
type Ctx = { params: Promise<{ id: string }> };

const CreateChatBody = z.object({
  title: z.string().trim().min(1).max(100).optional(),
});

export async function GET(req: NextRequest, { params }: Ctx) {
  try {
    const { id } = await params;
    const { sessionId } = await getSessionId(req);
    const document = await prisma.document.findUnique({
      where: { id },
      select: { id: true, sessionId: true, isSample: true },
    });
    if (!document) return fail("NOT_FOUND", "Document not found.", 404);
    if (!document.isSample && document.sessionId && document.sessionId !== sessionId) {
      return fail("FORBIDDEN", "You do not have access to this document.", 403);
    }

    const chats = await prisma.chat.findMany({
      where: { documentId: id },
      orderBy: { createdAt: "desc" },
      include: {
        _count: {
          select: { messages: true },
        },
      },
    });

    return ok({ chats });
  } catch (error) {
    return handleError(error, "list_chats");
  }
}

export async function POST(req: NextRequest, { params }: Ctx) {
  try {
    const { id } = await params;
    const { sessionId } = await getSessionId(req);
    const document = await prisma.document.findUnique({
      where: { id },
      select: { id: true, name: true, sessionId: true, isSample: true },
    });
    if (!document) return fail("NOT_FOUND", "Document not found.", 404);
    if (!document.isSample && document.sessionId && document.sessionId !== sessionId) {
      return fail("FORBIDDEN", "You do not have access to this document.", 403);
    }

    const json = await req.json().catch(() => ({}));
    const parsed = CreateChatBody.parse(json);
    const title = parsed.title || `Chat about ${document.name}`;

    const chat = await prisma.chat.create({
      data: {
        documentId: id,
        title,
      },
    });

    return ok({ chat }, 201);
  } catch (error) {
    return handleError(error, "create_chat");
  }
}
