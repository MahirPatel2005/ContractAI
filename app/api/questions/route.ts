import type { NextRequest } from "next/server";
import { z } from "zod";
import { answerQuestion } from "@/lib/ai/answer";
import { loadDocuments } from "@/lib/documents/store";
import { fail, handleError, ok } from "@/lib/http";
import { clientKey, isRateLimited } from "@/lib/rateLimit";

export const runtime = "nodejs";
export const maxDuration = 60;

const Body = z.object({
  documentIds: z.array(z.string().min(1).max(64)).min(1).max(5),
  question: z.string().trim().min(3).max(1000),
});

export async function POST(req: NextRequest) {
  try {
    if (isRateLimited(`q:${clientKey(req)}`)) return fail("RATE_LIMITED", "Too many requests. Wait a moment and try again.", 429);
    const { documentIds, question } = Body.parse(await req.json());
    const docs = await loadDocuments(documentIds);
    return ok(await answerQuestion({ question, docs }));
  } catch (error) {
    return handleError(error, "question");
  }
}
