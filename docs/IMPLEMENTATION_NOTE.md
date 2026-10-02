# ContractAI — Implementation Note
**Document-Grounded Legal Intelligence: Verification, Large Documents, Part C & Roadmap**

---

### 1. Verification Philosophy & Architecture
In ContractAI, the foundational engineering premise is **Zero-Trust AI Verification**: the Large Language Model is treated strictly as an inference engine for generating candidate answers and candidate quotes—it is never trusted as the authority for document truth, page numbers, or character offsets.

1. **Deterministic Ground-Truth Pipeline**:
   - When the model returns a response, every cited passage is extracted and passed to the deterministic verification engine (`lib/citations/verifier.ts`).
   - The candidate quote undergoes canonical normalization: whitespace collapsing, smart/curly quote standardization, and punctuation trimming, while retaining a reverse character-mapping index to the raw document text.
2. **Global Offset & Page Resolution**:
   - The engine searches the verified full-text representation of the document stored during initial ingestion.
   - Offsets are calculated at the character level and intersected with the document's monotonic page index (`lib/citations/locator.ts`), accurately attributing text to its genuine source page—including quotes that span physical page boundaries.
   - When duplicate provisions occur (e.g., standard boilerplate), the verifier utilizes `preferRanges` (derived from the retrieved context chunks) to disambiguate the exact clause examined.
3. **Zero Hallucination Toleration**:
   - If a candidate quote cannot be matched verbatim in the source document, or if it is too short to prove evidentiary value (<12 characters), it is unconditionally rejected and excluded from the verified citation payload.

---

### 2. Large Document Strategy (150+ Page Contracts)
Analyzing full enterprise agreements (master services agreements, credit facilities, lease deeds) spanning 100 to 150+ pages presents two critical engineering challenges: context window saturation and false global assertions.

1. **Chunking with Offset Fidelity**:
   - Documents are ingested, extracted, and segmented into overlapping lexical chunks (`lib/documents/chunker.ts`).
   - Every chunk preserves strict `startOffset`, `endOffset`, `pageStart`, and `pageEnd` metadata corresponding to the original document. No chunk boundary loses its relationship to the underlying document coordinates.
2. **Safe Absence Semantics**:
   - A known failure mode of standard RAG systems is claiming a provision does not exist solely because it was absent from the top-$k$ retrieved chunks.
   - ContractAI implements strict safe-absence guardrails: when retrieved evidence does not contain proof of a requested term, the system explicitly reports:
     > *"I could not verify this from the retrieved document evidence."*
   - It never fabricates an ungrounded negative claim without exhaustive full-document scanning.
3. **Validated at Scale**:
   - The test suite includes a dedicated 150-page enterprise contract verification test (`tests/large-document.test.ts`), benchmarking chunking coverage, monotonic page tracking, and sub-10ms quote verification across pages 1 through 150.

---

### 3. Part C Challenge: Native Tracked-Change Redlining
ContractAI implements **Part C Option 1 (Tracked-Change Redlining)**, providing attorneys and contract managers with native OpenXML Word revisions.

1. **Surgical OpenXML Manipulation**:
   - Rather than regenerating documents or outputting plain text diffs, ContractAI unpacks the `.docx` archive and parses the underlying `word/document.xml`.
   - Plain-language edit requests (e.g., *"increase notice period to 60 days"*, *"make liability mutual"*) are translated into surgical replacements that wrap deleted text in `<w:del>` and inserted text in `<w:ins>` tags with author and timestamp attributes.
2. **Styling & Structure Preservation**:
   - Because only the affected text runs are modified, all original document styles, font families, paragraph numbering, custom margins, headers, footers, and complex tables survive intact.
   - The resulting file opens natively in Microsoft Word and LibreOffice, allowing attorneys to review, accept, or reject each change individually using standard tracked changes workflows.
3. **Bonus Implementation (Part C Option 2)**:
   - ContractAI additionally includes the **Autonomous Agentic Document Researcher** (`lib/ai/agent.ts`), which dynamically inspects clauses, reads sections, performs iterative multi-round contract investigation up to a hard limit, and outputs verified synthesized findings with interactive document links.

---

### 4. Next Steps & Production Roadmap
1. **Hybrid Vector & Lexical Retrieval**:
   - Connect the dedicated Qdrant vector store adapter (`lib/retrieval/`) to pair BM25 keyword matching with dense legal embeddings for enhanced semantic clause retrieval.
2. **High-Resolution OCR Bounding Boxes**:
   - Enhance the PDF parser to persist word-level bounding box coordinates (`x, y, w, h`) during ingestion, enabling pixel-accurate visual overlays on scanned contracts and multi-column tables.
3. **Multi-Party Redline Negotiation**:
   - Extend the redlining engine to support multi-party round-tripping with configurable revision author personas (e.g., "Buyer Counsel", "Vendor Legal") and automated fallback clauses.
