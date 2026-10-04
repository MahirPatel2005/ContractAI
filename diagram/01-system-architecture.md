# 1. System Overview & Backend Flowchart

This flowchart shows the complete step-by-step path of how ContractAI works in the backend—from the moment a user asks a question to when the verified answer appears on screen.

---

## Visual Flowchart

![1. System Overview & Backend Flowchart](./01-system-architecture.svg)

---

## Mermaid Diagram Code

```mermaid
flowchart TD
    %% Step 1: Input
    A["👤 User Types Question<br/>e.g., 'What is the liability cap?'"] --> B["💻 Frontend UI (ChatPanel)<br/>Captures input & opens live stream"]
    
    %% Step 2: Backend API
    B --> C["⚙️ Backend API Route<br/>(/api/chats/[id]/messages)"]
    C --> D["💾 Save User Message<br/>Stored in Database via Prisma"]

    %% Step 3: Retrieval
    C --> E["🔍 Keyword Search Engine<br/>Scans document and finds top relevant clauses"]
    E --> F["📄 Relevant Contract Chunks<br/>Extracts exact text with character positions"]

    %% Step 4: LLM Prompting
    F --> G["📦 Prompt Builder<br/>Combines: System Rules + Contract Text + Question"]
    G --> H["🧠 Google Gemini LLM<br/>Reads contract clauses & writes candidate answer"]

    %% Step 5: Verification
    H --> I["🛡️ Citation Verifier<br/>Checks if quotes exist in the real document"]
    I -->|Quote Matches Real Text| J["✅ Verified Citation<br/>Resolves true page number & coordinates"]
    I -->|Quote Does Not Exist| K["❌ Rejected Quote<br/>Discards hallucinated reference"]

    %% Step 6: Output & Streaming
    J --> L["💾 Save Assistant Answer<br/>Updates database with verified response"]
    L --> M["⚡ Live Stream (Server-Sent Events)<br/>Streams text to browser in real-time"]
    M --> N["📱 Chat UI Displays Answer<br/>Clean ChatGPT-style text with clickable citation cards"]
    
    %% Step 7: Visual Highlighting
    N -->|User clicks citation| O["🟡 PDF Viewer Highlights Clause<br/>Jumps to page and draws glowing yellow box"]

    %% Styling
    classDef userNode fill:#e0e7ff,stroke:#4338ca,stroke-width:2px,color:#1e1b4b;
    classDef apiNode fill:#f1f5f9,stroke:#475569,stroke-width:2px,color:#0f172a;
    classDef llmNode fill:#fef3c7,stroke:#d97706,stroke-width:2px,color:#78350f;
    classDef verifyNode fill:#d1fae5,stroke:#059669,stroke-width:2px,color:#064e3b;
    classDef uiNode fill:#ecfdf5,stroke:#10b981,stroke-width:2px,color:#064e3b;

    class A,B userNode;
    class C,D,E,F,G apiNode;
    class H llmNode;
    class I,J,K verifyNode;
    class L,M,N,O uiNode;
```

---

## Step-by-Step Breakdown

1. **User Types Input**: The user enters a question into the chat panel in their browser.
2. **Backend Receives Request**: Next.js route handler validates the request and immediately saves the question in the database.
3. **Smart Search**: The backend searches the indexed contract text to find the most relevant sections and clauses.
4. **Sent to LLM**: The contract clauses, the user's question, and strict legal formatting rules are packaged and sent to Google Gemini LLM.
5. **Zero-Trust Verification**: When the LLM replies with quotes, the backend independently verifies that every quote exists character-for-character in the original contract.
6. **Streaming Response**: The verified answer and clickable citation badges are streamed back to the browser in real time.
7. **Document Highlighting**: When the user clicks any citation, the document viewer smoothly jumps to that exact page and highlights the clause in glowing yellow.
