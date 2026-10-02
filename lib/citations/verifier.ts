import { normalizeQuote, normalizeWithMap, type NormalizedText } from "./normalizer";
import { pageForOffset, type SourcePage } from "./locator";

export interface SourceDocument {
  id: string;
  name: string;
  fullText: string;
  pages: SourcePage[];
}

export interface OffsetRange {
  start: number;
  end: number;
}

export interface VerifiedCitation {
  documentId: string;
  documentName: string;
  /** Text copied from the stored document (whitespace collapsed for display), never the model's wording. */
  quote: string;
  startOffset: number;
  endOffset: number;
  pageStart: number;
  pageEnd: number;
  /** How many times the quote occurs in the document. */
  occurrences: number;
  verified: true;
}

export type VerificationResult =
  | { verified: true; citation: VerifiedCitation }
  | { verified: false; reason: "too_short" | "not_found" };

// Very short fragments ("the", "Agreement") match everywhere and prove nothing.
export const MIN_QUOTE_CHARS = 12;

const normalizedCache = new WeakMap<SourceDocument, NormalizedText>();

function normalizedDocument(doc: SourceDocument): NormalizedText {
  let cached = normalizedCache.get(doc);
  if (!cached) {
    cached = normalizeWithMap(doc.fullText);
    normalizedCache.set(doc, cached);
  }
  return cached;
}

/**
 * Deterministic quote verification. The model supplies only the quote text; the document,
 * offsets and pages all come from stored data. `preferRanges` (e.g. the retrieved chunks)
 * only chooses between repeated occurrences, it can never make a missing quote verified.
 */
export function verifyQuote(
  doc: SourceDocument,
  candidateQuote: string,
  options: { preferRanges?: OffsetRange[] } = {},
): VerificationResult {
  const needle = normalizeQuote(candidateQuote);
  if (needle.length < MIN_QUOTE_CHARS) return { verified: false, reason: "too_short" };

  const haystack = normalizedDocument(doc);
  const starts: number[] = [];
  for (let from = haystack.text.indexOf(needle); from !== -1; from = haystack.text.indexOf(needle, from + 1)) {
    starts.push(from);
  }
  if (starts.length === 0) return { verified: false, reason: "not_found" };

  const toRange = (normStart: number): OffsetRange => ({
    start: haystack.map[normStart],
    end: haystack.map[normStart + needle.length - 1] + 1,
  });
  const ranges = starts.map(toRange);
  const preferRanges = options.preferRanges;
  const preferred = preferRanges?.length
    ? ranges.find((r) => preferRanges.some((p) => r.start < p.end && r.end > p.start))
    : undefined;
  const chosen = preferred ?? ranges[0];

  return {
    verified: true,
    citation: {
      documentId: doc.id,
      documentName: doc.name,
      quote: doc.fullText.slice(chosen.start, chosen.end).replace(/\s+/g, " ").trim(),
      startOffset: chosen.start,
      endOffset: chosen.end,
      pageStart: pageForOffset(doc.pages, chosen.start),
      pageEnd: pageForOffset(doc.pages, chosen.end - 1),
      occurrences: ranges.length,
      verified: true,
    },
  };
}
