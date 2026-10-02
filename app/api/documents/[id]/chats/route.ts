import type { NextRequest } from "next/server";
import { z } from "zod";
import { fail, handleError, ok } from "@/lib/http";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
type Ctx = { params: Promise<{ id: string }> };

const CreateChatBody = z.object({
  title: z.string().trim().min(1).max(100).optional(),
});

export async function GET(_req: NextRequest, { params }: Ctx) {
  try {
    const { id } = await params;
    const document = await prisma.document.findUnique({
      where: { id },
      select: { id: true },
    });
    if (!document) return fail("NOT_FOUND", "Document not found.", 404);

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
    const document = await prisma.document.findUnique({
      where: { id },
      select: { id: true, name: true },
    });
    if (!document) return fail("NOT_FOUND", "Document not found.", 404);

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
