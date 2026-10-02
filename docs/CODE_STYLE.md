# CODE_STYLE.md

## 1. Stack

- TypeScript
- React
- Next.js
- Tailwind CSS
- Prisma
- PostgreSQL
- ESLint
- Prettier

## 2. Principles

- Prefer readable code over clever code.
- Keep functions focused.
- Keep business logic out of presentational components where practical.
- Reuse existing utilities.
- Avoid premature abstractions.
- Avoid duplicated validation logic.

## 3. Naming

Components:

```text
DocumentUpload.tsx
CitationHighlight.tsx
ComparisonView.tsx
```

Functions:

```text
extractPdfText()
verifyQuote()
findCitationLocation()
compareClauses()
```

Variables:

```text
documentId
citationResult
isProcessing
hasVerifiedCitation
```

Constants:

```text
MAX_FILE_SIZE
MAX_AGENT_ROUNDS
DEFAULT_CHUNK_SIZE
```

## 4. File Organization

Prefer:

```text
components/
lib/
app/
types/
```

Keep domain-specific logic grouped together.

Example:

```text
lib/citations/
  verifier.ts
  normalizer.ts
  locator.ts
```

## 5. TypeScript

- Avoid `any`.
- Define explicit interfaces/types for important data.
- Validate external input before converting it into trusted internal types.
- Use discriminated unions for processing states where useful.

## 6. React

- Use functional components.
- Keep components reasonably small.
- Prefer server-side data access where appropriate.
- Use client components only when interactivity requires them.

## 7. Error Handling

Do not silently swallow errors.

Prefer:

```typescript
try {
  ...
} catch (error) {
  logger.error(...)
  return ...
}
```

with a safe user-facing message.

## 8. Async Operations

Document processing and AI calls are asynchronous.

Use explicit processing states rather than ambiguous booleans.

Prefer:

```text
queued
extracting
ocr
chunking
indexing
ready
failed
```

over:

```text
isLoading: true
```

for long-running jobs.

## 9. Comments

Explain why.

Good:

```typescript
// Normalize whitespace because PDF extraction frequently inserts
// line breaks inside sentences.
```

Avoid:

```typescript
// Normalize text
```

when the code is already obvious.

## 10. API Code

Route handlers should:

1. Validate input.
2. Authenticate/authorize if applicable.
3. Call domain logic.
4. Return a consistent response.
5. Handle errors safely.

Do not place large AI prompts, database queries and PDF processing logic directly inside route handlers.

## 11. AI Code

Keep prompts in dedicated modules.

Keep:

- model configuration,
- prompt construction,
- response parsing,
- tool definitions,
- agent loop

separate.

Never trust model output without validation.

## 12. Citation Code

Citation verification should be deterministic.

Avoid making the LLM responsible for:

- exact quote existence,
- page location,
- offsets,
- verification status.

## 13. UI

Every major feature should handle:

- loading,
- empty,
- success,
- error.

Use reusable UI components.

## 14. Before Completion

Run:

```bash
npm run lint
npm run typecheck
npm test
```

when those scripts exist.

For UI changes, manually test the affected workflow.

For citation changes, test whitespace differences and repeated text.

## 15. Dependency Rules

Before adding a dependency:

1. Check whether an existing dependency already solves the problem.
2. Prefer established packages.
3. Check whether it works with the current Next.js/runtime setup.
4. Keep the dependency focused.
