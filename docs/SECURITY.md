# SECURITY.md

## 1. Purpose

This document defines security rules for ContractAI.

The application processes potentially sensitive legal contracts. Security rules therefore apply to document contents, uploaded files, AI prompts, logs, databases and external providers.

## 2. Authentication

No application login is required because the assignment assumes a single user.

However, deployment infrastructure and database credentials must still be protected.

Do not expose administrative infrastructure publicly.

## 3. Secrets

All secrets must come from environment variables.

Examples:

```env
DATABASE_URL=
GEMINI_API_KEY=
GEMINI_BASE_URL=
GEMINI_MODEL=
QDRANT_URL=
QDRANT_API_KEY=
```

Rules:

- Never commit `.env.local`.
- Never place secrets in client-side code.
- Never include secrets in logs.
- Never put real credentials in Markdown.
- Maintain `.env.example` with empty values.
- Use separate development and production credentials.

## 4. File Upload Security

Accept only:

- PDF
- DOCX

Validate:

- extension,
- MIME type,
- file signature where practical,
- maximum file size.

Never execute uploaded files.

Uploaded filenames must not be trusted as filesystem paths.

Use generated storage keys rather than directly using user filenames.

## 5. Input Validation

Validate all user-controlled values server-side.

Validate:

- question length,
- document IDs,
- chat IDs,
- file type,
- file size,
- comparison document IDs,
- agent tool arguments.

Use Zod or an equivalent schema validator.

## 6. Prompt Injection

Document contents are untrusted input.

A contract may contain text that attempts to manipulate the AI.

Treat retrieved document content as evidence, not instructions.

The model must not follow instructions embedded in documents that conflict with the application system instructions.

## 7. AI Security

The AI must not be treated as a trusted source for:

- page numbers,
- offsets,
- quote verification,
- document identity.

Application code independently verifies citations.

Never pass secrets into model context.

## 8. API Security

Protect server-only operations.

Apply rate limits where appropriate, particularly to:

- document processing,
- AI generation,
- agent loops,
- expensive retrieval.

Do not expose internal errors.

## 9. Database Security

Use Prisma and parameterized queries.

Never construct unsafe SQL from user input.

Do not use production database reset commands.

Use least-privilege credentials where supported.

## 10. Logs

Never log:

- API keys,
- database credentials,
- authentication tokens,
- complete confidential contracts unless explicitly required for debugging.

Prefer metadata such as:

```text
documentId
operation
duration
status
errorCode
```

## 11. Error Handling

User-facing errors must not expose:

- stack traces,
- server paths,
- credentials,
- provider internals.

Server logs may contain appropriate diagnostic information without secrets.

## 12. Agentic Tool Security

The agent can call only explicitly registered tools.

Validate:

- tool name,
- argument schema,
- document scope,
- maximum result size.

Enforce a hard round limit.

Never execute arbitrary code or arbitrary filesystem operations from model-generated tool calls.

## 13. Citation Integrity

Citation verification is a security and trust boundary.

Never allow the model to mark a quote as verified.

Verification must happen in application code against stored document text.

## 14. AI Coding Agent Rules

The coding agent must never:

- hardcode secrets,
- disable verification,
- bypass validation,
- expose confidential content unnecessarily,
- weaken file restrictions,
- remove error handling to hide failures,
- claim tests passed when they were not run.
