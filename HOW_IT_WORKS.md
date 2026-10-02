# ContractAI: System Architecture, Technology Stack & Implementation Guide

This document provides a comprehensive, end-to-end technical explanation of **ContractAI**—detailing what technologies are used, which database was chosen and why, how the AI and verification pipelines work, how DOCX OpenXML tracked changes are generated, and the architectural rationale behind every design decision.

---

## 1. Executive Summary & Core Philosophy

ContractAI is an enterprise-grade legal contract analysis, comparison, and redlining platform built with Next.js 15, TypeScript, PostgreSQL, and Prisma.

### The Fundamental Rule: Zero-Trust AI Quotes
In traditional AI applications, an LLM is asked to output an answer and tell the user which page or section the quote came from. In legal contracts, this approach fails catastrophically because LLMs frequently hallucinate page numbers, invent subtle rewordings, or blend separate clauses.

In ContractAI:
> **The AI generates candidate answers and candidate quotes.**  
> **Application code is the sole authority for quote existence, location, page number, offsets, and citation verification.**

If an AI claims a quote exists, deterministic code scans the stored, immutable source text. If the quote does not exist character-for-character (tolerating only harmless whitespace and hyphenation differences), the quote is **rejected**. The application calculates offsets and page numbers directly from stored document coordinates—**never** from the AI.

---

## 2. Technology Stack & Component Breakdown

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                             FRONTEND (Next.js 15)                           │
│  React 19 • TypeScript (Strict) • Tailwind CSS • Server-Sent Events (SSE)   │
│  - DocumentViewer: PDF/DOCX render, page navigation, golden glow highlights │
│  - ChatPanel: Token streaming, cancellation, verified citation cards        │
│  - ContractComparison: Side-by-side sync scroll, accessible diffs, chat     │
│  - RedlinePanel: In-place DOCX tracked-change preview & download            │
│  - MultiDocumentChat: Cross-contract queries with source attribution        │
└──────────────────────────────────────┬──────────────────────────────────────┘
                                       │ HTTP / REST / SSE Stream
