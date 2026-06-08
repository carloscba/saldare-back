# Data Model: Bank Movement CRUD

**Feature**: 008-save-bank-movements | **Date**: 2026-06-07

## Entity-Relationship Diagram

```
Company ──< CompanyMembership >── (Firebase User)
   │
   │ 1:N
   ▼
Document ──< Movement (NEW)
```

## New Entity: Movement

### Prisma Schema

```prisma
model Movement {
  id           String    @id @default(uuid()) @db.Uuid
  documentId   String    @db.Uuid
  document     Document  @relation(fields: [documentId], references: [id])
  movementDate DateTime  @db.Date
  description  String    @db.VarChar(255)
  amount       Decimal   @db.Decimal(15, 2)
  category     String?   @db.VarChar(255)
  createdAt    DateTime  @default(now())
  updatedAt    DateTime  @updatedAt
  deletedAt    DateTime?

  @@index([documentId])
  @@index([deletedAt])
}
```

### Changes to Existing Model: Document

```prisma
model Document {
  // ... existing fields ...
  movements   Movement[]   // NEW: reverse relation
}
```

## Field Specifications

| Field | Type | DB Type | Required | Default | Validation |
|---|---|---|---|---|---|
| `id` | UUID string | `UUID` | Yes | `uuid()` | Generated |
| `documentId` | UUID string | `UUID` | Yes | — | Must reference existing Document |
| `movementDate` | Date | `DATE` | Yes | — | Must be <= today (C-005) |
| `description` | string | `VARCHAR(255)` | Yes | — | Non-empty, trimmed |
| `amount` | Decimal | `DECIMAL(15,2)` | Yes | — | Any real number (C-002) |
| `category` | string? | `VARCHAR(255)` | No | `null` | Free text, no enum (D-005) |
| `createdAt` | DateTime | `TIMESTAMPTZ` | Yes | `now()` | Auto |
| `updatedAt` | DateTime | `TIMESTAMPTZ` | Yes | — | Auto (Prisma `@updatedAt`) |
| `deletedAt` | DateTime? | `TIMESTAMPTZ` | No | `null` | Set on soft-delete (C-001) |

## Relationships

### Movement → Document (N:1)

- A Movement belongs to exactly one Document.
- The Document must be non-deleted (`deletedAt IS NULL`) and in `COMPLETED` status for movement creation (FR-003, FR-007).
- When a Document is soft-deleted, all movement operations against it are rejected, but existing movements are not cascade-soft-deleted.

### Movement → Company (transitive, via Document)

- Access control is inherited: Movement → Document → Company → CompanyMembership → User.
- No direct `companyId` on Movement — the relationship is resolved through the Document.

### Document → Movement (1:N)

- A Document can have zero or more Movements.
- Added as a reverse relation for Prisma include queries.

## State & Lifecycle

Movement has no status enum. Its lifecycle is simple:

```
[Created] ─────────────────────────> [Active]
   │                                      │
   │ (createdAt timestamped)              │ (deletedAt = null)
   │                                      │
   └──────────────────────────────────────┘
                                          │
                                   [Soft-Deleted]
                                          │
                                   (deletedAt set)
                                          │
                                   Queries filter:
                                   deletedAt IS NULL
```

- Movements are **immutable** after creation (no update endpoint in v1).
- Soft-delete is supported at the data model level (C-001), but no explicit DELETE endpoint in v1 scope.
- No TTL/auto-cleanup for movements (unlike Documents which have `ttlDays`).

## Indexes

| Index | Columns | Purpose |
|---|---|---|
| Primary | `id` | Uniqueness, fast lookup |
| `Movement_documentId_idx` | `documentId` | Filter movements by document (FR-005) |
| `Movement_deletedAt_idx` | `deletedAt` | Exclude soft-deleted records |

## Queries (Representative)

```typescript
// List movements for a document (paginated)
prisma.movement.findMany({
  where: { documentId, deletedAt: null },
  orderBy: { movementDate: 'desc' },
  skip: (page - 1) * limit,
  take: limit,
});

// Count for pagination
prisma.movement.count({
  where: { documentId, deletedAt: null },
});

// Create single
prisma.movement.create({
  data: { documentId, movementDate, description, amount, category },
});

// Batch create (atomic)
prisma.$transaction(
  movements.map((m) =>
    prisma.movement.create({ data: { ...m } })
  )
);
```
