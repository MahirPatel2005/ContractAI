# 3. User Input to LLM & Response Flowchart

This flowchart shows exactly what happens after the user types a question: how the backend searches for clauses, builds the prompt, calls Google Gemini LLM, and streams the answer back.

---

## Visual Flowchart

![3. User Input to LLM Flowchart](./03-chat-qa-llm-pipeline.svg)

---

## Mermaid Diagram Code

```mermaid
flowchart TD
    %% 1. User Input
    A["👤 User Types Question in Chat<br/>e.g., 'What are the termination provisions?'"] --> B["🖱️ Clicks 'Send' Button"]
    
    %% 2. API Call
    B --> C["🌐 POST /api/chats/[id]/messages<br/>Transmits question to backend"]
    C --> D["💾 Save Question in Database<br/>Creates user message record"]
    
    %% 3. Retrieval
    C --> E["🔍 Search Contract Index<br/>Scans chunks for keywords like 'terminate', 'notice', 'cure'"]
    E --> F["📄 Top Contract Chunks Selected<br/>e.g., Section 4 (Early Termination) and Section 6 (Defaults)"]

    %% 4. Prompt Assembly
    F --> G["🛡️ Assemble Protected Prompt<br/>Puts contract text inside &lt;evidence&gt; tags to stop prompt injection"]
    G --> H["📋 Add LLM Instructions:<br/>• Normal sentence case (never ALL CAPS)<br/>• Bold key numbers and deadlines only<br/>• Quote exact words from evidence only<br/>• Return clean JSON format"]

    %% 5. LLM Call
    H --> I{"Google Gemini API Key Present?"}
    I -->|Yes| J["🧠 Google Gemini 2.5 LLM<br/>Reads prompt + evidence and generates legal answer"]
    I -->|No / Offline| K["⚙️ Built-in Legal Reasoning Engine<br/>Synthesizes answer deterministically"]

    %% 6. Output Processing
    J --> L["📦 Extract JSON Answer<br/>Extracts narrative text + candidate citation quotes"]
    K --> L

    %% 7. Streaming
    L --> M["⚡ Stream Words to Browser (SSE)<br/>Words stream live on screen like ChatGPT"]
    M --> N["🛡️ Verify Quotes in Background<br/>Checks quotes against contract text"]
    N --> O["✅ Render Final Answer in Chat<br/>Clean formatting with verified citation cards"]

    %% Styling
    classDef inputNode fill:#e0e7ff,stroke:#4338ca,stroke-width:2px,color:#1e1b4b;
    classDef searchNode fill:#f1f5f9,stroke:#475569,stroke-width:2px,color:#0f172a;
    classDef llmNode fill:#fef3c7,stroke:#d97706,stroke-width:2px,color:#78350f;
    classDef streamNode fill:#d1fae5,stroke:#059669,stroke-width:2px,color:#064e3b;

    class A,B,C,D inputNode;
    class E,F,G,H searchNode;
    class I,J,K,L llmNode;
    class M,N,O streamNode;
```

---

## Step-by-Step Breakdown

1. **User Types Question**: Enter any contract question (e.g., notice periods, liability caps, payment terms).
2. **Backend Finds Relevant Clauses**: The keyword search engine immediately locates the specific pages and sections that mention those terms.
3. **Prompt Sandbox**: The contract text is enclosed in `<evidence>` tags so malicious instructions in a document cannot trick the AI.
4. **Google Gemini Generates Answer**: Gemini analyzes the contract evidence, writes a structured explanation in normal sentence case, and selects exact quote candidates.
5. **Real-Time Streaming**: Words appear on the user's screen in real time with selective bolding on important deadlines (e.g., **thirty (30) days**).
