# ContractAI — Product Requirements Document

## 1. Product Overview

ContractAI is a web application for analysing legal contracts. A user uploads a PDF or DOCX contract, asks questions about it, and receives answers grounded only in the uploaded document.

Every answer must contain citations backed by exact text from the source document. Clicking a verified citation opens the document and highlights the corresponding passage.

The application is designed for a single user, so no login or account system is required.

## 2. Goals

### Primary goals

- Upload PDF and DOCX contracts.
- Extract and store document text.
- Handle scanned PDFs appropriately.
- Show document processing status.
- Maintain a document library.
- Ask questions about a document.
- Stream AI responses.
- Allow answer generation to be cancelled while preserving generated content.
- Save and reopen chat history per document.
- Verify every displayed quote against the original extracted document text.
- Locate citations independently of AI-provided page numbers or offsets.
- Support whitespace differences during quote verification.
- Support contracts up to approximately 150 pages.
- Prevent unsupported claims when only part of a document has been retrieved.
- Highlight verified citations inside the rendered document.
- Support questions across multiple documents.
- Compare two contract versions at clause/paragraph level.
- Provide plain-language explanations of substantive changes.
- Implement one Part C challenge.

## 3. Non-Goals

The following are not required for the initial implementation:

- User authentication.
- Multi-user permissions.
- Payments.
- Mobile-native applications.
- Full legal advice.
- Autonomous legal decision-making.
- Optional assignment extras until Parts A, B and C are working.

## 4. Users

### Primary user

A single person reviewing legal contracts.

The UI should assume a technically capable user but should not require technical knowledge to operate the application.

## 5. Functional Requirements

### 5.1 Document Upload

Supported:

- PDF
- DOCX

Unsupported file types must be rejected with a clear message.

Processing states:

- `queued`
- `extracting`
- `ocr`
- `chunking`
- `indexing`
- `ready`
- `failed`

The UI must always communicate the current state.

### 5.2 PDF Processing

For text-based PDFs:

1. Extract page-level text.
2. Preserve page boundaries.
3. Preserve enough positional information for later citation highlighting.
4. Normalize text for search without destroying the original extracted representation.

For scanned PDFs:

1. Detect insufficient extracted text.
2. Attempt OCR when supported.
3. If readable text cannot be obtained, mark processing as failed.
4. Explain the failure to the user.

Never treat an empty extraction as a successfully processed document.

### 5.3 DOCX Processing

Extract:

- Paragraph text.
- Heading information where available.
- Table text where possible.
- Structural ordering.

Preserve enough information to locate citations in the original document.

### 5.4 Document Library

Users can:

- View uploaded documents.
- Open a document.
- Delete a document.
- See processing status.
- See basic metadata such as filename, type, page count and upload date.

### 5.5 Chat

The user can ask natural-language questions about a document.

Requirements:

- Stream the answer.
- Allow cancellation.
- Preserve partially generated content after cancellation.
- Save chat history.
- Reopen previous chats.
- Ground answers in retrieved document passages.

### 5.6 Verified Quotes

This is a critical product requirement.

The AI may propose a quote, but application code must independently verify it.

Verification must:

1. Normalize whitespace.
2. Search the actual extracted document text.
3. Identify the actual occurrence.
4. Determine document/page/offset information from the application data.
5. Mark the citation as verified only after successful matching.

The AI must never be trusted for page numbers or offsets.

If a quote cannot be located:

- Remove it from the verified citation set, or
- Clearly mark it as unverified.

The UI must never present an invented quote as genuine.

### 5.7 Missing Information

If the application cannot find sufficient evidence in the retrieved document content, it must not fabricate an answer.

The answer should explain that the available document evidence was insufficient.

The system must avoid saying a clause does not exist when only part of a large document was examined.

### 5.8 Large Documents

Contracts of approximately 150 pages must be supported.

The application should:

