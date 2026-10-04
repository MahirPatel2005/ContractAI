# ContractAI Flowcharts & Architecture Guide

This folder contains clean, intuitive, visual flowcharts explaining how ContractAI works in the backend, how user inputs are handled, how prompts are sent to the LLM, and how responses are verified and streamed.

---

## Flowchart Directory

| Document | Title | What the Flowchart Shows |
| :--- | :--- | :--- |
| **[01-system-architecture.md](file:///Users/mahir/Downloads/contract-ai/diagram/01-system-architecture.md)** | **1. System Overview Flowchart** | The complete end-to-end backend journey from user question to streamed answer and PDF highlighting. |
| **[02-document-ingestion-pipeline.md](file:///Users/mahir/Downloads/contract-ai/diagram/02-document-ingestion-pipeline.md)** | **2. Document Ingestion Flowchart** | How PDF and Word files are uploaded, validated, chunked, and indexed for fast search. |
| **[03-chat-qa-llm-pipeline.md](file:///Users/mahir/Downloads/contract-ai/diagram/03-chat-qa-llm-pipeline.md)** | **3. User Input to LLM Flowchart** | How questions are captured, search retrieves clauses, prompts are assembled, and Google Gemini streams responses. |
| **[04-zero-trust-citation-verification.md](file:///Users/mahir/Downloads/contract-ai/diagram/04-zero-trust-citation-verification.md)** | **4. Citation Verification Flowchart** | How quotes are checked against real text, how hallucinations are blocked, and how PDF coordinates light up yellow. |
| **[05-agentic-research-and-redlining.md](file:///Users/mahir/Downloads/contract-ai/diagram/05-agentic-research-and-redlining.md)** | **5. Agentic Loop & Redlining Flowcharts** | • Flowchart 1: Autonomous ReAct deep research loop with tools.<br/>• Flowchart 2: Plain-language redlining to native Word `<w:del>` and `<w:ins>` `.docx` files. |

---

## Viewing the Flowcharts

All diagrams use standard **Mermaid** flowchart syntax (`flowchart TD`). You can view them in:
- Antigravity / VS Code Markdown Preview (`Cmd + Shift + V` on Mac)
- GitHub web interface (renders automatically)
- Any Markdown viewer supporting Mermaid
