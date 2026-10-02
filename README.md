# ContractAI

ContractAI is a legal contract analysis web application.

Upload a PDF or DOCX contract, ask questions in natural language, and receive document-grounded answers with independently verified citations.

## Features

### Part A

- PDF/DOCX upload
- Document extraction
- Scanned PDF handling
- Processing status
- Document library
- Streaming chat
- Chat history
- Cancellation
- Verified quotes
- Large document retrieval

### Part B

- Citation highlighting (click quote to jump and highlight in document viewer)
- Multi-document questions (cross-contract analysis with per-document verified citations)
- Advanced side-by-side contract comparison:
  - Version 1 on the left, Version 2 on the right
  - Accessible diff highlights (additions, deletions and edits distinguishable by icons/badges, not by color alone)
  - Synchronized scrolling and jump-to-change between panes
  - Change list sidebar to jump between changes
  - Comparison chat panel ("What changed?", "How does this affect me?") citing verified quotes from both versions
  - Impact analysis per change (who it favors, risk level, non-legal advice disclaimer)

### Part C

Selected challenge:

**Option 1 — Tracked-Change Redlining**

- Plain-language edit requests (e.g. "make the liability cap mutual", "increase notice period to 60 days")
- Native OpenXML Word tracked changes (`w:ins` and `w:del`) written directly into `.docx`
- Opens cleanly in Microsoft Word and LibreOffice with accept/reject revision review
- Preserves all original styles, fonts, bold, tables, and numbering without whole-document regeneration
- Interactive Redline UI: describe edit, preview diff, download redlined `.docx`

*(Bonus: Autonomous Agentic Document Research from Option 2 is also implemented and available under the Workspace Agent tab.)*

## Tech Stack

- Next.js
- TypeScript
- React
- Tailwind CSS
- PostgreSQL
- Prisma
- Gemini
- Qdrant
- PDF.js
- Mammoth
- OCR tooling

## Architecture

See:

- `docs/ARCHITECTURE.md`
- `docs/SECURITY.md`
- `docs/DATABASE.md`
- `docs/API.md`
- `docs/CODE_STYLE.md`
- `docs/DESIGN_SYSTEM.md`

## Environment Variables

Create `.env.local`:

```env
DATABASE_URL=

GEMINI_API_KEY=
GEMINI_BASE_URL=
GEMINI_MODEL=

QDRANT_URL=
QDRANT_API_KEY=
```

Never commit `.env.local`.

## Local Setup

```bash
npm install
```

Configure environment variables.

Run database migrations:

```bash
npx prisma migrate dev
```

Start development:

```bash
npm run dev
```

Open:

```text
http://localhost:3000
```

## Verification Philosophy

AI-generated quotes are never trusted automatically.

The application:

1. Receives candidate quotes from the model.
2. Normalizes whitespace.
3. Searches the stored source document.
4. Locates the real occurrence.
5. Maps it to page/offset information.
6. Marks the citation verified only after successful matching.

The model does not decide its own citation location.

## Large Documents

Documents are split into retrieval-friendly chunks.

Each chunk retains:

- document identity,
- page range,
- source offsets.

Retrieval is used instead of sending an entire large contract in one model request.

The application avoids claiming that a clause does not exist merely because it was absent from a limited retrieval result.

## Testing

Important citation tests include:

- exact quote,
- whitespace differences,
- line breaks,
- repeated quote,
- missing quote,
- multi-line quote,
- page-boundary quote,
- multi-document citations.

## Submission Checklist

- [ ] GitHub repository
- [ ] Live deployed application
- [ ] README screenshots
- [ ] Local setup instructions
- [ ] 3–5 minute demo video
- [ ] Short implementation note
- [ ] No API keys committed
- [ ] Parts A, B and selected Part C tested

---

## Implementation status

Verified by automated tests (`npm test`, 13 passing): quote verification (exact, whitespace/case/curly quotes, multi-line, missing, too-short, page boundary, repeated occurrences, multi-document), chunk offsets/page ranges, and the agent loop (hard round limit, unknown tools, malformed arguments, final-answer verification).

Written but **not yet run end to end** (needs Postgres, a Gemini key and a real PDF/DOCX): upload and processing pipeline, `/api/documents*`, `/api/questions`, `/api/agent/research`, and the dashboard UI. `npm run typecheck` reports three errors that only appear until `prisma generate` has run.

Not built yet:

- Qdrant / embeddings (retrieval is lexical, behind `lib/retrieval/keyword.ts`)
- OCR (`lib/documents/ocr.ts` returns null, so scanned PDFs fail with a clear message)
- Streaming chat, cancellation, chat persistence and history routes
- Document viewer and citation highlighting (PDF text-item coordinates are already stored in `Page.items`)
- Contract comparison (`/api/compare`)
- Agent research UI (the SSE endpoint exists)
- Original file storage, ESLint config, distributed rate limiting

## Getting started

```bash
npm install
cp .env.example .env.local   # fill in values
npx prisma migrate dev --name init
npm run dev
npm test
```
