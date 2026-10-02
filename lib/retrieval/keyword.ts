import type { LoadedDocument, StoredChunk } from "@/lib/documents/store-types";

const STOP_WORDS = new Set([
  "the", "and", "for", "are", "was", "what", "which", "who", "how", "does", "this", "that",
  "with", "from", "have", "has", "any", "all", "under", "into", "about", "between", "their",
  "there", "when", "where", "shall", "may", "can", "will", "contract", "agreement",
]);

export interface RetrievedChunk extends StoredChunk {
  documentId: string;
  score: number;
}

export interface RetrievalCoverage {
  documentId: string;
  chunksRetrieved: number;
  chunksTotal: number;
}

export function tokenize(query: string): string[] {
  const tokens = query.toLowerCase().match(/[a-z0-9$%]+/g) ?? [];
  return [...new Set(tokens.filter((t) => t.length > 2 && !STOP_WORDS.has(t)))];
}

/**
 * Lexical retrieval, run independently per document so multi-document questions keep
 * evidence grouped by source. This is the seam where Qdrant semantic search plugs in.
 */
export function retrieveChunks(docs: LoadedDocument[], query: string, perDocument = 6) {
  const terms = tokenize(query);
  const chunks: RetrievedChunk[] = [];
  const coverage: RetrievalCoverage[] = [];

  for (const doc of docs) {
    const scored = doc.chunks
      .map((chunk) => {
        const lower = chunk.text.toLowerCase();
        const score = terms.reduce((sum, term) => {
          const hits = lower.split(term).length - 1;
          return sum + (hits > 0 ? 1 + Math.log(hits) : 0);
        }, 0);
        return { ...chunk, documentId: doc.id, score };
      })
      .filter((c) => c.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, perDocument);
    chunks.push(...scored);
    coverage.push({ documentId: doc.id, chunksRetrieved: scored.length, chunksTotal: doc.chunks.length });
  }
  return { chunks, coverage };
}
