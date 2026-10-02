export interface SourcePage {
  pageNumber: number;
  /** Offset of the page's first character inside the document's full text. */
  startOffset: number;
  text: string;
}

/** Returns the page containing a document offset. Pages must be sorted by startOffset. */
export function pageForOffset(pages: SourcePage[], offset: number): number {
  let found = pages[0]?.pageNumber ?? 1;
  for (const page of pages) {
    if (page.startOffset <= offset) found = page.pageNumber;
    else break;
  }
  return found;
}
