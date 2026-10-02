import { prisma } from "@/lib/prisma";
import type { LoadedDocument } from "./store-types";

export class DocumentScopeError extends Error {
  constructor(public code: "NOT_FOUND" | "NOT_READY", message: string, public status: number) {
    super(message);
  }
}

/** Loads documents with their stored text and chunks. All of them must exist and be ready. */
export async function loadDocuments(ids: string[]): Promise<LoadedDocument[]> {
  const unique = [...new Set(ids)];
  const rows = await prisma.document.findMany({
    where: { id: { in: unique } },
    include: {
      pages: { orderBy: { pageNumber: "asc" }, select: { pageNumber: true, startOffset: true, text: true } },
      chunks: { orderBy: { startOffset: "asc" } },
    },
  });
  if (rows.length !== unique.length) throw new DocumentScopeError("NOT_FOUND", "One or more documents were not found.", 404);
  const notReady = rows.find((d) => d.status !== "ready" || d.fullText === null);
  if (notReady) throw new DocumentScopeError("NOT_READY", `"${notReady.name}" has not finished processing.`, 409);

  return unique.map((id) => {
    const d = rows.find((r) => r.id === id)!;
    return { id: d.id, name: d.name, fullText: d.fullText!, pages: d.pages, chunks: d.chunks };
  });
}
