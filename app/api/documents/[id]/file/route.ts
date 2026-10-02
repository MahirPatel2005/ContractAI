import type { NextRequest } from "next/server";
import { getDocumentFile } from "@/lib/documents/storage";
import { fail, handleError } from "@/lib/http";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: Ctx) {
  try {
    const { id } = await params;
    const document = await prisma.document.findUnique({
      where: { id },
      select: { id: true, name: true, type: true, storageKey: true },
    });
    if (!document) return fail("NOT_FOUND", "Document not found.", 404);

    const buffer = await getDocumentFile(document.storageKey, document.type as "pdf" | "docx");
    if (!buffer) return fail("NOT_FOUND", "The original document file could not be found on the server.", 404);

    const contentType =
      document.type === "pdf"
        ? "application/pdf"
        : "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

    const encodedName = encodeURIComponent(document.name);

    return new Response(new Uint8Array(buffer), {
      status: 200,
      headers: {
        "Content-Type": contentType,
        "Content-Disposition": `inline; filename="${encodedName}"; filename*=UTF-8''${encodedName}`,
        "Content-Length": buffer.length.toString(),
        "Cache-Control": "public, max-age=3600, immutable",
      },
    });
  } catch (error) {
    return handleError(error, "get_document_file");
  }
}
