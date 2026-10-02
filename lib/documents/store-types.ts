import type { SourceDocument } from "@/lib/citations/verifier";

export interface StoredChunk {
  id: string;
  pageStart: number;
  pageEnd: number;
  text: string;
  startOffset: number;
  endOffset: number;
}

export interface LoadedDocument extends SourceDocument {
  chunks: StoredChunk[];
}
