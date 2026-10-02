# ARCHITECTURE.md

## 1. Overview

ContractAI is a Next.js full-stack application.

Recommended stack:

- Next.js
- TypeScript
- React
- Tailwind CSS
- PostgreSQL
- Prisma
- Gemini
- Qdrant
- PDF.js / `pdfjs-dist`
- Mammoth for DOCX extraction
- OCR tooling for scanned PDFs

## 2. High-Level Architecture

```text
Browser
   │
   ▼
Next.js UI
   │
   ▼
Next.js Route Handlers / Server Logic
   │
   ├── Document Processing
   │      ├── PDF extraction
   │      ├── DOCX extraction
   │      ├── OCR
   │      └── normalization
   │
   ├── Retrieval
   │      ├── chunking
   │      ├── embeddings
   │      └── Qdrant
   │
   ├── AI
   │      ├── answer generation
   │      ├── streaming
   │      └── agentic loop
   │
   ├── Citation Engine
   │      ├── quote verification
   │      ├── location
   │      └── PDF coordinate mapping
   │
   └── Comparison Engine
          ├── paragraph matching
          ├── clause comparison
          └── change summaries

PostgreSQL
   ├── documents
   ├── pages
   ├── chunks
   ├── chats
   ├── messages
   └── citations

Qdrant
   └── vector embeddings + retrieval metadata
```

## 3. Document Processing Pipeline

```text
Upload
  ↓
Validate extension and MIME type
  ↓
Store temporary file
  ↓
Extract text
  ↓
Enough readable text?
  ├── yes → normalize
  └── no  → OCR
             ↓
          readable?
             ├── yes → normalize
             └── no  → failed
  ↓
Persist pages
  ↓
Create chunks
  ↓
Create embeddings
  ↓
Index Qdrant
  ↓
ready
```

## 4. Canonical Document Representation

The application should maintain both:

1. Original extracted text.
2. Normalized/searchable text.

Never replace the original text with normalized text.

Page records should preserve:

- page number,
- text,
- source offsets where possible,
- PDF text item metadata when available.

## 5. Chunking

Default approach:

- paragraph-aware chunking,
- approximately 500–800 tokens,
- approximately 100-token overlap.

Every chunk stores:

- document ID,
- page start,
- page end,
- text,
- source offsets.

## 6. Retrieval

Question:

```text
User question
   ↓
Embedding
   ↓
Qdrant search
   ↓
Top relevant chunks
   ↓
Optional reranking
   ↓
AI context
```

The retrieval layer must preserve document identity.

For multi-document questions, results remain grouped by source document.

## 7. Answer Generation

The model receives:

- user question,
- retrieved evidence,
- strict response schema,
- instructions to avoid unsupported claims.

Model output contains:

- answer,
- candidate quotes.

The model does not determine:

- citation page,
- citation offset,
- verification status.

## 8. Quote Verification

```text
Candidate quote
      ↓
normalize quote
      ↓
normalize document text
      ↓
search
      ↓
found?
 ├── no → reject/unverified
 └── yes
      ↓
map normalized position
      ↓
original offset
      ↓
page
      ↓
verified citation
```

Whitespace normalization must allow extraction differences such as line breaks becoming spaces.

## 9. Citation Highlighting

PDF.js provides text items and coordinates.

The citation engine maps the verified source range to PDF text items.

A quote can produce multiple highlight rectangles.

This supports:

- multi-line text,
- page breaks,
- multiple text items,
- repeated text.

## 10. Streaming

Use a server streaming mechanism such as Server-Sent Events or the framework's streaming response APIs.

The client must support cancellation.

Cancellation should stop further generation where possible while retaining already-received content.

## 11. Chat Persistence

Chat messages are persisted independently of the streaming transport.

A cancelled answer should still be stored as a partial assistant message.

## 12. Multi-Document Architecture

Each retrieved chunk carries:

```text
documentId
page
chunkId
text
```

The final answer can reference several documents.

Each citation must be verified against its own document.

## 13. Comparison Architecture

```text
Contract A (Base)            Contract B (Revised)
      │                               │
      ▼                               ▼
paragraphs/clauses              paragraphs/clauses
      │                               │
      └──────────────┬────────────────┘
                     ▼
             section matching
                     ▼
        structural & substantive diff
  (additions, deletions, monetary/date changes)
                     ▼
         legal impact categorization
        (who it favors & risk level)
                     ▼
        synchronised side-by-side view
                     ▼
       comparison chat with dual-doc
             quote verification
```

Features:
- Side-by-side layout with version 1 on the left and version 2 on the right.
- Accessible diff highlights (strikethrough `[-]` for deletions, underline `[+]` for insertions, icons).
- Synchronized scrolling between both panes with jump-to-change links.
- Dedicated change list / sidebar for fast navigation.
- Comparison chat panel ("What changed?", "How does this affect me?") citing verified quotes from both versions.
- Explicit impact assessment per change (who it favors, risk level, non-legal advice disclaimer).

## 14. Tracked-Change Redlining Architecture (Part C Option 1)

```text
User edit request (natural language)
                ↓
Locate target clause & formulate revision
                ↓
Preview proposed insertion/deletion
                ↓
Parse original DOCX ZIP archive
                ↓
Traverse word/document.xml (<w:p>, <w:r>, <w:t>)
                ↓
Inject Word OpenXML tracked changes:
  <w:del w:author="ContractAI"><w:r><w:delText>old</w:delText></w:r></w:del>
  <w:ins w:author="ContractAI"><w:r><w:t>new</w:t></w:r></w:ins>
                ↓
Preserve all fonts, tables, styles, and XML attributes
                ↓
Repack DOCX archive & download
```

Key principles:
- **Zero reformatting:** Only the targeted text is modified; original document styles, numbering, tables, and headers remain untouched.
- **True native tracked changes:** Opens in Microsoft Word and LibreOffice with standard accept/reject revision controls.
- **Multi-fragment support:** Handles text split across formatted runs.

*(Note: Autonomous Agentic Research with Option 2 tools search_document, get_section, list_clauses is retained as a bonus capability in the Workspace.)*

## 15. Failure Handling

Failures should be explicit:

- unsupported file,
- extraction failure,
- OCR failure,
- indexing failure,
- model failure,
- timeout,
- malformed tool call,
- citation verification failure.

Never silently convert a failed operation into successful output.

## 16. Deployment

Recommended:

- Vercel for Next.js.
- Managed PostgreSQL.
- Qdrant Cloud.
- Gemini API.

Environment-specific secrets must remain outside source control.
