import { assembleDocument } from "@/lib/documents/assemble";
import { chunkDocument } from "@/lib/documents/chunker";
import type { LoadedDocument } from "@/lib/documents/store-types";

export function makeDoc(id: string, pageTexts: string[], name = `${id}.pdf`): LoadedDocument {
  const { fullText, pages } = assembleDocument(pageTexts.map((text, i) => ({ pageNumber: i + 1, text })));
  const chunks = chunkDocument(fullText, pages).map((c, i) => ({ id: `${id}-c${i}`, ...c }));
  return { id, name, fullText, pages, chunks };
}
