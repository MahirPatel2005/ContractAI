# System Architecture & Backend Data Flow

This document details the end-to-end architecture of **ContractAI**, illustrating how requests flow through the Next.js fullstack application, how the backend orchestrates retrieval, how the Large Language Model (Gemini 2.5) generates candidate legal reasoning, and how the verification engine validates citations before streaming responses to the user.

---

## 1. High-Level Architecture Diagram

```mermaid
graph TD
    subgraph Client["Frontend Client (Next.js 15 App Router)"]
        UI["User Interface (Workspace / Comparison / Redlining)"]
        Chat["ChatPanel & MultiDocumentChat (React Hooks + SSE)"]
        DocViewer["DocumentViewer (PDF.js Canvas + SVG Highlight Layer)"]
    end

    subgraph API["Next.js Server API Layer (Node.js Runtime)"]
        RouteDoc["/api/documents/upload & /api/documents"]
        RouteChat["/api/chats/[id]/messages (SSE Streaming)"]
        RouteAgent["/api/agent/research (Autonomous ReAct Loop)"]
        RouteCompare["/api/compare/chat & /api/compare/report"]
        RouteRedline["/api/redline & /api/redline/apply"]
    end

    subgraph RetrievalEngine["Retrieval & Storage Engine"]
        Storage["Local Disk Storage (.storage/documents/)"]
        Prisma["Prisma ORM Client"]
        SQLite[("SQLite / PostgreSQL Database")]
        BM25["Inverted Keyword Search Index (BM25-style scoring)"]
        Chunker["Sliding-Window Document Chunker"]
    end

    subgraph AI["Artificial Intelligence Layer"]
        PromptBuilder["Prompt Builder (Untrusted Evidence Enclosure)"]
        Gemini["Google Gemini 2.5 Flash / Pro API"]
        FallbackEngine["Deterministic Legal Synthesis Engine"]
    end

    subgraph Verification["Zero-Trust Citation Verification"]
        QuoteMatcher["Exact Verbatim Text & Punctuation Matcher"]
        OffsetResolver["Document Offset & Page Boundary Mapper"]
        CoordEngine["PDF Canvas Coordinate Bounding-Box Engine"]
    end

    %% Flow connections
    UI -->|User Question / Action| Chat
    Chat -->|POST Request / SSE Connection| RouteChat
    RouteChat --> Prisma
    Prisma --> SQLite
    RouteChat --> BM25
    BM25 --> Chunker
    Chunker --> PromptBuilder
    PromptBuilder -->|System Prompt + Structured Evidence| Gemini
    Gemini -.->|Fallback if no API key| FallbackEngine
    Gemini -->|Candidate JSON Answer + Citations| Verification
    Verification --> QuoteMatcher
    QuoteMatcher --> OffsetResolver
    OffsetResolver --> CoordEngine
    Verification -->|Verified Quotes + Offsets| RouteChat
    RouteChat -->|Server-Sent Events: status, delta, final| Chat
    Chat -->|Click Citation| DocViewer
    DocViewer -->|Draw Bounding Rectangles| UI
```

---

## 2. End-to-End Sequence Diagram: From User Input to Rendered Answer

This sequence diagram illustrates what happens the moment a user clicks **Send** in the Contract Chat:

