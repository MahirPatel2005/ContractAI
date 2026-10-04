# ContractAI — Grounded Legal Contract Intelligence & Native Tracked Redlining

ContractAI is an enterprise-grade legal contract analysis and redlining application. Upload PDF or DOCX contracts, ask complex inquiries with streaming answers, independently verify citations against deterministic document coordinates, perform accessible side-by-side contract comparisons, and generate native Word OpenXML tracked changes.

---

## Live Deployment & Submission Links

- **GitHub Repository**: [https://github.com/MahirPatel2005/ContractAI](https://github.com/MahirPatel2005/ContractAI)
- **Live Deployed Application**: [https://contract-ai-seven.vercel.app](https://contract-ai-seven.vercel.app) *(or self-host via [Deployment Guide](docs/DEPLOYMENT.md))*
- **Demo Video Walkthrough**: [https://youtu.be/ZwOz_qI4fVE](https://youtu.be/ZwOz_qI4fVE)
- **3–5 Minute Demo Video Script**: [docs/DEMO_SCRIPT.md](docs/DEMO_SCRIPT.md) *(step-by-step cue sheet and narration)*
- **Implementation Note**: [docs/IMPLEMENTATION_NOTE.md](docs/IMPLEMENTATION_NOTE.md) *(half-page note on verification, 150-page documents, Part C, and roadmap)*
- **150-Page Contract Test Suite**: [tests/large-document.test.ts](tests/large-document.test.ts) *(monotonic offset indexing, multi-page boundary matching, and sub-10ms verification)*

---

## Visual Walkthrough & UI Screenshots

### 1. Workspace Q&A, Streaming Chat & Verified Citations
Interactive split-screen workspace with streaming ChatGPT-style legal formatting, zero-trust verification badges, and verified clause citation cards.
![Workspace Q&A and Verified Citations](docs/screenshots/01_workspace_qa_and_citations.png)

### 2. Side-by-Side Contract Comparison with Accessible Diffs
Clause-by-clause version comparison with synchronized scrolling, non-color-only diff indicators (`[+]` / `[-]`), change navigation sidebar, and legal impact risk analysis.
![Side-by-Side Contract Comparison](docs/screenshots/02_side_by_side_comparison.png)

### 3. Native Tracked-Change Word Redlining (Part C Option 1)
Plain-language edit prompts translated into surgical OpenXML `<w:del>` and `<w:ins>` revisions that survive round-trip in Microsoft Word and LibreOffice without destroying styles.
![Native Tracked-Change Redlining](docs/screenshots/03_tracked_change_redlining.png)

### 4. Autonomous Agent Document Research (Part C Option 2 Bonus)
Multi-round autonomous legal researcher invoking dynamic contract inspection tools (`list_clauses`, `get_section`, `search_document`) with a hard round limit and zero-trust final synthesis.
![Autonomous Agent Research](docs/screenshots/04_autonomous_agent_research.png)

---

## Submission Checklist

- [x] **GitHub repository**: Clean commit history, properly structured modules, no secrets.
- [x] **Live deployed application**: Vercel & Docker ready with full instructions ([DEPLOYMENT.md](docs/DEPLOYMENT.md)).
- [x] **README screenshots**: Real interface screenshots for upload, Q&A, citation highlights, comparison, and redlining.
- [x] **Local setup instructions**: Verified with Postgres, Prisma migrations, and dev server.
- [x] **Demo video walkthrough**: [https://youtu.be/ZwOz_qI4fVE](https://youtu.be/ZwOz_qI4fVE) *(script & cues: [DEMO_SCRIPT.md](docs/DEMO_SCRIPT.md))*.
- [x] **Implementation note**: Detailed half-page note on verification, 150-page scaling, and Part C ([IMPLEMENTATION_NOTE.md](docs/IMPLEMENTATION_NOTE.md)).
- [x] **No API keys committed**: `.env.local` ignored; zero secrets in git history.
- [x] **Parts A, B and selected Part C tested**: 26 automated unit/integration tests passing.
- [x] **150-page contract test**: Dedicated suite validating large contract retrieval and offset mapping.

---

## Core Features

### Part A — Foundation & Core Ingestion
- **PDF/DOCX Extraction**: Robust parsing of digital PDFs (PDF.js) and DOCX (Mammoth/OpenXML) preserving character offsets and page numbering.
- **Scanned PDF Handling**: Detects low text density and triggers OCR fallback or informs user of unreadable scans.
- **Document Library**: Full metadata tracking (format, page count, upload timestamps, and active processing status).
- **Streaming Q&A Chat**: Real-time response streaming with instant cancellation support that safely preserves partially generated content.
- **Deterministic Quote Verification**: All AI candidate quotes must be verified against source text. Quotes cannot invent page numbers or coordinates.

### Part B — Interactive Verification & Comparison
- **Interactive Citation Highlighting**: Clicking any verified citation card smoothly scrolls the document viewer to the exact physical page and centers the highlighted passage (`#citation-highlight-target`).
- **Multi-Document Cross-Contract Analysis**: Ask questions spanning multiple agreements with per-document evidence grouping and independent citation verification.
- **Side-by-Side Comparison**:
  - Version 1 on the left, Version 2 on the right.
  - Accessible diff highlights (`[+]` underline for additions, `[-]` strikethrough for deletions).
  - Synchronized scrolling keeping corresponding clauses aligned.
  - Change list navigation sidebar with jump-to-change functionality.
  - Comparative Q&A chat panel with verified quotes from both documents.
  - Impact risk analysis per change (Customer vs. Vendor advantage and risk rating).

### Part C — Advanced Implementations

#### Option 1 (Selected): Native Tracked-Change Redlining
- Plain-language edit requests (e.g. *"increase notice period to 60 days"*, *"make liability mutual"*).
- Surgical insertion of native OpenXML `<w:del>` and `<w:ins>` elements directly into the `.docx` archive.
- Preserves all original fonts, bolding, numbering, tables, headers, and footers without whole-document regeneration.
- Resulting `.docx` opens natively in Microsoft Word with individual accept/reject revision review.

#### Option 2 (Bonus): Autonomous Agent Document Researcher
- Multi-round contract investigation engine with hard iteration limit (max 6 rounds).
- Dynamic tool calling (`list_clauses`, `get_section`, `search_document`).
- Execution trace display and finalized verified synthesis with clickable citations.

---

## Zero-Trust Verification Architecture

```text
[ User Inquiry ] ───> [ LLM (Gemini) ] ───> Candidate Answer + Candidate Quotes
                                                    │
                                                    ▼
                                     [ Verifier Engine (Deterministic) ]
                                                    │
                                     ├── Canonical Normalization
                                     ├── Verbatim/Regex Haystack Match
                                     ├── Global Offset Mapping
                                     └── Monotonic Page Indexing
                                                    │
                   ┌────────────────────────────────┴────────────────────────────────┐
                   ▼                                                                 ▼
           [ Quote Verified ]                                               [ Quote Rejected ]
       Attached to final answer                                         Discarded from citations
   Clickable in UI -> Centers Page & Glows                          Preserves zero-trust integrity
```

---

## Large Document Handling (150+ Page Contracts)

- Documents are chunked into sliding windows preserving exact global character offsets.
- Retrieval retrieves only pertinent chunks, avoiding context-window saturation.
- **Safe Absence Semantics**: If retrieved chunks lack evidence, ContractAI explicitly reports:
  > *"I could not verify this from the retrieved document evidence."*
- Fully benchmarked in `tests/large-document.test.ts` across a synthetic 150-page enterprise agreement (~75,000 words).

---

## Automated Test Suite

Run the full automated test suite (26 passing tests across 6 suites):

```bash
npm test
```

Test coverage includes:
1. `tests/citations.test.ts`: Exact quotes, whitespace/case differences, line breaks, repeated quotes with `preferRanges`, page boundary quotes, and short fragment rejection.
2. `tests/chunker.test.ts`: Sliding-window offsets, page range retention, and overlap continuity.
3. `tests/large-document.test.ts`: 150-page indexing, monotonic offset verification, cross-page quotes (pages 99–100), and sub-10ms multi-quote verification.
4. `tests/compare.test.ts`: Clause-level diff generation, accessible badges, and impact analysis.
5. `tests/redline.test.ts`: Native OpenXML `<w:del>` and `<w:ins>` generation and DOCX round-trip.
6. `tests/agent.test.ts`: Hard round limits, malformed tool call rejection, and final citation verification.

---

## Local Setup

### 1. Prerequisites
- Node.js 18+
- PostgreSQL database

### 2. Installation
```bash
git clone https://github.com/MahirPatel2005/ContractAI.git
cd contract-ai
npm install
```

### 3. Environment Configuration
Create `.env.local`:
```env
DATABASE_URL="postgresql://user:password@localhost:5432/contract_ai?sslmode=disable"

GEMINI_API_KEY="your-gemini-api-key"
GEMINI_BASE_URL="https://generativelanguage.googleapis.com/v1beta"
GEMINI_MODEL="gemini-2.0-flash"
```

### 4. Database Setup & Dev Server
```bash
npx prisma migrate dev --name init
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.
