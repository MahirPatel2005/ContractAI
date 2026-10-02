# AGENTS.md

## Purpose

This file provides persistent instructions to AI coding agents working on ContractAI.

## Before Making Changes

Read the relevant documentation before coding:

- `PRD.md`
- `docs/ARCHITECTURE.md`
- `docs/SECURITY.md`
- `docs/CODE_STYLE.md`
- `docs/DATABASE.md`
- `docs/API.md`
- `docs/DESIGN_SYSTEM.md`

For database changes, always read `DATABASE.md` and `SECURITY.md`.

For API changes, always read `API.md` and `SECURITY.md`.

For UI changes, read `DESIGN_SYSTEM.md` and `CODE_STYLE.md`.

## Core Rules

1. Do not invent requirements that are not present in the PRD.
2. Preserve existing architecture unless there is a clear reason to change it.
3. Prefer small, testable modules.
4. Never bypass quote verification.
5. Never trust AI-provided page numbers or offsets.
6. Never expose secrets to client-side code.
7. Never commit `.env` files.
8. Validate all user-controlled input on the server.
9. Do not claim a feature works if it has not been tested.
10. Do not silently weaken security or verification to make a demo pass.

## AI/Citation Rule

The AI generates candidate answers and candidate quotes.

Application code is the authority for:

- quote existence,
- quote location,
- page number,
- offsets,
- document identity,
- citation verification.

Any final answer containing citations must pass the verification pipeline.

## Large Document Rule

Never make a global claim about a document solely because retrieved chunks did not contain the requested information.

Use language such as:

> I could not verify this from the retrieved document evidence.

If a broader search is required, perform it.

## Agentic Tool Rules

For Part C Option 2:

- Use a hard round limit.
- Validate tool names.
- Validate arguments.
- Reject malformed calls safely.
- Record tool execution steps.
- Never allow an infinite loop.
- Verify final citations exactly as normal chat responses.

## File Handling

Supported uploads:

- PDF
- DOCX

Do not accept arbitrary executable files.

Temporary uploaded files must be handled safely and deleted when no longer needed.

## Database Rules

Use Prisma for database access.

Do not write raw SQL unless necessary and reviewed.

Schema changes require migrations.

Never use destructive database reset commands against production.

## Testing Expectations

Before finishing a feature:

- Run type checking.
- Run linting.
- Run relevant tests.
- Test loading states.
- Test error states.
- Test empty states.
- Test realistic document data.

For citation-related changes, include tests for:

- whitespace differences,
- repeated quotes,
- multi-line quotes,
- missing quotes,
- page boundaries,
- multiple documents.

## Documentation

Update documentation when:

- architecture changes,
- API routes change,
- database models change,
- security rules change,
- a major product behaviour changes.

## Avoid

Do not:

- add dependencies without need,
- rewrite unrelated files,
- disable type checking,
- suppress lint errors without a reason,
- hardcode credentials,
- fake citation coordinates,
- fabricate test results,
- replace verified data with AI guesses.