```mermaid
sequenceDiagram
    autonumber
    actor User as User (Lawyer / Reviewer)
    participant UI as ChatPanel (Browser)
    participant API as POST /api/chats/[id]/messages
    participant DB as Prisma / SQLite DB
    participant Engine as Retrieval Engine (keyword.ts)
    participant LLM as Google Gemini 2.5 (gemini.ts)
    participant Verifier as Citation Verifier (verifier.ts)
    participant Viewer as DocumentViewer (PDF Canvas)

    User->>UI: Types "What is the liability cap and financial limit?"
    UI->>API: HTTP POST { question }
    Note over API: Rate limit check & input validation (Zod)

    API->>DB: INSERT INTO Message (role: "user")
    API->>DB: INSERT INTO Message (role: "assistant", content: "")
    API-->>UI: Establish SSE connection (text/event-stream)
    API-->>UI: data: {"type":"start", "assistantMessageId":"..."}
    API-->>UI: data: {"type":"status", "step":"locating", "message":"Scanning document..."}

    API->>DB: Load document text & metadata
    API->>Engine: retrieveChunks(docs, question)
    Note over Engine: Tokenize question, filter stopwords,<br/>score text chunks, select top-k candidates
    Engine-->>API: Returns relevant text chunks with start/end offsets

    API-->>UI: data: {"type":"status", "step":"analyzing", "message":"Synthesizing legal reasoning..."}
    API->>LLM: generateContent({ system: ANSWER_SYSTEM_PROMPT, contents: [Prompt + Evidence] })
    Note over LLM: Evaluates evidence within <evidence> tags.<br/>Produces JSON: { answer, citations: [{quote, documentId}] }
    LLM-->>API: Raw JSON response string

    API-->>UI: Stream formatted text chunks (Markdown)
    API->>Verifier: verifyCitation(evidence, candidateQuote)
    Note over Verifier: Zero-Trust Verification:<br/>1. Verbatim character search in document text<br/>2. Disambiguate repeated occurrences<br/>3. Compute exact byte offsets & page numbers
    Verifier-->>API: Verified citations array with pageNumber & offsets

    API->>DB: UPDATE Message SET content = finalAnswer, citations = [...]
    API-->>UI: data: {"type":"final", "answer": "...", "citations": [...]}
    API-->>UI: Close SSE stream

    Note over UI: UI renders Markdown with selective bolding (ChatGPT style)
    User->>UI: Clicks "Verified Clause • Page 4"
    UI->>Viewer: onSelectCitation({ pageNumber: 4, startOffset, endOffset })
    Viewer->>Viewer: Jump to Page 4 and apply glowing pulse animation (citation-highlight-active)
```

---

## 3. Core Backend Components

| Component | File Path | Primary Responsibility |
| :--- | :--- | :--- |
| **Chat Message Route** | [route.ts](file:///Users/mahir/Downloads/contract-ai/app/api/chats/%5Bid%5D/messages/route.ts) | Validates input, manages cancellation tokens, drives SSE streaming pipeline, orchestrates DB writes. |
| **System Prompts** | [prompts.ts](file:///Users/mahir/Downloads/contract-ai/lib/ai/prompts.ts) | Enforces normal-weight prose, surgical bolding, zero hallucinated facts, and JSON schema constraints. |
| **Retrieval Engine** | [keyword.ts](file:///Users/mahir/Downloads/contract-ai/lib/retrieval/keyword.ts) | BM25-inspired keyword retrieval; chunks text with 200-character overlaps and ranks passages. |
| **Gemini Client** | [gemini.ts](file:///Users/mahir/Downloads/contract-ai/lib/ai/gemini.ts) | Low-level HTTP client calling Google Generative Language API (`gemini-2.5-flash` or `gemini-2.5-pro`). |
| **Zero-Trust Verifier** | [verifier.ts](file:///Users/mahir/Downloads/contract-ai/lib/citations/verifier.ts) | Authority for quote validity; locates character offsets, normalizes whitespace, rejects invalid quotes. |
| **DOCX OpenXML Engine** | [docxXml.ts](file:///Users/mahir/Downloads/contract-ai/lib/redline/docxXml.ts) | Direct zip and XML manipulation; injects native `<w:del>` and `<w:ins>` tracked changes into Word documents. |
| **Comparison Engine** | [compare.ts](file:///Users/mahir/Downloads/contract-ai/lib/comparison/compare.ts) | Structural clause diffing, risk shifts, party advantage classification, and word-level token diffing. |
| **Agentic Loop** | [agent.ts](file:///Users/mahir/Downloads/contract-ai/lib/ai/agent.ts) | Multi-step autonomous research loop using ReAct pattern with hard execution limits. |