┌──────────────────────────────────────▼──────────────────────────────────────┐
│                              API ROUTE HANDLERS                             │
│  /api/documents/*  •  /api/chats/*  •  /api/compare/*  •  /api/redline/*    │
└──────────────────┬───────────────────┬───────────────────┬──────────────────┘
                   │                   │                   │
┌──────────────────▼──┐   ┌────────────▼─────────┐   ┌─────▼──────────────────┐
│     DATABASE        │   │     AI PIPELINE      │   │   FILE ENGINE & DIFF   │
│ PostgreSQL 14 (5433)│   │ Gemini 2.0 Flash /   │   │ - pdf-parse / docx     │
│ Prisma ORM 6.19     │   │ Legal Synthesis      │   │ - adm-zip / @xmldom    │
│ ACID Relational     │   │ - Verifier Engine    │   │ - OpenXML redlining    │
│ Foreign Keys & Cast │   │ - Multi-round Agent  │   │ - Clause alignment     │
└─────────────────────┘   └──────────────────────┘   └────────────────────────┘
```

### Full Stack Breakdown:

| Layer | Technology | Version | Purpose |
| :--- | :--- | :--- | :--- |
| **Framework** | Next.js (App Router) | 15.2.4 | Server-side rendering, streaming API routes, Node.js runtime |
| **Language** | TypeScript | 5.8 | End-to-end type safety, strict null checks, interface contracts |
| **Styling** | Tailwind CSS | 4.1 | Custom design system, responsive layouts, accessible diff tokens |
| **Database** | PostgreSQL | 14.x | Relational storage, foreign-key integrity, transactional consistency |
| **ORM** | Prisma ORM | 6.19 | Declarative schema migrations, type-safe queries, relation mapping |
| **AI Provider** | Google Gemini API | 2.0 Flash | Structured JSON generation, autonomous tool-use (function calling) |
| **Fallback AI** | Legal Synthesis Engine | Custom | Deterministic, structured legal reasoning when offline |
| **PDF Extraction**| `pdf-parse` | 1.1.1 | Page-level text extraction and bounding offset mapping |
| **DOCX Extraction**| `mammoth` | 1.9.1 | Document paragraph, table, and structure extraction |
| **XML & ZIP** | `adm-zip` & `@xmldom/xmldom`| 0.5.16 / 0.9.14 | In-place Word OpenXML tracked change (`<w:del>`, `<w:ins>`) manipulation |
| **Validation** | Zod | 3.24 | Server-side input validation, API body and tool-call schema enforcement |
| **Testing** | Vitest | 2.1 | Fast unit and integration tests (citations, chunker, diff, redline, agent) |

---

## 3. Which Database is Used and Why Prisma?

### Which Database?
ContractAI runs on **PostgreSQL 14** (locally configured on port `5433` with database name `contract_ai`).

### Why PostgreSQL?
1. **Strict Relational Integrity:** Legal contracts have deep relational hierarchies:
   - A `Document` owns multiple `Pages` and `Chunks`.
   - A `Document` owns multiple `Chats`.
   - A `Chat` owns ordered `Messages`.
   - A `Message` owns verified `Citations`.
   - A `Citation` strictly points back to a physical `Document`.
   Using a relational database with foreign key constraints (`ON DELETE CASCADE`) ensures that if a document is deleted, all orphan chunks, citations, and chats are safely purged.
2. **ACID Transactions:** When a user uploads a contract, the document record, page offsets, and 50–200 chunks must be inserted atomically. If text extraction fails midway, the transaction rolls back cleanly without leaving corrupted states.
3. **Auditability:** Legal software requires deterministic audit trails. PostgreSQL supports structured timestamping and indexed relational queries for compliance logs.

### Why Prisma ORM?
1. **End-to-End Type Safety:** When the Prisma schema changes, running `prisma generate` immediately generates TypeScript definitions. If a route tries to access an invalid property on a `Citation` or `Document`, the TypeScript compiler flags it at build time.
2. **Declarative Migrations (`prisma migrate dev`):** Schema changes are tracked in version-controlled SQL migration scripts (`prisma/migrations/20261001152645_init/migration.sql`), ensuring identical database structures across development, testing, and production.
3. **Protection Against SQL Injection:** Prisma uses parameterized queries under the hood, completely eliminating SQL injection vulnerabilities without requiring manual sanitization.
4. **Clean Relational Queries:** Complex nested queries—such as loading a chat session along with its ordered messages and verified citations—are written cleanly without error-prone SQL `JOIN` boilerplate:
   ```ts
   const chat = await prisma.chat.findUnique({
     where: { id: chatId },
     include: {
       messages: {
         include: { citations: true },
         orderBy: { createdAt: "asc" }
       }
     }
   });
   ```

---

## 4. How the AI Works: Dual-Engine & Verification Pipeline

ContractAI utilizes a **hybrid AI architecture** that pairs Google's **Gemini 2.0 Flash** with a deterministic **Citation Verifier** and an **Intelligent Offline Legal Synthesis Engine**.

### 1. Zero-Trust Verification Pipeline

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ 1. USER ASKS QUESTION: "What is the liability cap?"                         │
└──────────────────────────────────────┬──────────────────────────────────────┘
                                       │
┌──────────────────────────────────────▼──────────────────────────────────────┐
│ 2. RETRIEVAL: keyword.ts retrieves top relevant 1500-char chunks           │
└──────────────────────────────────────┬──────────────────────────────────────┘
                                       │
┌──────────────────────────────────────▼──────────────────────────────────────┐
│ 3. MODEL GENERATION: Gemini (or synthesis.ts) produces:                     │
│    - answer: "The aggregate liability is capped at $5,000,000..."           │
│    - candidate citations: [{ quote: "The aggregate liability of either..."}]│
└──────────────────────────────────────┬──────────────────────────────────────┘
                                       │
┌──────────────────────────────────────▼──────────────────────────────────────┐
│ 4. DETERMINISTIC VERIFIER (verifier.ts):                                    │
│    - Normalize quote & document text (collapse whitespace/hyphens)          │
│    - Search stored document text for exact character match                  │
│    - Locate exact startOffset (448) and endOffset (560)                     │
│    - Lookup page number from page boundary offsets (Page 1)                 │
│    - Disambiguate duplicate occurrences using chunk proximity               │
└──────────────────────────────────────┬──────────────────────────────────────┘
                                       │
                     ┌─────────────────┴─────────────────┐
                     ▼                                   ▼
        [Quote Found in Text]                 [Quote Not Found in Text]
                     │                                   │
      Mark citation verified: true                Drop citation & increment
      Attach real page & offsets                  rejectedCitationCount
                     │                                   │
                     └─────────────────┬─────────────────┘
                                       │
┌──────────────────────────────────────▼──────────────────────────────────────┐
│ 5. FINAL ANSWER RENDERED IN UI:                                             │
│    - Synthesized legal reasoning displayed in message box                   │
│    - Interactive green "✓ Verified • Page 1" citation cards                 │
│    - Clicking card scrolls viewer and triggers golden glow highlight        │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 2. Live AI Mode: Gemini 2.0 Flash
When `GEMINI_API_KEY` is present in `.env.local`:
- Next.js calls `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent`.
- **System Instructions (`prompts.ts`):** Enforces that the model provides comprehensive legal reasoning and commercial explanations, strictly prohibiting raw quote dumps.
- **Strict JSON Output:** Constrained to `{"answer": string, "insufficientEvidence": boolean, "citations": [{"documentId": string, "quote": string}]}`.
- **Untrusted Evidence Boundary:** Document text is passed inside `<evidence>` tags and treated as untrusted data to prevent prompt injection.

### 3. Local/Offline Legal Synthesis Engine (`lib/ai/synthesis.ts`)
If no API key is configured or the AI provider experiences rate-limiting:
- The system automatically engages `synthesizeLegalAnswer`.
- It decomposes the document into clauses (Scope, Fees, Liability, Termination, Confidentiality, Governing Law).
- For contract summaries, it structures an **Executive Contract Summary** detailing:
  - Commercial context & relationship
  - Core provisions and obligations
  - Legal assessment and risk posture
- For specific inquiries (e.g. Liability, Termination, Invoicing), it formulates substantive legal analysis explaining *how* the clause operates, its *commercial rationale*, and *procedural requirements*.
- Extracts verbatim contract sentences and submits them to `verifier.ts`, ensuring **100% verified citations** even in offline mode.

---

## 5. Document Processing: PDF & DOCX Engine

### Upload Validation (`lib/documents/validator.ts`)
- **Magic Number File Signature:** Inspects the first 4 bytes of uploaded buffers (`%PDF` for PDF, `PK\x03\x04` for DOCX). File extension spoofing (e.g. renaming an `.exe` to `.pdf`) is blocked.
- **Size Limit:** Strict 25 MB ceiling enforced server-side.
- **Storage:** Binary files are written to local disk under `.storage/documents/{id}.{ext}` while text and metadata are stored in PostgreSQL.

### Text Extraction & Page Tracking
- **PDFs (`lib/documents/pdf.ts`):** Page boundaries are preserved during extraction. The character start and end offset of every physical page is recorded in the `Page` table.
- **Scanned PDF Detection:** If a PDF has 1 or more pages but fewer than 10 total text characters, it is recognized as a flattened image scan. Instead of falsely saving success, the document is flagged as `failed` with a clear message: `"This PDF appears to be a scanned image without a text layer."`
- **Chunking Strategy (`lib/retrieval/chunker.ts`):** Document text is sliced into 1500-character chunks with a 200-character overlap. Each chunk stores its exact `startOffset`, `endOffset`, `pageStart`, and `pageEnd`.

---

## 6. Tracked-Change Redlining Architecture (Part C: Option 1)

Most AI document tools fail at redlining because they convert a Word document into Markdown/HTML, edit it, and convert it back. This destroys fonts, custom styles, letterheads, numbering schemes, and nested tables.

ContractAI implements the **Zero-Reformatting OpenXML Engine** (`lib/redline/docxXml.ts`):

```
                        ORIGINAL .DOCX (ZIP ARCHIVE)
                                     │
                             Unzip in-memory
                                     │
                             word/document.xml
                                     │
           ┌─────────────────────────┴─────────────────────────┐
           ▼                                                   ▼
Existing Paragraph (<w:p>)                           Run Properties (<w:rPr>)
Contains runs with font, bold, color                 Captured and strictly cloned
           │                                                   │
           ▼                                                   │
Surgical Replacement                                           │
1. Locate target text inside <w:t> nodes                       │
2. Replace with <w:del> containing <w:delText> ◄───────────────┤ (Applies original
3. Inject <w:ins> containing revised <w:t>     ◄───────────────┘  font & styling)
4. Add author="ContractAI" and date="2026-10-02T..."
           │
           ▼
Re-zip archive with all original styles.xml, numbering.xml, theme1.xml untouched
                                     │
                        NATIVE TRACKED-CHANGE .DOCX
      (Opens in Microsoft Word & LibreOffice with Accept/Reject buttons)
```

### Key Technical Properties:
1. **Native OpenXML Tags:** Outputs standard `<w:del>` and `<w:ins>` tags specified by ISO/IEC 29500 OpenXML.
2. **Interactive Accept/Reject:** When opened in Microsoft Word or LibreOffice, each change appears highlighted in the margin with author timestamp and can be accepted or rejected individually.
3. **Format Preservation:** The original run properties `<w:rPr>` (fonts, bold, italics, font size) are cloned onto the `<w:del>` and `<w:ins>` runs. Unrelated paragraphs are never re-serialized.

---

## 7. Document Comparison & Visual Diff Engine

The comparison engine (`lib/diff/compare.ts` and `components/ContractComparison.tsx`) provides side-by-side contrast between two contracts:

1. **Clause & Sentence Alignment:** Breaks both contracts into logical clauses, aligning matching sections and identifying additions, deletions, and modifications.
2. **Accessible Visual Diffs:** Changes are never communicated by color alone:
   - **Deletions:** Strikethrough text with red tint and `[-]` badge.
   - **Additions:** Underlined text with emerald tint and `[+]` badge.
   - **Modifications:** Amber tint with `[~]` badge.
3. **Synchronized Dual-Pane Scrolling:** Scrolling either the left (V1) or right (V2) pane automatically mirrors position on the counterpane. Clicking any item in the Change List sidebar smoothly scrolls both panes to that exact clause.
4. **Numeric & Financial Change Extraction:** Explicit regex scanners detect changes in monetary caps (`$1,000,000` → `$5,000,000`), percentages (`1.5%` → `2.0%`), and day timelines (`30 days` → `60 days`).
5. **Comparison Chat (`/api/compare/chat`):** A dedicated chat interface that answers questions like *"How do the liability caps compare?"* by citing verified quotes from both contract versions simultaneously.

---

## 8. Autonomous Legal Researcher (Bonus: Option 2)

Integrated under the **Bonus** tab in the chat panel, the autonomous research agent (`lib/ai/agent.ts`) executes multi-round reasoning:

- **Hard Round Limit (5 Rounds):** To prevent infinite loops and runaway API costs, the server strictly limits tool execution to 5 rounds. On round 5, tool declarations are withdrawn, forcing the model to produce a final answer.
- **Contract Tools:**
  1. `search_document`: Keyword-based chunk retrieval.
  2. `get_section`: Direct lookup of numbered sections (e.g. "Section 3" or "Clause 12").
  3. `list_clauses`: Regex extraction of all section headings and table-of-contents markers.
- **Live Execution Step Feed:** Steps are streamed via SSE to the UI, rendering interactive cards (`R1`, `R2`, ...) displaying the action title, tool invoked, arguments, and result summary.
- **Verification Guarantee:** The agent's final synthesis is routed through `finalizeAnswer`, guaranteeing that agentic answers must pass the exact same zero-trust quote verification as standard chat.

---

## 9. Streaming, Cancellation & UI State Management

### Server-Sent Events (SSE)
Standard REST APIs block until the full answer is generated. ContractAI uses `ReadableStream` and Server-Sent Events (`text/event-stream`):
- Tokens stream in real time with an animated typewriter effect.
- Citation cards and done markers stream as soon as verification completes.

### Cooperative Cancellation
When a user clicks the **■ Stop** button:
1. The frontend aborts the active `fetch` via `AbortController.abort()`.
2. A lightweight signal is posted to `/api/chats/:id/cancel`.
3. The server cancellation registry (`lib/chat/cancellation.ts`) signals the streaming loop.
4. The generation halts immediately, and the tokens generated up to that moment are preserved in PostgreSQL with a `cancelled: true` marker, preventing loss of partial work.

---

## 10. Summary of Architectural Decisions

| Decision | Why It Was Made |
| :--- | :--- |
| **Never trust AI page numbers** | LLMs hallucinate coordinates. Page numbers and offsets must be derived deterministically from stored text boundaries. |
| **OpenXML in-place redlining** | Converting DOCX to HTML and back destroys Word formatting. Editing raw XML runs preserves 100% of formatting. |
| **PostgreSQL + Prisma** | Relational integrity and cascade deletes ensure orphan citations or chunks are never left behind. |
| **Accessible diff indicators** | Users with visual impairments or black-and-white displays cannot distinguish red/green colors; `[-]`, `[+]`, and strikethroughs make diffs universally accessible. |
| **Dual-engine (Gemini + Local Synthesis)** | Enables rich cloud LLM generation while guaranteeing that local development, offline demos, and test suites operate with deep legal reasoning. |
