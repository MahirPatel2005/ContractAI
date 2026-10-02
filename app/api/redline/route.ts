import type { NextRequest } from "next/server";
import { z } from "zod";
import { loadDocuments } from "@/lib/documents/store";
import { fail, handleError, ok } from "@/lib/http";
import { clientKey, isRateLimited } from "@/lib/rateLimit";
import { proposeRedline } from "@/lib/redline/propose";

export const runtime = "nodejs";
export const maxDuration = 60;

const Body = z.object({
  documentId: z.string().min(1).max(64),
  instruction: z.string().trim().min(3).max(500),
});

export async function POST(req: NextRequest) {
  try {
    if (isRateLimited(`redline:${clientKey(req)}`, 15)) {
      return fail("RATE_LIMITED", "Too many redline requests. Please wait a moment.", 429);
    }

    const { documentId, instruction } = Body.parse(await req.json());
    const docs = await loadDocuments([documentId]);
    const doc = docs[0];

    const proposal = await proposeRedline(doc, instruction);
    return ok(proposal);
  } catch (error) {
    return handleError(error, "propose_redline");
  }
}
