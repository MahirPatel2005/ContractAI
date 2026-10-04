# ContractAI — Implementation Note

### 1. How Quote Verification Works & Where It Could Fail

ContractAI enforces a **Zero-Trust AI Verification** standard: the LLM is treated solely as an inference engine for drafting candidate answers and quotes—it is never the authority for document truth, page numbers, or character offsets.

- **How It Works**:
  1. *Canonical Normalization*: The candidate quote from the model is cleaned of surrounding quotation marks, whitespace collapsed, and smart/curly quotes normalized (`“` $\to$ `"`, `’` $\to$ `'`), maintaining an index back to the raw document text.
  2. *Deterministic Matching & Disambiguation*: The verifier (`lib/citations/verifier.ts`) searches the full ingested text for exact character matches. If a common phrase (e.g., *"thirty (30) days"*) appears on multiple pages, the verifier disambiguates by checking overlap with the retrieved chunks (`allowedRanges`) that the model was analyzing.
  3. *Page & Coordinate Attribution*: Character offsets are intersected against the document's monotonic `pageBoundaries` array to determine the exact physical page number and PDF canvas coordinates.
  4. *Quarantine*: Any quote that cannot be found verbatim or is under 12 characters is rejected.

- **Where It Could Fail**:
  - *OCR Noise & Ligatures*: Scanned PDFs where OCR misreads glyphs (e.g., `rn` as `m`, or missing `fi`/`fl` ligatures) can cause verbatim string searches to fail even when the semantic text is present.
  - *Model Ellipses & Paraphrasing*: If the LLM bridges two non-contiguous clauses with an ellipsis (`...`) or subtly paraphrases words instead of quoting verbatim, the exact matcher will reject the quote.
  - *Complex Multi-Column Tables*: When text extraction sequences horizontal rows differently than visual column order, quotes spanning multiple columns or headers may break continuity.

---

### 2. How Large Documents (150+ Pages) Are Handled

1. **Sliding-Window Chunking with Coordinate Fidelity**: Documents are parsed into 1,000-character sliding windows with 200-character overlaps (`lib/documents/chunker.ts`). Every chunk permanently records its global `startOffset`, `endOffset`, `pageStart`, and `pageEnd` relative to the master document.
2. **Safe Absence Semantics**: A primary risk in large-document RAG is making false global assertions (e.g., *"The contract has no limitation of liability"*) simply because the clause was outside the top-$k$ retrieved chunks. ContractAI enforces strict language:
   > *"I could not verify this from the retrieved document evidence."*
   It explicitly disclaims global negative claims unless verified across the entire document.
3. **Verified at Scale**: Validated with a dedicated 150-page enterprise contract benchmark test (`tests/large-document.test.ts`), confirming linear page boundary resolution and sub-10ms quote lookup across 150 pages.

---

### 3. Part C Option: Selection, Progress & Hardest Technical Challenge

- **Option Chosen**: **Part C Option 1 (Tracked-Change Redlining)** *(with Option 2 Agentic Research implemented as a bonus)*.
- **Why**: Real legal work does not happen in chat markdown or plain text diffs; attorneys and contract managers work in Microsoft Word. Producing real Word documents with native tracked changes bridges the gap between AI analysis and actual corporate legal workflows.
- **How Far We Got**: 100% complete and end-to-end functional:
  1. Plain-language instruction parser (e.g., *"Make the liability cap mutual"*, *"Increase termination notice to 60 days"*).
  2. In-browser visual diff preview displaying struck-through deletions in red and insertions in green.
  3. Server-side OpenXML engine (`lib/redline/docxXml.ts`) that modifies `word/document.xml` using native `<w:del>` and `<w:ins>` tags with timestamps and author attributes.
  4. Instant download of valid `.docx` files that open natively in Microsoft Word and LibreOffice with standard **Accept** / **Reject** buttons active.
- **Hardest Part**: **Word XML Run Fragmentation**. In Microsoft Word documents, words are frequently fractured across arbitrary XML runs (`<w:r><w:t>thir</w:t></w:r><w:r><w:t>ty</w:t></w:r>`) due to prior edits, formatting spans, or spellcheck markers. A naive string search in `word/document.xml` fails or corrupts the XML tree. Resolving this required paragraph-level text reconstruction, mapping target phrases across run boundaries, and preserving existing formatting tags (`<w:rPr>`) inside the inserted and deleted blocks.

---

### 4. What We Would Build Next with More Time

1. **Dense + Sparse Hybrid Search**: Pair the current BM25 inverted keyword index with dense legal embeddings (via Qdrant / pgvector) to capture conceptual legal equivalents (e.g., matching *"hold harmless"* to *"indemnification"* without keyword overlap).
2. **Multi-Party Redline Negotiation**: Extend the OpenXML engine to support multi-party revision rounds with selectable counsel personas (e.g., *"Buyer Counsel"*, *"Vendor Legal"*) and automated fallback compromise clauses.
3. **Fine-Grained OCR Bounding-Box Overlays**: Persist word-level bounding-box geometry during ingestion for scanned PDF contracts, enabling interactive search term heatmaps directly on scanned document images.
