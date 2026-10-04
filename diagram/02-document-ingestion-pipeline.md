# Document Ingestion, Parsing & Coordinate Mapping Pipeline

This document explains how user-uploaded contracts (PDF and DOCX) are ingested, validated, parsed into character streams, mapped to physical page coordinates, chunked, and indexed for instantaneous retrieval.

---

## 1. Document Ingestion Flowchart

```mermaid
flowchart TD
    A["User Uploads Contract File<br/>(Drag-and-Drop PDF / DOCX)"] --> B["Upload Endpoint<br/>(POST /api/documents/upload)"]

    subgraph SecurityValidation["Security & Format Validation"]
        B --> C["Rate Limiting Check<br/>(max 20 uploads / 10 min)"]
        C --> D["File Size Guard<br/>(max 50 MB limit)"]
        D --> E["Magic Byte Header Sniffing<br/>(%PDF-1.x or PK\x03\x04)"]
        E -->|Invalid or Executable| F["HTTP 400 Bad Request<br/>Reject Upload"]
    end

    E -->|Valid Contract| G["Persist Raw File to Disk<br/>(.storage/documents/[docId].[ext])"]
    G --> H["Create DB Record in Prisma<br/>(status: 'processing')"]

    subgraph ParsingEngine["Text & Coordinate Extraction Engine"]
        H --> I{"Determine File Type"}
        
        I -->|PDF Document| J["PDF Extraction (pdf.js)<br/>lib/documents/pdf.ts"]
        J --> J1["Extract Plaintext Page by Page"]
        J --> J2["Record Page Offsets<br/>pageBoundaries: [{page, startOffset, endOffset}]"]
        J --> J3["Extract Glyph Coordinates<br/>boxes: [{char, x, y, width, height}]"]

        I -->|DOCX Document| K["DOCX Extraction (OpenXML)<br/>lib/documents/docx.ts"]
        K --> K1["Unzip word/document.xml with JSZip"]
        K --> K2["Extract Text Runs (<w:t>) & Paragraphs (<w:p>)"]
        K --> K3["Estimate Page Boundaries via Paragraph Word Count"]
    end

    J1 & J2 & J3 --> L["Aggregate Document Text & Page Map"]
    K1 & K2 & K3 --> L

    subgraph ChunkingAndIndexing["Sliding-Window Chunking & Keyword Indexing"]
        L --> M["Sliding-Window Chunker<br/>(lib/documents/chunker.ts)"]
        M --> M1["Window Size: 1,000 chars<br/>Overlap: 200 chars"]
        M --> M2["Assign Offsets to Every Chunk<br/>(chunk.startOffset, chunk.endOffset)"]
        M --> N["Inverted Keyword Indexer<br/>(lib/retrieval/keyword.ts)"]
        N --> N1["Tokenize, Lowercase & Strip Punctuation"]
        N --> N2["Filter Common Legal Stopwords"]
        N --> N3["Build In-Memory Term-Frequency Map"]
    end

    N3 --> O["Update DB Record in Prisma<br/>(status: 'ready', fullText, pageCount)"]
    O --> P["Emit Ready Event to Client UI"]
```

---

## 2. Character Offset & Page Coordinate Architecture

A critical architectural feature of ContractAI is that **every single character in a contract has a deterministic global offset `[0 ... N]`**. This enables sub-millisecond conversion between plain text quotes, database search chunks, and physical visual boxes on a PDF canvas.

```mermaid
graph LR
    subgraph Stream["Continuous Document Stream (0 to N characters)"]
        Offset0["Offset 0<br/>'THIS AGREEMENT...'"]
        Offset1420["Offset 1,420<br/>'Page 2 starts...'"]
        Offset3890["Offset 3,890<br/>'Section 4. Termination...'"]
    end

    subgraph PageMap["Page Boundary Map (Document.pageBoundaries)"]
        P1["Page 1: [0, 1419]"]
        P2["Page 2: [1420, 3889]"]
        P3["Page 3: [3890, 6200]"]
    end

    subgraph Chunks["Retrieval Chunks (keyword.ts)"]
        C1["Chunk 1: [0, 1000]"]
        C2["Chunk 2: [800, 1800]"]
        C3["Chunk 3: [1600, 2600]"]
    end

    Offset0 --> P1
    Offset1420 --> P2
    Offset3890 --> P3

    Offset0 --> C1
    Offset1420 --> C2
    Offset3890 --> C3
```

### Why Character Offsets Matter for Citation Accuracy:
1. **Zero Guesswork**: The LLM is never allowed to guess page numbers. When the LLM quotes `"thirty (30) days"`, the backend locates the quote at character offset `3,912`.
2. **Deterministic Page Resolution**: By binary-searching the `pageBoundaries` array, offset `3,912` immediately maps to **Page 3** with mathematical certainty.
3. **Canvas Highlight Sync**: The PDF viewer matches offset `3,912` to the extracted glyph coordinate boxes `(x, y, w, h)` and paints the glowing yellow-gold bounding rectangle at the exact millimeter on screen.

---

## 3. Security & Validation Rules

To prevent malicious uploads and maintain regulatory compliance, the ingestion pipeline enforces strict defense-in-depth rules:

```mermaid
graph TD
    UploadReq["Incoming Upload Request"] --> CheckSize{"Content-Length > 50MB?"}
    CheckSize -->|Yes| ErrSize["Reject: PAYLOAD_TOO_LARGE (413)"]
    CheckSize -->|No| CheckExt{"File Extension in [.pdf, .docx]?"}
    CheckExt -->|No| ErrExt["Reject: INVALID_FILE_TYPE (400)"]
    CheckExt -->|Yes| SniffHeader{"Magic Bytes Valid?"}
    
    SniffHeader -->|PDF Header: '%PDF-'| ProcessPDF["Proceed to PDF Parser"]
    SniffHeader -->|DOCX Header: 'PK\x03\x04'| ProcessDOCX["Proceed to DOCX Parser"]
    SniffHeader -->|Executable or Disguised File| ErrMagic["Reject: INVALID_FILE_CONTENT (400)"]
```

---

## 4. Source Code Cross-References

- **Upload Handler**: [app/api/documents/upload/route.ts](file:///Users/mahir/Downloads/contract-ai/app/api/documents/upload/route.ts)
- **PDF Extraction**: [lib/documents/pdf.ts](file:///Users/mahir/Downloads/contract-ai/lib/documents/pdf.ts)
- **DOCX Extraction**: [lib/documents/docx.ts](file:///Users/mahir/Downloads/contract-ai/lib/documents/docx.ts)
- **Chunking Engine**: [lib/documents/chunker.ts](file:///Users/mahir/Downloads/contract-ai/lib/documents/chunker.ts)
- **Storage Layer**: [lib/documents/storage.ts](file:///Users/mahir/Downloads/contract-ai/lib/documents/storage.ts)
