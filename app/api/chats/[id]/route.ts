import type { NextRequest } from "next/server";
import { fail, handleError, ok } from "@/lib/http";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: Ctx) {
  try {
    const { id } = await params;
    const chat = await prisma.chat.findUnique({
      where: { id },
      include: {
        document: {
          select: { id: true, name: true, type: true, pageCount: true, status: true },
        },
        messages: {
          orderBy: { createdAt: "asc" },
          include: {
            citations: {
              orderBy: { pageNumber: "asc" },
            },
          },
        },
      },
    });

    if (!chat) return fail("NOT_FOUND", "Chat not found.", 404);

    return ok({ chat });
  } catch (error) {
    return handleError(error, "get_chat");
  }
}

export async function DELETE(_req: NextRequest, { params }: Ctx) {
  try {
    const { id } = await params;
    const chat = await prisma.chat.findUnique({ where: { id } });
    if (!chat) return fail("NOT_FOUND", "Chat not found.", 404);

    await prisma.chat.delete({ where: { id } });
    return ok({ deleted: true });
  } catch (error) {
    return handleError(error, "delete_chat");
  }
}
