# ContractAI — 3 to 5 Minute Demo Video Script
**Authoritative Walkthrough of Grounded Contract Intelligence & Native Tracked Redlining**

---

### Video Overview
- **Target Duration**: 3:30 – 4:30 minutes
- **Recording Mode**: Full screen browser recording at 1080p, with clear audio narration
- **Audience**: Legal engineers, enterprise reviewers, technical evaluators

---

### Step-by-Step Walkthrough & Screen Actions

#### 0:00 – 0:35 | Introduction & Zero-Trust Core Architecture
- **Screen**: Start on the ContractAI Dashboard (`http://localhost:3000`).
- **Visual**: Show the top navigation bar with the glowing `Zero-Trust Verification Active` badge.
- **Narrator**:
  > *"Welcome to ContractAI. Legal review requires absolute precision—a hallucinated clause or an incorrect liability number is an unacceptable risk. ContractAI is built on a Zero-Trust AI architecture: the Large Language Model is strictly treated as an inference engine. Application code is the sole authority for document truth, exact character offsets, and citation verification. Let’s see how this works end-to-end."*

---

#### 0:35 – 1:30 | Part A: Ingestion, Streaming Chat & Deterministic Verification
- **Screen**: Click on **Document Library** or stay on the Workspace.
- **Action**:
  1. Show the uploaded contracts list (`redlined-4__EARLY_TERMINATION-2.docx`, `contract_v1.pdf`, `contract_v2.pdf`).
  2. Point out document metadata: format badges (`DOCX`, `PDF`), page count (`10 pages`), and status (`READY`).
  3. In the right-hand **Q&A Chat**, ask a targeted question:
     > *"What are the early termination conditions and notice periods?"*
  4. Show immediate loading feedback with thinking indicators and streaming response.
  5. Demonstrate **Cancellation**: click "Cancel / Stop" to show that partial generation is safely preserved.
  6. Let an answer stream to completion.
- **Visual**: Point to the **Verified Citation Cards** beneath the answer showing:
  - `Verified Clause • Page 2`
  - Verbatim excerpt in quotes
  - `Inspect provision →` button
- **Narrator**:
  > *"As the response streams, our deterministic verification engine inspects the candidate quotes against the raw stored document. Notice the green verification badge—ContractAI matched the exact text and calculated the true page coordinates independently of whatever page number the model suggested."*

---

#### 1:30 – 2:30 | Part B: Citation Highlighting & Side-by-Side Comparison
- **Screen**: Interactive Document Viewer & Comparison Tool.
- **Action**:
  1. Click **"Inspect provision"** on the citation card.
  2. Watch the left Document Viewer smoothly scroll to Page 2, centering directly on the operative clause highlighted with an amber glowing boundary (`#citation-highlight-target`).
  3. Navigate to the top navigation and click **Comparison**.
  4. Select `Version 1 (Original)` and `Version 2 (Revised)`.
  5. Demonstrate the **Side-by-Side View**:
     - Point out the accessible diff badges (`[+] Added` in green underline, `[-] Deleted` in red strikethrough).
     - Scroll down one pane and observe the **Synchronized Scrolling** keeping provisions aligned.
     - Click an item in the **Change Navigation Sidebar** to jump directly to the modified liability clause.
     - Show the **Impact Analysis Card** explaining who the change favors (e.g., Customer vs. Vendor) and risk classification.
- **Narrator**:
  > *"Clicking 'Inspect provision' immediately navigates the viewer to the exact physical page and highlights the clause with sub-character accuracy. Moving to the Comparison view, we provide a true side-by-side comparative diff with synchronized scrolling, accessible indicators that do not rely on color alone, and an AI risk impact analysis for every substantive amendment."*

---

#### 2:30 – 3:30 | Part C: Tracked-Change Redlining (Option 1) & Autonomous Agent (Option 2)
- **Screen**: Top navigation -> **Redlining** tab.
- **Action**:
  1. Select `redlined-4__EARLY_TERMINATION-2.docx`.
  2. In the plain-language prompt box, enter:
     > *"Increase the early termination notice period from 30 days to 60 days and make the indemnification mutual."*
  3. Click **"Generate Tracked Redline"**.
  4. Show the surgical diff preview displaying `<w:del>` 30-day and `<w:ins>` 60-day.
  5. Click **"Download Redlined .docx"**.
  6. Mention that the downloaded document opens cleanly in Microsoft Word with native Word tracked changes intact, preserving all original font styles, headers, and numbering.
  7. *(Optional bonus)*: Jump back to **Workspace**, switch to the **Agent [Deep]** tab, and show the autonomous researcher executing multi-round tools (`list_clauses`, `get_section`) with verified synthesis.
- **Narrator**:
  > *"For Part C, we implemented Tracked-Change Redlining. Instead of regenerating the entire document or outputting an untracked draft, ContractAI surgically edits the Word OpenXML package. It inserts native Word w:del and w:ins tags. When downloaded, attorneys can review, accept, or reject each edit in Microsoft Word without any style distortion. As a bonus, our autonomous agent research engine also performs multi-step recursive investigation across complex clauses."*

---

#### 3:30 – 4:00 | Conclusion & Architecture Summary
- **Screen**: Back to the ContractAI Workspace or Architecture Diagram.
- **Narrator**:
  > *"ContractAI combines deterministic verification, large-document scaling tested up to 150 pages, accessible side-by-side contract comparison, and native OpenXML tracked redlining. Everything is fully tested and ready for production legal workflows. Thank you."*
