# Implementation Plan: Bank Movement CRUD

**Branch**: `008-save-bank-movements` | **Date**: 2026-06-07 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/008-save-bank-movements/spec.md`

## Summary

Implement a new NestJS module (`movements/`) providing three API endpoints: create a single bank movement (`POST /api/movements`), list movements for a document with pagination (`GET /api/movements`), and batch-create multiple movements atomically (`POST /api/movements/batch`). All endpoints are protected by Firebase Authentication and company-scoped access control, enforced through document-level membership checks. The Movement entity is a new Prisma model linked to Document with soft-delete support.

## Technical Context

**Language/Version**: TypeScript 5.x (NestJS 10.x)

**Primary Dependencies**: NestJS, Prisma ORM (PostgreSQL), Firebase Admin SDK, class-validator, class-transformer

**Storage**: PostgreSQL via Prisma (existing `PrismaService`)

**Testing**: Jest (NestJS default) — unit tests for services, e2e tests for controllers

**Target Platform**: Google Cloud Run (serverless containers)

**Project Type**: Web service (NestJS backend API)

**Performance Goals**: Single movement save under 1s (p95), batch of 100 movements atomic

**Constraints**: Company-scoped access control, Firebase-authenticated users only, soft-delete consistency

**Scale/Scope**: Part of a SaaS platform with multi-tenant companies; expected document volume is moderate (hundreds of documents per company)

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Status | Evidence |
|---|---|---|
| I. Three-Tier Architecture | PASS | Movement module resides in NestJS backend tier; no direct client-to-DB communication |
| II. Google-Centric Stack | PASS | Uses existing PostgreSQL on Cloud SQL, NestJS on Cloud Run, Firebase Auth — no new platform dependencies |
| III. No Secret Leaks | PASS | No API keys or service account JSON introduced; Firebase verification uses existing admin SDK |
| IV. Data Abstraction (DTOs) | PASS | DTOs defined for request (CreateMovementDto, BatchCreateMovementsDto, MovementListQueryDto) and response (MovementResponseDto, PaginatedResponseDto) |
| V. End-to-End Type Safety | PASS | DTO interfaces are TypeScript-typed; Prisma-generated types ensure DB type safety |

**Security Compliance**:

| Requirement | Status | Evidence |
|---|---|---|
| FirebaseAuthGuard on all endpoints | PASS | Controller uses `@UseGuards(FirebaseAuthGuard)` |
| Company-scoped access | PASS | Service-level membership check via Movement -> Document -> Company -> CompanyMembership |
| No hardcoded keys | PASS | No new credentials introduced |
| IAM roles | N/A | No new GCP service integrations |

**Gate Result**: ALL PASS — No violations. Proceed to implementation.

## Project Structure

### Documentation (this feature)

```text
specs/008-save-bank-movements/
├── plan.md              # This file
├── research.md          # Phase 0: Technical decisions
├── data-model.md        # Phase 1: Prisma schema, relationships, queries
├── quickstart.md        # Phase 1: Integration scenarios and curl examples
├── contracts/           # Phase 1: API endpoint specs
│   ├── create-movement.md
│   ├── list-movements.md
│   ├── batch-create-movements.md
│   └── dto-specs.md
├── spec.md              # Feature specification
├── checklists/
│   └── requirements.md  # Quality checklist
└── tasks.md             # Phase 2 (created by /speckit.tasks)
```

### Source Code (repository root)

```text
src/
├── app.module.ts           # Add MovementsModule
├── main.ts
├── movements/              # NEW module
│   ├── movements.module.ts
│   ├── movements.controller.ts
│   ├── movements.service.ts
│   └── dto/
│       ├── create-movement.dto.ts
│       ├── create-movement-item.dto.ts
│       ├── batch-create-movements.dto.ts
│       ├── movement-list-query.dto.ts
│       ├── movement-response.dto.ts
│       └── paginated-response.dto.ts
├── prisma/
│   ├── prisma.module.ts    # Global, unchanged
│   ├── prisma.service.ts   # Unchanged
│   └── schema.prisma       # Add Movement model + Document.movements relation
├── documents/              # Unchanged (add movements relation)
├── companies/              # Unchanged
└── health/                 # Unchanged

prisma/
├── schema.prisma           # Updated with Movement model
└── migrations/
    └── <timestamp>_add_movement_table/
        └── migration.sql
```

**Structure Decision**: New `src/movements/` module follows the identical pattern as `src/documents/` and `src/companies/`. DTOs are organized in a `dto/` subdirectory. No new shared libraries needed — `PrismaService` is already `@Global()`.

## Complexity Tracking

> No violations detected. This section is intentionally empty.

## Phase 0: Research Summary

See [research.md](./research.md) for full details. Key decisions:

| ID | Decision | Rationale |
|---|---|---|
| D-001 | New `movements/` module | Separate domain entity, follows existing module pattern |
| D-002 | `Decimal(15,2)` for amount | Financial precision, no floating-point errors |
| D-003 | `$transaction` for batch atomicity | Ensures all-or-nothing per FR-009 |
| D-004 | Service-level membership checks | documentId-based endpoints don't carry companyId in request |
| D-005 | `VarChar(255)` for category | Free-text v1, reasonable limit |
| D-006 | Zero amount allowed | Valid business case (void transactions) |
| D-007 | `@db.Date` for movementDate | Date-only field, no time/timezone complexity |
| D-008 | Pagination envelope `{items, total, page, limit, totalPages}` | Consistent with GET /api/documents |
| D-009 | Jest unit + e2e | Service unit tests + controller e2e with guards |

## Phase 1: Design Artifacts

| Artifact | File | Description |
|---|---|---|
| Data Model | [data-model.md](./data-model.md) | Prisma Movement model, field specs, relationships, indexes |
| API Contracts | [contracts/](./contracts/) | 3 endpoints with request/response schemas and DTO specs |
| Quickstart | [quickstart.md](./quickstart.md) | curl examples, error scenarios, prerequisites |

## Constitution Re-Check (Post-Design)

*Re-evaluated after Phase 1 design completion.*

| Principle | Status | Notes |
|---|---|---|
| I. Three-Tier Architecture | PASS | Movement endpoints are standard NestJS REST API on Cloud Run |
| II. Google-Centric Stack | PASS | PostgreSQL + NestJS + Firebase Auth — all Google ecosystem |
| III. No Secret Leaks | PASS | No new secrets; Firebase verification reuses existing admin SDK |
| IV. Data Abstraction (DTOs) | PASS | 6 DTOs defined with class-validator decorators; response DTO maps Prisma types |
| V. End-to-End Type Safety | PASS | DTOs and Prisma types fully typed; amount serialized as string to preserve precision |

**Post-Design Gate**: ALL PASS — Ready for Phase 2 (tasks).
