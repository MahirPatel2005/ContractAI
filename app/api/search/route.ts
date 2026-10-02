import type { NextRequest } from "next/server";
import { z } from "zod";
import { loadDocuments } from "@/lib/documents/store";
import { fail, handleError, ok } from "@/lib/http";
import { retrieveChunks } from "@/lib/retrieval/keyword";
import { clientKey, isRateLimited } from "@/lib/rateLimit";

export const runtime = "nodejs";

const Body = z.object({
  documentIds: z.array(z.string().min(1).max(64)).min(1).max(10),
  query: z.string().trim().min(2).max(500),
  perDocument: z.number().int().min(1).max(20).optional().default(6),
});

export async function POST(req: NextRequest) {
  try {
    if (isRateLimited(`s:${clientKey(req)}`, 20)) {
      return fail("RATE_LIMITED", "Too many search requests. Wait a moment and try again.", 429);
    }
    const { documentIds, query, perDocument } = Body.parse(await req.json());
    const docs = await loadDocuments(documentIds);
    const { chunks, coverage } = retrieveChunks(docs, query, perDocument);

    const docMap = new Map(docs.map((d) => [d.id, d.name]));

    const results = chunks.map((chunk) => ({
      id: chunk.id,
      documentId: chunk.documentId,
      documentName: docMap.get(chunk.documentId) ?? "Unknown Document",
      pageStart: chunk.pageStart,
      pageEnd: chunk.pageEnd,
      text: chunk.text,
      startOffset: chunk.startOffset,
      endOffset: chunk.endOffset,
      score: chunk.score,
    }));

    return ok({ results, coverage });
  } catch (error) {
    return handleError(error, "search");
  }
}