- Split documents into retrieval-friendly chunks.
- Preserve page and offset metadata.
- Retrieve relevant chunks instead of sending the whole document to the model.
- Support broader retrieval when necessary.
- Track retrieval coverage where useful.
- Avoid unsupported global negative claims.

### 5.9 Citation Highlighting

Clicking a verified quote must:

- Open the document.
- Scroll to the citation.
- Highlight the exact passage.

Must support:

- Multi-line quotes.
- Quotes crossing page boundaries.
- Multiple occurrences.
- Selecting the correct occurrence based on verified location.

### 5.10 Multi-Document Questions

The user can select multiple documents.

The system must:

- Retrieve evidence independently per document.
- Answer comparatively.
- Associate every citation with its source document.
- Verify each citation against its own source.

### 5.11 Document Comparison

The user can select two contract versions.

The system should:

- Compare at paragraph/clause level.
- Match corresponding sections.
- Detect additions, deletions and substantive modifications.
- Generate plain-language explanations.
- Identify meaningful changes such as monetary or liability changes.
- Allow filtering/sorting by significance.
- **Side-by-side view:** Version 1 on the left and Version 2 on the right.
- **Accessible diff highlights:** Additions, deletions, and edits visually distinct, not by color alone (strikethrough with `[-]` badge, underline with `[+]` badge, icon indicators).
- **Synchronized scrolling:** Scrolling either pane keeps corresponding sections aligned; clicking a change jumps to its counterpart.
- **Change navigation sidebar:** Jump between modified, added, and deleted clauses.
- **Comparison Chat Panel:** Ask comparative questions (e.g., "What changed?", "How does this affect me?") with answers citing verified quotes from both versions, linked to locations.
- **Impact explanation per change:** Identify who the change favors (Customer, Vendor, Mutual) and risk level (High, Medium, Low), explicitly labeled as AI analysis and not legal advice.

### 5.12 Part C — Tracked-Change Redlining (Option 1)

Selected implementation: **Option 1 — Tracked-Change Redlining**.

Requirements:

- Accept plain-language edit requests (e.g., "make the liability cap mutual", "increase notice period to 60 days").
- Write revised wording directly into `.docx` as real OpenXML tracked changes (`w:ins` and `w:del`).
- The resulting document must open cleanly in Microsoft Word and LibreOffice.
- Edits appear as insertions and deletions the user can accept or reject one by one.
- All original formatting survives: fonts, bold, numbering, tables, headers, styles.
- Only the changed text is touched; nothing is reformatted or renumbered.
- Support multiple edits in one pass.
- Handle text split across formatted runs/fragments without whole-document regeneration.
- Redline UI: describe the edit, preview proposed diffs, and download the redlined `.docx`.

*(Note: Autonomous Agentic Document Research from Option 2 is also retained as a bonus capability in the Workspace.)*

## 6. AI Requirements

AI provider:

- Gemini by default.

The implementation must support configuration through environment variables:

- API key
- Base URL
- Model name

No API credentials may be committed.

The AI is an extraction/reasoning component, not the source of truth for citations.

## 7. Optional Features

Only consider these after required functionality works:

- Semantic search improvements.
- Clause extraction.
- Export to PDF/DOCX.
- Anonymisation.
- Arabic support.
- Background processing recovery.
- Voice input.

## 8. Quality Requirements

The application should provide:

- Clear loading states.
- Clear empty states.
- Clear error states.
- Responsive UI.
- Accurate citations.
- Stable behaviour with large files.
- No false claims about unsupported functionality.

## 9. Acceptance Criteria

A feature is considered complete only when it works against realistic uploaded contracts, not merely when a UI control exists.

Required demonstration:

1. Upload a contract.
2. Show processing.
3. Ask a question.
4. Show a streamed answer.
5. Show verified quotes.
6. Click a citation.
7. Highlight the source passage.
8. Ask a multi-document question.
9. Compare two contract versions.
10. Demonstrate the selected Part C feature.
