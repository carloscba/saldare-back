# Implementation Plan: Control de Acceso a Documentos por Compañía

**Branch**: `006-company-doc-access` | **Date**: 2026-06-06 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `specs/006-company-doc-access/spec.md`

## Summary

Implement a company-based authorization layer for document access. Add a `CompanyMembership` table linking Firebase users to companies, enforce membership checks on all document endpoints, and create a `GET /api/companies` endpoint filtered by user membership. All members of a company have equal permissions (no roles). Membership management is external (direct DB). Authorization denials are logged to stdout → Cloud Logging.

## Technical Context

**Language/Version**: TypeScript 5.7+ / Node.js 24+

**Primary Dependencies**: NestJS 11, Prisma 7.8 (PostgreSQL), Firebase Admin SDK 13, class-validator, class-transformer

**Storage**: PostgreSQL via Prisma ORM with `@prisma/adapter-pg`

**Testing**: Jest 30, Supertest (E2E), NestJS Testing utilities

**Target Platform**: Google Cloud Run (serverless containers), Linux

**Project Type**: NestJS backend API (single service, modular monolith)

**Performance Goals**: Membership check adds ≤ 1 extra DB query per request (SC-005). Company list < 500ms for ≤ 50 memberships (SC-002).

**Constraints**: Must not change existing API contract (same endpoints, same request/response shapes). Backward compatible with current Angular frontend.

**Scale/Scope**: MVP — < 100 req/day, < 10 documents/day. Single region (`us-central1`).

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Status | Evidence |
|-----------|--------|----------|
| **I. Three-Tier Architecture** | ✅ PASS | No change to architecture. Membership checks run inside NestJS backend. Frontend remains Angular. Document AI access remains server-side only. |
| **II. Google-Centric Stack** | ✅ PASS | NestJS + Firebase Auth + Prisma/PostgreSQL on Cloud Run. No new non-Google dependencies. |
| **III. No Secret Leaks** | ✅ PASS | No new secrets. Firebase UIDs are public identifiers from validated JWTs. |
| **IV. Data Abstraction (DTOs)** | ✅ PASS | New Company DTO for `GET /api/companies`. Existing DocumentResponseDto unchanged. |
| **V. End-to-End Type Safety** | ✅ PASS | Company DTO will be shareable with Angular frontend. Document interfaces unchanged. |
| **Security: Endpoint Protection** | ✅ PASS | New `CompanyMembershipGuard` enforces authorization on all document endpoints. Company endpoint protected by FirebaseAuthGuard. |
| **Security: IAM Roles** | ✅ PASS | No new IAM roles needed. Feature uses existing PostgreSQL database. |

**Gate Result**: ✅ ALL PASS — No constitution violations.

## Project Structure

### Documentation (this feature)

```text
specs/006-company-doc-access/
├── plan.md              # This file
├── spec.md              # Feature specification
├── research.md          # Phase 0 — Research decisions
├── data-model.md        # Phase 1 — Data model design
├── quickstart.md        # Phase 1 — Integration quickstart
├── contracts/           # Phase 1 — API contracts
│   └── http-api.md      # REST API endpoints with membership enforcement
├── checklists/
│   └── requirements.md  # Quality checklist
└── tasks.md             # Phase 2 — Implementation tasks (speckit.tasks)
```

### Source Code (repository root)

```text
src/
├── app.module.ts                    # Updated: Import CompaniesModule
├── prisma/
│   ├── prisma.module.ts             # Unchanged
│   └── prisma.service.ts            # Unchanged
├── companies/                       # NEW module
│   ├── companies.module.ts          # Module definition
│   ├── companies.controller.ts      # GET /api/companies
│   ├── companies.service.ts         # Membership-aware company queries
│   └── dto/
│       └── company-response.dto.ts  # Company DTO
├── documents/
│   ├── documents.module.ts          # Updated: Add CompanyMembershipGuard
│   ├── documents.controller.ts      # Updated: Add CompanyMembershipGuard
│   ├── documents.service.ts         # Updated: Membership checks for findOne/remove
│   ├── guards/
│   │   ├── firebase-auth.guard.ts   # Unchanged
│   │   └── company-membership.guard.ts  # NEW guard
│   └── dto/                         # Unchanged
├── health/                          # Unchanged
└── main.ts                          # Unchanged

prisma/
├── schema.prisma                    # Updated: Add CompanyMembership model
└── migrations/
    └── <timestamp>_add_company_membership/

tests/
├── unit/
│   ├── companies.service.spec.ts    # NEW
│   ├── company-membership.guard.spec.ts  # NEW
│   └── documents.service.spec.ts    # Updated: Membership check scenarios
└── e2e/
    ├── companies.controller.spec.ts # NEW
    └── documents.controller.spec.ts # Updated: 403 scenarios
```

