import type { NextRequest } from "next/server";
import { z } from "zod";
import { runAgent, type AgentEvent } from "@/lib/ai/agent";
import { loadDocuments } from "@/lib/documents/store";
import { fail, handleError } from "@/lib/http";
import { logger } from "@/lib/logger";
import { clientKey, isRateLimited } from "@/lib/rateLimit";

export const runtime = "nodejs";
export const maxDuration = 120;

const Body = z.object({
  documentIds: z.array(z.string().min(1).max(64)).min(1).max(5),
  question: z.string().trim().min(3).max(1000),
});

/** Server-Sent Events: `step` events while the agent works, then one `final` (or `error`). */
export async function POST(req: NextRequest) {
  let body: z.infer<typeof Body>;
  let docs;
  try {
    if (isRateLimited(`a:${clientKey(req)}`, 5)) return fail("RATE_LIMITED", "Too many requests. Wait a moment and try again.", 429);
    body = Body.parse(await req.json());
    docs = await loadDocuments(body.documentIds);
  } catch (error) {
    return handleError(error, "agent_setup");
  }

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send = (event: AgentEvent | { type: "error"; message: string }) =>
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
      try {
        await runAgent({ question: body.question, docs, onEvent: send, signal: req.signal });
      } catch (error) {
        logger.error({ operation: "agent_run", errorCode: "AGENT_FAILED", error });
        send({ type: "error", message: "The research could not be completed. Please try again." });
      } finally {
        controller.close();
      }
    },
  });
  return new Response(stream, { headers: { "content-type": "text/event-stream", "cache-control": "no-cache, no-transform" } });
}
