# Implementation Plan: Google Document AI Integration

**Branch**: `003-google-document-ai` | **Date**: 2026-05-30 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `specs/003-google-document-ai/spec.md`

## Summary

Configure the NestJS backend to accept document uploads (PDF/PNG/JPEG/TIFF, ≤5MB), process them synchronously via Google Document AI Form Parser (`us-central1`), extract structured key-value fields, persist results in PostgreSQL, and expose CRUD endpoints protected by Firebase Auth JWT.

## Technical Context

**Language/Version**: TypeScript 5.x, Node.js 20 LTS

**Primary Dependencies**:
- `@google-cloud/documentai` (v8) — Document AI client
- `firebase-admin` (v12) — Firebase Auth JWT verification
- `@nestjs/schedule` — TTL cleanup cron jobs
- `@nestjs/config` — Environment configuration
- `@nestjs/platform-express` — Multer file uploads
- `@prisma/client` + `prisma` — PostgreSQL ORM
- `file-type` — Magic byte MIME detection

**Storage**: PostgreSQL (Cloud SQL or local), temp files on local disk (`/tmp/uploads`)

**Testing**: Jest (unit), Supertest (E2E)

**Target Platform**: Google Cloud Run (serverless container)

**Project Type**: Web service (NestJS API)

**Performance Goals**: <10s total upload-to-response for ≤5MB files (excluding Document AI), handle 10 concurrent uploads

**Constraints**: ≤5MB file size, sync-only processing, fail-fast on Document AI errors

**Scale/Scope**: Single NestJS module within existing Saldare backend

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Status | Notes |
|-----------|--------|-------|
| I. Three-Tier Architecture | ✅ PASS | Angular → NestJS → Document AI — no direct client-to-Document AI calls |
| II. Google-Centric Stack | ✅ PASS | NestJS on Cloud Run, Document AI Form Parser, Firebase Auth, PostgreSQL |
| III. No Secret Leaks | ✅ PASS | Service account via IAM on Cloud Run; env vars for config |
| IV. Data Abstraction (DTOs) | ✅ PASS | `ExtractedField` DTO wraps Document AI output; raw JSON only for debugging |
| V. End-to-End Type Safety | ✅ PASS | `ExtractedField` interface mirrors shared contract |
| Endpoint Protection | ✅ PASS | `AuthGuard` verifies Firebase JWT on all endpoints |
| IAM Roles | ✅ PASS | `documentai.viewer` + `storage.objectAdmin` (for future GCS) |
| Global ExceptionFilter | ✅ PASS | Consistent error responses |
| Idempotency & Cost Control | ✅ PASS | MIME validation + magic byte check before Document AI call |

**Spec/Constitution Conflict Resolution**:
- Spec Q2 resolved "API Key" auth, but Constitution mandates **Firebase Auth JWT**. Constitution supersedes — all endpoints will use Firebase Auth via `AuthGuard`.

## Project Structure

### Documentation (this feature)

```text
specs/003-google-document-ai/
├── plan.md              # This file
├── spec.md              # Feature specification
├── research.md          # Phase 0 — technical research
├── data-model.md        # Phase 1 — entities & state transitions
├── quickstart.md        # Phase 1 — integration scenarios
├── contracts/           # Phase 1 — API contracts
│   ├── http-api.md
│   ├── prisma-schema.md
│   └── config-schema.md
├── checklists/
│   └── requirements.md
└── tasks.md             # (future — /speckit.tasks output)
```

### Source Code (repository root)

```text
src/
├── documents/
│   ├── documents.module.ts
│   ├── documents.controller.ts
│   ├── documents.service.ts
│   ├── dto/
│   │   ├── upload-document.dto.ts
│   │   ├── document-response.dto.ts
│   │   └── document-list-query.dto.ts
│   ├── guards/
│   │   └── firebase-auth.guard.ts
│   ├── filters/
│   │   └── http-exception.filter.ts
│   ├── interfaces/
│   │   └── extracted-field.interface.ts
│   └── config/
│       └── document-ai.config.ts
├── prisma/
│   └── schema.prisma
└── common/
    └── file-validator.ts

tests/
├── unit/
│   └── documents.service.spec.ts
└── e2e/
    └── documents.controller.spec.ts
```

**Structure Decision**: Single NestJS module (`documents/`) within the existing backend. The feature is cohesive — all endpoints, DTOs, guards, and config live in one module. Shared utilities (file validation) go in `common/`.

## Complexity Tracking

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| Firebase Auth over API Keys (Constitution override) | Constitution mandates Firebase Auth for all endpoints | API keys are simpler but violate Constitution's security model |

## Phase 0 — Research

See [research.md](research.md) for full research document.

Key decisions:
1. **Library**: `@google-cloud/documentai` v8 — official client with NestJS support
2. **Uploads**: Multer + disk storage (not memory — prevents OOM)
3. **Validation**: Magic byte check via `file-type` before Document AI call
4. **Processing**: Sync `processDocument()` — fits ≤5MB files
5. **Auth**: Firebase JWT via `AuthGuard` (Constitution mandate)
6. **Persistence**: PostgreSQL via Prisma — JSONB for extraction results
7. **DTO**: `ExtractedField { label, value, confidence }` per Constitution
8. **Storage**: Local disk temp, discard after processing (GCS future)
9. **TTL**: `@nestjs/schedule` daily cron sweep
10. **Errors**: Global `ExceptionFilter` per Constitution

## Phase 1 — Design & Contracts

### Data Model

See [data-model.md](data-model.md) for full entity definitions.

Core entities:
- **Document**: id, companyId, filename, mimeType, fileSize, status, extractedFields (JSONB), rawResponse (JSONB), errorMessage, ttlDays, soft-delete
- **ExtractedField**: label, value, confidence (stored as JSONB array in Document)

State machine: `PENDING → PROCESSING → COMPLETED | FAILED → DELETED`

### Contracts

See [contracts/](contracts/) for full API contracts:

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/documents/upload` | POST | Upload + process (sync) |
| `/api/documents` | GET | List documents (paginated) |
| `/api/documents/:id` | GET | Get single document |
| `/api/documents/:id` | DELETE | Soft-delete document |

Auth: All endpoints require Firebase Bearer JWT via `AuthGuard`.

### Quickstart

See [quickstart.md](quickstart.md) for curl examples, Angular integration, and troubleshooting.

## Re-evaluated Constitution Check (Post-Design)

All gates still pass. The Firebase Auth override (versus spec's API Key) is the only deviation and was mandated by the Constitution itself. The design strictly follows the Three-Tier Architecture, DTO abstraction, end-to-end type safety, and IAM-based security model.

No new violations introduced by the design.