**Structure Decision**: NestJS modular monolith — new `CompaniesModule` added alongside existing `DocumentsModule`, `HealthModule`, `PrismaModule`. Follows the project's established module-per-domain convention.

## Phase 0 — Research Summary

All research decisions documented in [`research.md`](./research.md). Key decisions:

| ID | Decision | Rationale |
|----|----------|-----------|
| RD-001 | `CompanyMembership` Prisma model with `@@unique([userId, companyId])` + soft-delete | Follows Document pattern; unique constraint prevents duplicates; reactivation via UPDATE |
| RD-002 | Separate `CompanyMembershipGuard` composed with `FirebaseAuthGuard` | SRP; follows existing guard pattern; independently testable |
| RD-003 | Resolve companyId from document for `GET/DELETE /:id` endpoints | Transparent to client; no API contract change |
| RD-004 | New `CompaniesModule` with single `GET /api/companies` endpoint | Clean module separation; follows project conventions |
| RD-005 | Structured JSON logs to stdout → Cloud Logging | Zero additional infrastructure; consistent with existing Logger usage |
| RD-006 | Hybrid guard + service validation pattern | Early rejection via guard where companyId is explicit; service-layer check where companyId must be resolved from DB |

## Phase 1 — Data Model & Contracts

### Data Model

See [`data-model.md`](./data-model.md) for full entity definitions, relationships, state transitions, and query patterns.

**New entity**: `CompanyMembership` (userId, companyId, createdAt, updatedAt, deletedAt)

**Modified entities**: `Company` (adds `memberships` relation — auto-generated by Prisma)

**Unchanged entities**: `Document` (access control enforced at service/guard layer)

### API Contracts

See [`contracts/http-api.md`](./contracts/http-api.md) for full request/response specifications.

| Endpoint | Method | Change | Membership Check |
|----------|--------|--------|-----------------|
| `/api/companies` | GET | **NEW** | Service-layer: filters by user's active memberships |
| `/api/documents` | GET | Modified | Guard: validates user is member of `companyId` query param |
| `/api/documents/upload` | POST | Modified | Guard: validates user is member of `companyId` body field |
| `/api/documents/:id` | GET | Modified | Service-layer: resolves companyId from document, checks membership |
| `/api/documents/:id` | DELETE | Modified | Service-layer: resolves companyId from document, checks membership |

### Constitution Re-Check Post-Design

| Principle | Status | Notes |
|-----------|--------|-------|
| I. Three-Tier Architecture | ✅ PASS | Frontend → NestJS → Document AI unchanged |
| II. Google-Centric Stack | ✅ PASS | All technologies remain within Google ecosystem |
| III. No Secret Leaks | ✅ PASS | No new secrets introduced |
| IV. Data Abstraction (DTOs) | ✅ PASS | `CompanyResponseDto` added; existing DTOs unchanged |
| V. End-to-End Type Safety | ✅ PASS | Company DTO shareable; Document interfaces intact |
| Security: Endpoint Protection | ✅ PASS | Dual-guard pattern: FireAuth → Membership |
| Security: IAM Roles | ✅ PASS | No infrastructure changes |

## Complexity Tracking

> No constitution violations. This section intentionally empty.

## Implementation Phases

### Phase 2 (Next — `/speckit-tasks`)

Tasks to be generated by the tasks workflow:

1. **Database**: Prisma schema update (`CompanyMembership` model), migration, seed
2. **Guard**: `CompanyMembershipGuard` implementation
3. **Companies Module**: Controller, service, DTO, module registration
4. **Documents Module Updates**: Wire guard, add membership checks to `findOne`/`remove`
5. **Audit Logging**: Structured JSON log entries for 403 denials
6. **Tests**: Unit tests (guard, services), E2E tests (companies, document authorization)
7. **Integration**: App module registration, cleanup
