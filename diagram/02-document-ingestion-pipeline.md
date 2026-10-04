# 2. Document Ingestion Flowchart

This flowchart shows how contracts (PDF and Word documents) are uploaded, checked for security, converted into searchable text, and indexed for fast search.

---

## Visual Flowchart

![2. Document Ingestion Flowchart](./02-document-ingestion-pipeline.svg)

---

## Mermaid Diagram Code

```mermaid
flowchart TD
    %% 1. Upload
    A["👤 User Drops Contract File<br/>(PDF or Word DOCX)"] --> B["📤 Upload Endpoint<br/>(POST /api/documents/upload)"]

    %% 2. Security Check
    B --> C{"🛡️ Security Checks"}
    C -->|Size > 50MB or Bad File| D["❌ Reject Upload<br/>Show error message"]
    C -->|Valid PDF or DOCX| E["💾 Save Raw File to Disk<br/>(.storage/documents/)"]

    %% 3. Status
    E --> F["📝 Create Database Record<br/>Status set to 'Processing'"]

    %% 4. Text Extraction
    F --> G{"Determine File Type"}
    
    G -->|PDF File| H["📄 PDF Text Extractor<br/>• Extracts all text page-by-page<br/>• Records character start & end for each page<br/>• Saves (x, y) coordinates for each word"]
    
    G -->|DOCX Word File| I["📑 Word DOCX Extractor<br/>• Unzips document.xml<br/>• Extracts paragraphs and text runs<br/>• Estimates page count based on length"]

    %% 5. Chunking
    H --> J["✂️ Document Chunker<br/>Splits text into 1,000-character blocks<br/>with 200-character overlap"]
    I --> J

    %% 6. Indexing
    J --> K["🔍 Inverted Keyword Indexer<br/>• Removes common stopwords<br/>• Builds fast search index for keywords"]

    %% 7. Ready
    K --> L["✅ Mark Document as 'Ready'<br/>Database updated with full text and page count"]
    L --> M["🖥️ Document Opens in Workspace<br/>Ready for reading, search, and AI Q&A"]

    %% Styling
    classDef startNode fill:#e0e7ff,stroke:#4338ca,stroke-width:2px,color:#1e1b4b;
    classDef checkNode fill:#fef3c7,stroke:#d97706,stroke-width:2px,color:#78350f;
    classDef errNode fill:#fee2e2,stroke:#dc2626,stroke-width:2px,color:#991b1b;
    classDef processNode fill:#f1f5f9,stroke:#475569,stroke-width:2px,color:#0f172a;
    classDef successNode fill:#d1fae5,stroke:#059669,stroke-width:2px,color:#064e3b;

    class A,B startNode;
    class C,G checkNode;
    class D errNode;
    class E,F,H,I,J,K processNode;
    class L,M successNode;
```

---

## Step-by-Step Breakdown

1. **User Uploads File**: Drag-and-drop a PDF or Word document into the library.
2. **Security & Validation**: Checks file size (max 50 MB) and verifies the file header so executables or corrupted files are immediately rejected.
3. **Save to Storage**: The original contract is safely stored in local disk storage.
4. **Text & Page Coordinate Extraction**:
   - For **PDF**: Reads text page-by-page and stores word coordinates so highlights can be drawn later.
   - For **DOCX**: Unzips the Word XML package and extracts text paragraphs.
5. **Sliding-Window Chunking**: Splits large documents into small 1,000-character chunks with overlap so no sentences or clauses get cut in half.
6. **Search Indexing**: Prepares a fast search index so questions find matching clauses in milliseconds.
7. **Ready for Use**: The document is marked "Ready" and opens in the viewer.
