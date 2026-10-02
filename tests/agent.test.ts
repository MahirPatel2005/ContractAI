import { describe, expect, it, vi } from "vitest";
import { MAX_AGENT_ROUNDS, runAgent, type AgentEvent } from "@/lib/ai/agent";
import type { GeminiContent, GenerateFn } from "@/lib/ai/gemini";
import { makeDoc } from "./helpers";

const CLAUSE = "Either party may terminate this agreement on thirty days written notice.";
const doc = makeDoc("d1", ["1. Term\nThis agreement lasts one year.", `12. Termination\n${CLAUSE}`]);
const call = (name: string, args: unknown): GeminiContent => ({ role: "model", parts: [{ functionCall: { name, args } }] });
const final = (quote: string): GeminiContent => ({
  role: "model",
  parts: [{ text: JSON.stringify({ answer: "Either party can terminate.", insufficientEvidence: false, citations: [{ documentId: "d1", quote }] }) }],
});

describe("runAgent", () => {
  it("enforces the hard round limit even if the model keeps calling tools", async () => {
    const generate = vi.fn<GenerateFn>(async (req) =>
      req.tools ? call("search_document", { query: "termination" }) : final(CLAUSE),
    );
    const events: AgentEvent[] = [];
    const result = await runAgent({ question: "termination rights?", docs: [doc], generate, onEvent: (e) => events.push(e) });
    expect(generate).toHaveBeenCalledTimes(MAX_AGENT_ROUNDS);
    expect(events.filter((e) => e.type === "step")).toHaveLength(MAX_AGENT_ROUNDS - 1);
    expect(result.citations).toHaveLength(1);
  });

  it("turns unknown tools and malformed arguments into controlled tool errors", async () => {
    const replies = [call("delete_everything", {}), call("search_document", { query: 42 }), call("get_section", { number: "../etc", documentId: "d1" }), call("get_section", { number: "12" }), final(CLAUSE)];
    const generate: GenerateFn = async () => replies.shift()!;
    const events: AgentEvent[] = [];
    const result = await runAgent({ question: "termination?", docs: [doc], generate, onEvent: (e) => events.push(e) });
    const steps = events.filter((e): e is Extract<AgentEvent, { type: "step" }> => e.type === "step");
    expect(steps.map((s) => s.ok)).toEqual([false, false, false, true]);
    expect(result.citations[0].documentId).toBe("d1");
  });

  it("verifies the final answer: an invented quote is dropped", async () => {
    const generate: GenerateFn = async () => final("The supplier may terminate immediately without notice or cause.");
    const result = await runAgent({ question: "termination?", docs: [doc], generate });
    expect(result.citations).toHaveLength(0);
    expect(result.rejectedCitationCount).toBe(1);
    expect(result.unverified).toBe(true);
  });
});
