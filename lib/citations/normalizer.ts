export interface NormalizedText {
  text: string;
  /** map[i] is the index in the ORIGINAL string of normalized character i. */
  map: number[];
}

// PDF extraction frequently swaps typographic characters and inserts soft hyphens or
// ligatures, so quotes from the model rarely match byte-for-byte.
const REPLACEMENTS: Record<string, string> = {
  "\u2018": "'", "\u2019": "'", "\u201C": '"', "\u201D": '"',
  "\u2013": "-", "\u2014": "-", "\u2212": "-",
  "\u00A0": " ", "\u00AD": "", "\uFB01": "fi", "\uFB02": "fl",
};

/**
 * Lower-cases, folds typographic characters and collapses whitespace, while remembering
 * where every normalized character came from. The original text is never modified; the
 * map is what lets a match in normalized space be turned back into real offsets.
 */
export function normalizeWithMap(original: string): NormalizedText {
  let text = "";
  const map: number[] = [];
  let pendingSpaceAt = -1;

  for (let i = 0; i < original.length; i++) {
    const replaced = (REPLACEMENTS[original[i]] ?? original[i]).toLowerCase();
    for (const ch of replaced) {
      if (/\s/.test(ch)) {
        if (text.length > 0 && pendingSpaceAt < 0) pendingSpaceAt = i;
        continue;
      }
      if (pendingSpaceAt >= 0) {
        text += " ";
        map.push(pendingSpaceAt);
        pendingSpaceAt = -1;
      }
      text += ch;
      map.push(i);
    }
  }
  return { text, map };
}

export function normalizeQuote(quote: string): string {
  return normalizeWithMap(quote).text;
}
