# ContractAI Architecture & Data Flow Diagrams

This folder contains comprehensive, production-grade architectural diagrams and walkthroughs explaining how ContractAI works in the backend, how user inputs are processed, how prompts are securely sent to Google Gemini LLM, and how verified responses are streamed and rendered.

---

## Diagram Suite Directory

| Document | Title | Core Focus |
| :--- | :--- | :--- |
| [01-system-architecture.md](file:///Users/mahir/Downloads/contract-ai/diagram/01-system-architecture.md) | **System Architecture & Backend Flow** | High-level component interactions, client-server lifecycle, database models, and end-to-end sequence diagrams. |
| [02-document-ingestion-pipeline.md](file:///Users/mahir/Downloads/contract-ai/diagram/02-document-ingestion-pipeline.md) | **Document Ingestion & Coordinate Mapping** | Multi-part upload handling, magic byte guards, PDF glyph bounding-box extraction, sliding-window chunking, and keyword indexing. |
| [03-chat-qa-llm-pipeline.md](file:///Users/mahir/Downloads/contract-ai/diagram/03-chat-qa-llm-pipeline.md) | **User Input, Prompt Construction & LLM Pipeline** | User input capture, BM25 chunk retrieval, prompt injection defense (`<evidence>` isolation), Gemini API integration, and SSE streaming. |
| [04-zero-trust-citation-verification.md](file:///Users/mahir/Downloads/contract-ai/diagram/04-zero-trust-citation-verification.md) | **Zero-Trust Citation Verification** | Verbatim quote matching, multi-occurrence disambiguation, character-to-page resolution, and scoped canvas highlighting. |
| [05-agentic-research-and-redlining.md](file:///Users/mahir/Downloads/contract-ai/diagram/05-agentic-research-and-redlining.md) | **Agentic Research & Tracked-Change Redlining** | Autonomous ReAct agent loop (`search_document`, `get_section`, `list_clauses`), WordprocessingML `<w:del>` / `<w:ins>` tracked changes, and contract comparison. |

---

## How to View Diagrams

All diagrams are written in standard GitHub-flavored **Mermaid** syntax. You can view them directly:
- In GitHub or GitLab web interfaces (rendered natively).
- In VS Code / Antigravity Markdown Preview (`Cmd + Shift + V`).
- In any Markdown viewer supporting Mermaid.
