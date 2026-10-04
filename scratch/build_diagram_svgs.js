import fs from "fs";
import path from "path";

function createSvgFlowchart(title, steps, height = 900) {
  const width = 680;
  const cardWidth = 480;
  const startX = (width - cardWidth) / 2;
  const cardHeight = 64;
  const gap = 34;
  const startY = 80;

  let defs = `
  <defs>
    <filter id="shadow" x="-5%" y="-5%" width="110%" height="120%" filterUnits="userSpaceOnUse">
      <feDropShadow dx="0" dy="3" stdDeviation="4" flood-color="#0f172a" flood-opacity="0.08" />
    </filter>
    <marker id="arrow" viewBox="0 0 10 10" refX="6" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
      <path d="M 0 1 L 10 5 L 0 9 z" fill="#64748b" />
    </marker>
    <marker id="arrow-green" viewBox="0 0 10 10" refX="6" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
      <path d="M 0 1 L 10 5 L 0 9 z" fill="#059669" />
    </marker>
    <marker id="arrow-red" viewBox="0 0 10 10" refX="6" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
      <path d="M 0 1 L 10 5 L 0 9 z" fill="#dc2626" />
    </marker>
  </defs>`;

  let content = `
    <!-- Header Title -->
    <rect width="${width}" height="${height}" fill="#f8fafc" rx="16" />
    <rect x="2" y="2" width="${width - 4}" height="${height - 4}" fill="none" stroke="#e2e8f0" stroke-width="2" rx="14" />
    <text x="${width / 2}" y="42" text-anchor="middle" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="18" font-weight="700" fill="#0f172a">${title}</text>
  `;

  steps.forEach((step, idx) => {
    const y = startY + idx * (cardHeight + gap);

    // Arrow to next step
    if (idx < steps.length - 1) {
      const lineY1 = y + cardHeight;
      const lineY2 = y + cardHeight + gap;
      content += `
        <line x1="${width / 2}" y1="${lineY1}" x2="${width / 2}" y2="${lineY2}" stroke="#94a3b8" stroke-width="2" marker-end="url(#arrow)" stroke-dasharray="${step.dashed ? "4 3" : "none"}" />
      `;
      if (step.arrowLabel) {
        content += `
          <rect x="${width / 2 + 10}" y="${lineY1 + 6}" width="140" height="20" rx="4" fill="#ffffff" stroke="#e2e8f0" />
          <text x="${width / 2 + 16}" y="${lineY1 + 20}" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif" font-size="11" font-weight="600" fill="#475569">${step.arrowLabel}</text>
        `;
      }
    }

    // Card background
    const bg = step.bg || "#ffffff";
    const stroke = step.stroke || "#cbd5e1";
    const titleColor = step.titleColor || "#0f172a";
    const subColor = step.subColor || "#475569";

    content += `
      <g filter="url(#shadow)">
        <rect x="${startX}" y="${y}" width="${cardWidth}" height="${cardHeight}" rx="12" fill="${bg}" stroke="${stroke}" stroke-width="1.5" />
      </g>
      <text x="${startX + 20}" y="${y + 26}" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="14" font-weight="700" fill="${titleColor}">${step.num ? step.num + ". " : ""}${step.title}</text>
      <text x="${startX + 20}" y="${y + 46}" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="12" font-weight="400" fill="${subColor}">${step.desc}</text>
    `;
  });

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="100%" height="auto">
    ${defs}
    ${content}
  </svg>`;
}

// 1. System Architecture / Overview
const steps1 = [
  { num: 1, title: "👤 User Types Question", desc: "User asks in chat: 'What is the liability cap and financial limit?'", bg: "#eef2ff", stroke: "#6366f1", titleColor: "#312e81" },
  { num: 2, title: "💻 Frontend UI (ChatPanel)", desc: "Captures query, sets up AbortController & opens live SSE stream", bg: "#f8fafc", stroke: "#cbd5e1" },
  { num: 3, title: "⚙️ Backend API Route (/api/chats/[id]/messages)", desc: "Validates input, checks rate limit, saves User Message in DB", bg: "#f1f5f9", stroke: "#94a3b8" },
  { num: 4, title: "🔍 Search Engine (BM25 Chunker)", desc: "Scans indexed chunks and retrieves top matching contract clauses", bg: "#f8fafc", stroke: "#cbd5e1" },
  { num: 5, title: "📦 Protected Prompt Assembler", desc: "Combines rules + sandboxed <evidence> contract text + user question", bg: "#fef3c7", stroke: "#f59e0b", titleColor: "#78350f" },
  { num: 6, title: "🧠 Google Gemini LLM API", desc: "Analyzes clauses, synthesizes legal reasoning & drafts candidate quotes", bg: "#fef3c7", stroke: "#d97706", titleColor: "#78350f" },
  { num: 7, title: "🛡️ Zero-Trust Citation Verifier", desc: "Verifies quotes exist character-for-character; finds true page numbers", bg: "#ecfdf5", stroke: "#10b981", titleColor: "#064e3b" },
  { num: 8, title: "⚡ Real-Time Word Streamer (SSE)", desc: "Streams formatted tokens to browser in real-time like ChatGPT", bg: "#f8fafc", stroke: "#cbd5e1" },
  { num: 9, title: "📱 Chat UI Renders Verified Answer", desc: "Displays clean text with selective bolding & clickable citation badges", bg: "#ecfdf5", stroke: "#059669", titleColor: "#064e3b" },
  { num: 10, title: "🟡 PDF Viewer Highlights Exact Clause", desc: "User clicks badge: jumps to page and pulses glowing yellow box", bg: "#fef9c3", stroke: "#eab308", titleColor: "#713f12" },
];

// 2. Ingestion
const steps2 = [
  { num: 1, title: "👤 User Drops Contract File", desc: "Uploads contract in PDF or Microsoft Word (.docx) format", bg: "#eef2ff", stroke: "#6366f1", titleColor: "#312e81" },
  { num: 2, title: "🛡️ Security & Size Check", desc: "Verifies magic byte header and guards against files over 50MB", bg: "#fef3c7", stroke: "#f59e0b", titleColor: "#78350f" },
  { num: 3, title: "💾 Raw File Persisted to Disk", desc: "Saved securely to local storage directory (.storage/documents/)", bg: "#f8fafc", stroke: "#cbd5e1" },
  { num: 4, title: "📝 Database Record Created", desc: "Document record inserted via Prisma with status = 'processing'", bg: "#f1f5f9", stroke: "#94a3b8" },
  { num: 5, title: "📄 Text & Coordinate Extractor", desc: "PDF: extracts words with (x, y) coordinates; DOCX: unzips XML runs", bg: "#f8fafc", stroke: "#cbd5e1" },
  { num: 6, title: "✂️ Sliding-Window Chunker", desc: "Splits full text into 1,000-char blocks with 200-char overlap", bg: "#f8fafc", stroke: "#cbd5e1" },
  { num: 7, title: "🔍 Inverted Keyword Indexer", desc: "Strips stopwords and generates high-speed term frequency lookup map", bg: "#f1f5f9", stroke: "#94a3b8" },
  { num: 8, title: "✅ Document Status Set to 'Ready'", desc: "Database updated with page count; contract opens in Document Workspace", bg: "#ecfdf5", stroke: "#10b981", titleColor: "#064e3b" },
];

// 3. Q&A LLM Pipeline
const steps3 = [
  { num: 1, title: "👤 User Submits Question in Chat", desc: "Lawyer asks about liability, indemnities, or termination notice", bg: "#eef2ff", stroke: "#6366f1", titleColor: "#312e81" },
  { num: 2, title: "🌐 API Receives Query (POST /api/chats/[id]/messages)", desc: "Validates schema, checks client rate limits, starts event stream", bg: "#f1f5f9", stroke: "#94a3b8" },
  { num: 3, title: "🔍 Contract Chunks Retrieved", desc: "Keyword engine selects top 6 most relevant text passages", bg: "#f8fafc", stroke: "#cbd5e1" },
  { num: 4, title: "🛡️ Prompt Sandbox (<evidence> Isolation)", desc: "Wraps text in XML tags to prevent prompt injection attacks", bg: "#fef3c7", stroke: "#f59e0b", titleColor: "#78350f" },
  { num: 5, title: "📋 Formatting & Grounding Rules Injected", desc: "Enforces sentence case, normal font-weight prose & surgical bolding", bg: "#fef3c7", stroke: "#d97706", titleColor: "#78350f" },
  { num: 6, title: "🧠 Google Gemini 2.5 API Inference", desc: "Evaluates contract evidence; outputs structured JSON with quotes", bg: "#fef3c7", stroke: "#b45309", titleColor: "#78350f" },
  { num: 7, title: "⚡ Live Stream Tokens to Browser (SSE)", desc: "Words stream onto screen in real-time as they are produced", bg: "#f8fafc", stroke: "#cbd5e1" },
  { num: 8, title: "✅ Verified Response Rendered", desc: "Final clean prose with clickable 'Verified Clause • Page X' badges", bg: "#ecfdf5", stroke: "#10b981", titleColor: "#064e3b" },
];

// 4. Citation Verification
const steps4 = [
  { num: 1, title: "🧠 LLM Returns Candidate Quote", desc: "Candidate: 'thirty-day (30-day) written notice of termination'", bg: "#fef3c7", stroke: "#f59e0b", titleColor: "#78350f" },
  { num: 2, title: "🛡️ Zero-Trust Verifier Intercepts Quote", desc: "Application code takes control; never trusts AI page guesses", bg: "#f1f5f9", stroke: "#94a3b8" },
  { num: 3, title: "🔍 Exact & Normalized Character Search", desc: "Searches raw contract text; handles smart quotes and line breaks", bg: "#f8fafc", stroke: "#cbd5e1" },
  { num: 4, title: "🎯 Repeated Quote Disambiguation", desc: "If quote appears multiple times, matches the chunk the AI analyzed", bg: "#f8fafc", stroke: "#cbd5e1" },
  { num: 5, title: "📍 Deterministic Offset Found", desc: "Resolves exact character index: [3,892 to 3,925] in document", bg: "#ecfdf5", stroke: "#10b981", titleColor: "#064e3b" },
  { num: 6, title: "📄 True Page & Coordinate Resolution", desc: "Maps offset to Page 4 and extracts visual bounding box (x, y, w, h)", bg: "#ecfdf5", stroke: "#059669", titleColor: "#064e3b" },
  { num: 7, title: "💳 Clickable Badge Rendered in UI", desc: "Displays 'Verified Clause • Page 4' card under the answer", bg: "#eef2ff", stroke: "#6366f1", titleColor: "#312e81" },
  { num: 8, title: "🟡 Canvas Highlight & Scoped Jump", desc: "Viewer jumps to Page 4 and pulses glowing yellow box on exact words", bg: "#fef9c3", stroke: "#eab308", titleColor: "#713f12" },
];

// 5. Agent & Redlining
const steps5 = [
  { num: 1, title: "👤 User Selects Advanced Feature", desc: "Chooses Agentic Deep Research OR Word Tracked-Change Redlining", bg: "#eef2ff", stroke: "#6366f1", titleColor: "#312e81" },
  { num: 2, title: "🤖 Agentic Loop: Autonomous ReAct Steps", desc: "Gemini calls tools: search_document, get_section, list_clauses", bg: "#fef3c7", stroke: "#f59e0b", titleColor: "#78350f" },
  { num: 3, title: "🛑 5-Round Circuit Breaker", desc: "Hard round cap ensures agent finishes without infinite loops", bg: "#fef3c7", stroke: "#d97706", titleColor: "#78350f" },
  { num: 4, title: "📝 Plain-Language Redline Instruction", desc: "e.g. 'Increase termination notice from 30 to 60 days'", bg: "#f1f5f9", stroke: "#94a3b8" },
  { num: 5, title: "✂️ Surgical Target Identification", desc: "Finds minimal target: 'thirty-day (30-day)' -> 'sixty-day (60-day)'", bg: "#f8fafc", stroke: "#cbd5e1" },
  { num: 6, title: "🖥️ In-Browser Visual Diff Preview", desc: "Shows struck-through red deletions and underlined green additions", bg: "#f8fafc", stroke: "#cbd5e1" },
  { num: 7, title: "🏷️ Native OpenXML Injection (<w:del> & <w:ins>)", desc: "Directly edits Word XML without corrupting fonts, styles, or tables", bg: "#ecfdf5", stroke: "#10b981", titleColor: "#064e3b" },
  { num: 8, title: "💾 Download Clean Word .docx", desc: "Opens in Microsoft Word with native Accept / Reject buttons active", bg: "#ecfdf5", stroke: "#059669", titleColor: "#064e3b" },
];

const targetDir = path.resolve("./diagram");

fs.writeFileSync(path.join(targetDir, "01-system-architecture.svg"), createSvgFlowchart("1. System Overview & Backend Flowchart", steps1, 1080));
fs.writeFileSync(path.join(targetDir, "02-document-ingestion-pipeline.svg"), createSvgFlowchart("2. Document Ingestion Flowchart", steps2, 880));
fs.writeFileSync(path.join(targetDir, "03-chat-qa-llm-pipeline.svg"), createSvgFlowchart("3. User Input to LLM Flowchart", steps3, 880));
fs.writeFileSync(path.join(targetDir, "04-zero-trust-citation-verification.svg"), createSvgFlowchart("4. Zero-Trust Citation Verification Flowchart", steps4, 880));
fs.writeFileSync(path.join(targetDir, "05-agentic-research-and-redlining.svg"), createSvgFlowchart("5. Agentic Loop & Redlining Flowchart", steps5, 880));

console.log("All 5 SVG flowcharts generated successfully in ./diagram!");
