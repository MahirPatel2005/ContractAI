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
  const sectionTokens: string[] = [];
  const secRegex = /\b(?:sec(?:tion)?\s+)?(\d{1,3}(?:\s*\([a-z0-9]+\))?)(?!\w)/gi;
  let match;
  while ((match = secRegex.exec(query)) !== null) {
    const raw = match[1].replace(/\s+/g, "").toLowerCase();
    if (raw.length > 0) {
      sectionTokens.push(raw);
      sectionTokens.push(`sec ${raw}`);
      sectionTokens.push(`section ${raw}`);
    }
  }

  const rawWords = query.toLowerCase().match(/[a-z0-9]+(?:\([a-z0-9]+\))?|[a-z0-9$%]+/g) ?? [];
  const words = rawWords.filter((t) => (t.length > 2 || /\d/.test(t)) && !STOP_WORDS.has(t));
  return [...new Set([...sectionTokens, ...words])];
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
        // Strip academic watermark/headers so they don't distort retrieval ranking
        const cleanedText = chunk.text.replace(/YES Academy[^\n]*\n[^\n]*/gi, "");
        const lower = cleanedText.toLowerCase();
        let distinctHits = 0;
        let score = terms.reduce((sum, term) => {
          const hits = lower.split(term).length - 1;
          if (hits > 0) {
            distinctHits++;
            const isSection = term.includes("(") || term.startsWith("sec");
            return sum + (isSection ? 15 : 1) + Math.log(hits);
          }
          return sum;
        }, 0);
        score += distinctHits * 4;
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
