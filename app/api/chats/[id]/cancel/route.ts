import type { NextRequest } from "next/server";
import { cancelChat } from "@/lib/chat/cancellation";
import { fail, handleError, ok } from "@/lib/http";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
type Ctx = { params: Promise<{ id: string }> };

export async function POST(_req: NextRequest, { params }: Ctx) {
  try {
    const { id } = await params;
    const cancelled = cancelChat(id);

    // Also mark any recent incomplete message as cancelled
    const lastMessage = await prisma.message.findFirst({
      where: { chatId: id, role: "assistant" },
      orderBy: { createdAt: "desc" },
    });

    if (lastMessage && !lastMessage.cancelled) {
      await prisma.message.update({
        where: { id: lastMessage.id },
        data: { cancelled: true },
      });
    }

    return ok({ cancelled: true, wasActive: cancelled });
  } catch (error) {
    return handleError(error, "cancel_chat");
  }
}
