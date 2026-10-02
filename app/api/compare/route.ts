import type { NextRequest } from "next/server";
import { z } from "zod";
import { compareContracts } from "@/lib/comparison/compare";
import { loadDocuments } from "@/lib/documents/store";
import { fail, handleError, ok } from "@/lib/http";
import { clientKey, isRateLimited } from "@/lib/rateLimit";

export const runtime = "nodejs";
export const maxDuration = 60;

const Body = z.object({
  leftDocumentId: z.string().min(1).max(64),
  rightDocumentId: z.string().min(1).max(64),
});

export async function POST(req: NextRequest) {
  try {
    if (isRateLimited(`cmp:${clientKey(req)}`, 10)) {
      return fail("RATE_LIMITED", "Too many comparison requests. Please wait a moment.", 429);
    }

    const { leftDocumentId, rightDocumentId } = Body.parse(await req.json());
    if (leftDocumentId === rightDocumentId) {
      return fail("INVALID_INPUT", "Select two different documents to compare.", 400);
    }

    const docs = await loadDocuments([leftDocumentId, rightDocumentId]);
    const docLeft = docs.find((d) => d.id === leftDocumentId);
    const docRight = docs.find((d) => d.id === rightDocumentId);

    if (!docLeft || !docRight) {
      return fail("NOT_FOUND", "One or both documents could not be found.", 404);
    }

    const report = compareContracts(docLeft, docRight);
    return ok(report);
  } catch (error) {
    return handleError(error, "compare_documents");
  }
}
