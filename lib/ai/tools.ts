import { z } from "zod";
import { pageForOffset } from "@/lib/citations/locator";
import type { FunctionDeclaration } from "./gemini";
import type { LoadedDocument } from "@/lib/documents/store-types";
import { retrieveChunks } from "@/lib/retrieval/keyword";

/** Cap on what any tool can feed back to the model. */
const MAX_TOOL_RESULT_CHARS = 8000;
const SECTION_CHARS = 4000;
const MAX_CLAUSES = 150;

export const TOOL_DECLARATIONS: FunctionDeclaration[] = [
  {
    name: "search_document",
    description: "Search the documents for passages relevant to a query.",
    parameters: {
      type: "object",
      properties: { query: { type: "string" }, documentId: { type: "string" } },
      required: ["query"],
    },
  },
  {
    name: "get_section",
    description: "Read a numbered section or article, for example '12' or '8.2'.",
    parameters: {
      type: "object",
      properties: { number: { type: "string" }, documentId: { type: "string" } },
      required: ["number"],
    },
  },
  {
    name: "list_clauses",
    description: "List section and clause headings found in the documents.",
    parameters: { type: "object", properties: { documentId: { type: "string" } } },
  },
];

const documentId = z.string().min(1).max(64).optional();
const ARG_SCHEMAS = {
  search_document: z.object({ query: z.string().trim().min(2).max(200), documentId }).strict(),
  get_section: z.object({ number: z.string().trim().min(1).max(20).regex(/^[\w.()-]+$/), documentId }).strict(),
  list_clauses: z.object({ documentId }).strict(),
};
type ToolName = keyof typeof ARG_SCHEMAS;

export type ToolOutcome = { ok: true; label: string; data: unknown } | { ok: false; label: string; error: string };

const HEADING = /^[ \t]*((?:article|section|clause)\s+[\dIVXivx]+[.:)]?[^\n]{0,80}|\d+(?:\.\d+)*[.)]?[ \t]+[A-Z][^\n]{2,80})$/gm;

function scope(docs: LoadedDocument[], id?: string): LoadedDocument[] | null {
  if (!id) return docs;
  const doc = docs.find((d) => d.id === id);
  return doc ? [doc] : null;
}

/** Validates the tool name and arguments before anything runs. Never throws on model input. */
export function executeTool(name: unknown, args: unknown, docs: LoadedDocument[]): ToolOutcome {
  if (typeof name !== "string" || !(name in ARG_SCHEMAS)) {
    return { ok: false, label: "Ignored an unknown tool call", error: "Unknown tool. Use search_document, get_section or list_clauses." };
  }
  const tool = name as ToolName;
  const parsed = ARG_SCHEMAS[tool].safeParse(args ?? {});
  if (!parsed.success) {
    return { ok: false, label: `Rejected malformed ${tool} call`, error: "Invalid arguments for this tool." };
  }
  const input = parsed.data as { query?: string; number?: string; documentId?: string };
  const targets = scope(docs, input.documentId);
  if (!targets) return { ok: false, label: `Rejected ${tool} call`, error: "documentId is not in scope." };

  if (tool === "search_document") {
    const { chunks } = retrieveChunks(targets, input.query!, 5);
    const results = chunks.map((c) => ({ documentId: c.documentId, pages: [c.pageStart, c.pageEnd], text: c.text.slice(0, 1500) }));
    return { ok: true, label: `Searching for "${input.query}"`, data: capped({ results, note: results.length ? undefined : "No matching passages were retrieved. This does not show the topic is absent." }) };
  }

  if (tool === "get_section") {
    const escaped = input.number!.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const pattern = new RegExp(`(^|\\n)[ \\t]*(?:(?:section|article|clause)\\s+)?${escaped}(?:[.):\\s]|$)`, "i");
    const sections = targets.flatMap((doc) => {
      const match = pattern.exec(doc.fullText);
      if (!match) return [];
      const start = match.index + (match[1] ? match[1].length : 0);
      return [{ documentId: doc.id, page: pageForOffset(doc.pages, start), text: doc.fullText.slice(start, start + SECTION_CHARS) }];
    });
    if (sections.length === 0) {
      return { ok: false, label: `Reading section ${input.number}`, error: `Section ${input.number} was not found by heading search.` };
    }
    return { ok: true, label: `Reading section ${input.number}`, data: capped({ sections }) };
  }

  const clauses = targets.flatMap((doc) =>
    [...doc.fullText.matchAll(HEADING)].map((m) => ({ documentId: doc.id, page: pageForOffset(doc.pages, m.index ?? 0), heading: m[1].trim() })),
  ).slice(0, MAX_CLAUSES);
  return { ok: true, label: "Listing clause headings", data: capped({ clauses }) };
}

function capped(value: unknown): unknown {
  const json = JSON.stringify(value);
  return json.length <= MAX_TOOL_RESULT_CHARS ? value : { truncated: true, text: json.slice(0, MAX_TOOL_RESULT_CHARS) };
}
