import { handleError, ok } from "@/lib/http";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

export async function GET() {
  try {
    const documents = await prisma.document.findMany({
      orderBy: { createdAt: "desc" },
      select: { id: true, name: true, type: true, status: true, statusMessage: true, pageCount: true, createdAt: true },
    });
    return ok({ documents });
  } catch (error) {
    return handleError(error, "list_documents");
  }
}
