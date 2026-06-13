# Research: Bank Movement CRUD

**Feature**: 008-save-bank-movements | **Date**: 2026-06-07

## Decisions

### D-001: Module Structure — New `movements/` module

**Decision**: Create a new NestJS module `src/movements/` following the same structure as `src/documents/`.

**Rationale**: Movements are a separate domain entity with their own controller, service, DTOs, and Prisma model. Keeping them in their own module maintains separation of concerns and mirrors the existing `companies/` and `documents/` patterns.

**Alternatives Considered**:
- Add to `documents/` module — Rejected. Movements are not documents; they belong to documents but have distinct operations and lifecycle.
- Monolithic service — Rejected. Violates NestJS module pattern and makes testing harder.

### D-002: Amount Type — Prisma `Decimal`

**Decision**: Store `amount` as `Decimal(15, 2)` in Prisma/PostgreSQL.

**Rationale**: Financial data requires exact decimal precision. IEEE 754 floating-point (`Float` / `Double`) introduces rounding errors that accumulate over multiple operations. `Decimal(15, 2)` supports amounts up to 9,999,999,999,999.99 with cent precision, sufficient for bank transactions.

**Alternatives Considered**:
- `Float` — Rejected. Floating-point errors in financial calculations are unacceptable.
- `Int` in cents (integer-based) — Rejected. Adds unnecessary conversion complexity in application logic and DTOs.
- `Decimal(10, 2)` — Rejected. 10 digits may be insufficient for large transactions in some currencies.

### D-003: Batch Insert Atomicity — Prisma `$transaction`

**Decision**: Use `prisma.$transaction([...])` wrapping `createMany` calls for batch endpoint.

**Rationale**: FR-009 requires atomicity (all-or-nothing). Prisma's `$transaction` with an array of operations ensures all succeed or all roll back. `createMany` is efficient for bulk inserts but doesn't return created records, so we use `createMany` + a separate read inside the same transaction, or individual `create` calls wrapped in a transaction for full response objects.

**Alternatives Considered**:
- Sequential `create` in a loop — Rejected. Not atomic by itself; would need explicit transaction wrapper anyway.
- Raw SQL `INSERT ... RETURNING` — Rejected. Bypasses Prisma type safety and migrations.
- `createMany` without transaction — Rejected. Not atomic per FR-009.

### D-004: Access Control — Reuse existing guards

**Decision**: Use `FirebaseAuthGuard` for authentication and inline service-level membership checks for authorization, mirroring the documents controller pattern.

**Rationale**: The existing `CompanyMembershipGuard` extracts `companyId` from query/body params, but for Movement operations the `companyId` is not directly in the request — it comes from the document relationship. Therefore, service-level membership validation (same approach as `documents.service.ts` `findOne` and `remove`) is more appropriate: look up the document, extract its `companyId`, then verify membership.

**Alternatives Considered**:
- Custom `MovementMembershipGuard` — Rejected. Unnecessary indirection; service-level checks are simpler and already proven.
- Reuse `CompanyMembershipGuard` directly — Rejected. The guard expects `companyId` in query/body, which isn't present for movement endpoints (only `documentId` is).

### D-005: Category Field — `VarChar(255)`, optional

**Decision**: `category` is an optional `VarChar(255)` field. No enum validation.

**Rationale**: Assumptions state "no predefined list of categories for v1". 255 chars matches the existing `filename` field and provides reasonable space for free-text categories. The edge case about max length is resolved by this limit.

**Alternatives Considered**:
- Enum validation — Rejected. Assumption explicitly states no predefined list for v1.
- `VarChar(100)` — Rejected. Too restrictive for descriptive categories.
- `Text` (unlimited) — Rejected. Could allow unreasonable input sizes; 255 chars is sufficient for a category label.

### D-006: Zero Amount — Allowed

**Decision**: Amount of `0.00` is allowed. No special validation or rejection.

**Rationale**: Zero-value transactions exist in banking (void transactions, balance checks, $0 transfers). The spec does not forbid them, and they don't break any business logic. The edge case "¿Se permite un monto de $0.00?" is resolved: yes.

**Alternatives Considered**:
- Reject zero — Rejected. Could block valid use cases.
- Require sign (positive/negative) — Rejected. Zero is neither; forcing a sign adds complexity without value.

### D-007: Movement Date Type — `DateTime` with `@db.Date`

**Decision**: Store `movementDate` as Prisma `DateTime` mapped to PostgreSQL `DATE` type (no time component).

**Rationale**: Bank movements have a transaction date, not a timestamp. Using `@db.Date` stores only the date portion, simplifying validation (no timezone concerns) and matching the business concept of "movement date".

**Alternatives Considered**:
- `DateTime` with `@db.Timestamptz` — Rejected. Carries unnecessary time/timezone data for a date-only field.
- `String` (ISO date string) — Rejected. Loses DB-level date validation and comparison capabilities.

### D-008: Pagination Pattern — Match existing documents pagination

**Decision**: Return `{ items, total, page, limit, totalPages }` structure, same as `DocumentsService.findAll`.

**Rationale**: C-004 specifies pagination matching the documents pattern. The existing `DocumentListQueryDto` uses `page` (default 1), `limit` (default 20, max 100). Reusing the same response envelope and query params provides API consistency.

**Alternatives Considered**:
- Cursor-based pagination — Rejected. Over-engineering for this scale; offset pagination is simpler and sufficient.
- Different envelope structure — Rejected. Inconsistency between endpoints is a worse DX.

### D-009: Testing Strategy

**Decision**: Unit tests for service logic, e2e/integration tests for controller endpoints. Use Jest (NestJS default).

**Rationale**: Service methods contain the business logic (validation, membership checks, Prisma queries). Controllers are thin pass-throughs. E2e tests verify the full middleware chain (guards, pipes, validation).

**Alternatives Considered**:
- Only e2e tests — Rejected. Slower feedback loop; unit tests are faster for logic validation.
- Only unit tests — Rejected. Doesn't verify guard integration and HTTP contract.

## Resolved Clarifications

All `NEEDS CLARIFICATION` markers from the spec have been resolved through the clarify workflow:

| ID | Topic | Resolution |
|---|---|---|
| C-001 | Soft-delete | Movement supports soft-delete via `deletedAt` |
| C-002 | Negative amounts | Allowed (positive=credit, negative=debit) |
| C-003 | Soft-deleted documents | Reject all movement operations |
| C-004 | Pagination | Page/limit, same pattern as documents |
| C-005 | Future dates | Rejected (must be <= today) |
