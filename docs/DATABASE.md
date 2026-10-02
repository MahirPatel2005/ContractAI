# DATABASE.md

## 1. Database Stack

Primary database:

- PostgreSQL

ORM:

- Prisma

Migrations:

- Prisma Migrate

Vector database:

- Qdrant

## 2. Environment

Required:

```env
DATABASE_URL=
```

Never hardcode the connection string.

Development and production databases must be separate.

## 3. Core Models

### Document

Represents an uploaded PDF or DOCX.

Fields:

- id
- name
- type
- file URL/storage key
- status
- page count
- extracted text metadata
- createdAt

### Page

Represents a page of extracted document content.

Fields:

- id
- documentId
- pageNumber
- text
- positional metadata where available

Relationship:

```text
Document 1 → many Pages
```

### Chunk

Represents a retrieval unit.

Fields:

- id
- documentId
- pageStart
- pageEnd
- text
- startOffset
- endOffset

Relationship:

```text
Document 1 → many Chunks
```

### Chat

Represents a conversation associated with a document.

Fields:

- id
- documentId
- title
- createdAt

Relationship:

```text
Document 1 → many Chats
```

### Message

Represents a user or assistant message.

Fields:

- id
- chatId
- role
- content
- createdAt

Relationship:

```text
Chat 1 → many Messages
```

### Citation

Represents a verified citation associated with an assistant message.

Fields:

- id
- messageId
- documentId
- quote
- pageNumber
- startOffset
- endOffset
- verified

Relationship:

```text
Message 1 → many Citations
Citation → one source Document
```

## 4. Suggested Indexes

Consider indexes on:

- `Document.createdAt`
- `Document.status`
- `Page.documentId`
- `Page.documentId + pageNumber`
- `Chunk.documentId`
- `Chat.documentId`
- `Message.chatId`
- `Citation.messageId`
- `Citation.documentId`

## 5. Constraints

- Page numbers should be unique within a document.
- Foreign keys must be enforced.
- Document IDs must be stable.
- Citation document identity must be explicit.
- Verified citations require a valid source document.

## 6. Qdrant Metadata

Vector records should contain metadata such as:

```json
{
  "chunkId": "chunk_123",
  "documentId": "doc_123",
  "pageStart": 21,
  "pageEnd": 22
}
```

Do not use Qdrant as the sole source of truth for document text.

PostgreSQL/document storage remains authoritative.

## 7. Migrations

When changing the schema:

1. Update Prisma schema.
2. Create migration.
3. Review migration.
4. Test locally.
5. Apply in deployment.

Do not use destructive reset commands in production.

## 8. Transactions

Use transactions for operations that must succeed together.

Example:

Creating a chat and its initial message may use a transaction where appropriate.

## 9. Deletion

Deleting a document must also clean up:

- related pages,
- chunks,
- chats,
- messages,
- citations,
- Qdrant vectors,
- stored file.

Deletion should be designed as an explicit workflow rather than relying on accidental orphan cleanup.

## 10. Data Integrity

The database stores source data used for citation verification.

Do not overwrite original extracted text with normalized text.

Keep source representation and search representation conceptually separate.
