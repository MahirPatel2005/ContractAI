# 4. Zero-Trust Citation Verification Flowchart

This flowchart shows how ContractAI guarantees zero hallucinations: the AI is **never trusted** for page numbers or quote validity. Every quote must pass a strict verification check against the actual contract text.

---

## Visual Flowchart

![4. Zero-Trust Citation Verification Flowchart](./04-zero-trust-citation-verification.svg)

---

## Mermaid Diagram Code

```mermaid
flowchart TD
    %% 1. LLM Output
    A["🧠 LLM Returns Candidate Quote<br/>e.g., 'thirty-day (30-day) written notice'"] --> B["🛡️ Zero-Trust Verification Engine<br/>(lib/citations/verifier.ts)"]

    %% 2. Search Text
    B --> C{"Does the quote exist in the real document?"}
    
    %% 3. Match Checks
    C -->|No Match Anywhere| D["❌ REJECT QUOTE<br/>Mark citation as unverified<br/>Prevent AI hallucination from showing"]
    
    C -->|Exact Match Found| E["📍 Find Exact Character Position<br/>e.g., Characters 3,892 to 3,925"]
    
    C -->|Minor Space/Punctuation Difference| F["🔄 Normalize Whitespace & Quotes<br/>Match against real contract text"]
    F --> E

    %% 4. Disambiguation
    E --> G{"Does quote appear multiple times in document?"}
    G -->|Yes: Repeated Boilerplate| H["🎯 Disambiguate Occurrence<br/>Picks the instance from the clause the AI was reading"]
    G -->|No: Unique Text| I["✅ Confirmed Offset Range"]
    H --> I

    %% 5. Coordinate Lookup
    I --> J["📄 Page Number Lookup<br/>Maps character offset to true page (e.g., Page 4)"]
    J --> K["📐 Calculate Canvas Coordinates<br/>Finds exact (x, y, width, height) of the words"]

    %% 6. UI Interaction
    K --> L["💳 Display 'Verified Clause • Page 4' Badge<br/>Rendered directly beneath the AI message"]
    L --> M["👆 User Clicks Citation Badge"]
    M --> N["🚀 Document Viewer Jumps to Page 4<br/>Smoothly scrolls inside the viewer without jerking the window"]
    N --> O["🟡 Glowing Yellow Box Pulses<br/>Visually highlights the exact words on the PDF canvas"]

    %% Styling
    classDef startNode fill:#fef3c7,stroke:#d97706,stroke-width:2px,color:#78350f;
    classDef checkNode fill:#f1f5f9,stroke:#475569,stroke-width:2px,color:#0f172a;
    classDef rejectNode fill:#fee2e2,stroke:#dc2626,stroke-width:2px,color:#991b1b;
    classDef successNode fill:#d1fae5,stroke:#059669,stroke-width:2px,color:#064e3b;
    classDef uiNode fill:#e0e7ff,stroke:#4338ca,stroke-width:2px,color:#1e1b4b;

    class A,B startNode;
    class C,G checkNode;
    class D rejectNode;
    class E,F,H,I,J,K successNode;
    class L,M,N,O uiNode;
```

---

## Step-by-Step Breakdown

1. **AI Proposes a Quote**: The AI provides a snippet it claims is from the contract.
2. **Strict Verification**: The backend searches the actual raw document text to verify the words exist character-for-character.
3. **Hallucination Prevention**: If the model fabricated the quote or misquoted the contract, the verification engine rejects it.
4. **Repeated Phrase Disambiguation**: If common words like *"30 days"* appear on 5 different pages, the engine checks which section the AI was analyzing to select the right one.
5. **Exact Page & Coordinates**: The backend maps the quote's character position to the exact page number and bounding box.
6. **One-Click Inspection**: When you click the badge in chat, the document viewer jumps straight to the page and pulses a glowing yellow box around the exact text.
