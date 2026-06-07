# Implementation Plan: Document AI Table Extraction Refactoring

**Branch**: `007-document-ai-table-extraction` | **Date**: 2026-06-06 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `specs/007-document-ai-table-extraction/spec.md`

## Summary

Refactor `DocumentAiClientFactory` to extract **only table data** from the Document AI Form Parser response (removing key-value/entity extraction), return structured tables with `headers` and `rows` arrays, inject configuration via NestJS DI instead of reading `process.env`, and handle backward compatibility with old flat-format documents at read time.

## Technical Context

**Language/Version**: TypeScript 5.x / Node.js 22+

**Primary Dependencies**: NestJS 10+, `@google-cloud/documentai` v9.x, Prisma 5.x, `@nestjs/config`

**Storage**: PostgreSQL (via Prisma), `extractedFields` JSONB column (no schema migration)

**Testing**: Jest (unit), Supertest/Jest (e2e)

**Target Platform**: Google Cloud Run (serverless container), Linux

**Project Type**: web-service (NestJS backend API)

**Performance Goals**: Table extraction adds no measurable latency over existing Document AI call. Document AI response time dominates (<15s per spec SC-001).

**Constraints**: <5MB file uploads (existing limit). No new GCP APIs or permissions needed. Backward compatible with existing documents.

**Scale/Scope**: Single-digit concurrent uploads (existing). ~5 files changed. No new modules or dependencies.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Status | Notes |
|-----------|--------|-------|
| I. Three-Tier Architecture | ✅ PASS | No change. Backend still mediates between client and Document AI. Direct client-to-Document AI prohibited. |
| II. Google-Centric Stack | ✅ PASS | Uses existing `@google-cloud/documentai`. No new external services. |
| III. No Secret Leaks | ✅ PASS | Config injection from env vars via ConfigService — no hardcoded keys added. |
| IV. Data Abstraction (DTOs) | ✅ PASS | Raw Document AI response is parsed into `DocumentTable[]` before returning. No raw `document.pages` exposed. |
| V. End-to-End Type Safety | ✅ PASS | `DocumentTable` interface is defined in backend. Frontend must mirror or consume the new shape. |

**Post-Design Re-check**: All principles still pass. The `DocumentTable` interface replaces `ExtractedField` as the shared contract. Frontend (`Angular`) must update its interface mirror.

## Project Structure

### Documentation (this feature)

```text
specs/007-document-ai-table-extraction/
├── plan.md              # This file
├── research.md          # Phase 0: 6 research decisions
├── data-model.md        # Phase 1: entities, state transitions
├── quickstart.md        # Phase 1: verification & test commands
├── contracts/           # Phase 1: API contracts
│   └── documents-api.md
└── tasks.md             # Phase 2 (by /speckit.tasks)
```

### Source Code (changed files)

```text
src/documents/
├── providers/
│   └── document-ai-client.provider.ts   # REFACTOR: inject config, extract only tables
├── dto/
│   ├── document-ai-client.type.ts       # UPDATE: return type → { tables, rawResponse }
│   ├── document-response.dto.ts         # UPDATE: extractedFields type → ExtractedData
│   └── document-table.type.ts           # NEW: DocumentTable interface
├── interfaces/
│   └── extracted-field.interface.ts     # DELETE or deprecate (replaced by DocumentTable)
└── documents.service.ts                 # UPDATE: toResponseDto() old-format detection

tests/
├── unit/
│   └── documents.service.spec.ts        # UPDATE: mock data to new format
└── e2e/
    └── documents.controller.spec.ts     # UPDATE: assertions for new response shape
```

## Complexity Tracking

No violations. All constitution checks pass.

## Phase 0 — Research (see [research.md](./research.md))

| ID | Topic | Decision |
|----|-------|----------|
| R1 | Document AI table response structure | Use `document.pages[].tables[]` from v9.x API (already accessed today) |
| R2 | NestJS FactoryProvider config injection | Use `inject: [documentAiConfig.KEY]` in FactoryProvider |
| R3 | Response DTO shape change | `extractedFields` changes to `{ tables: DocumentTable[] }` |
| R4 | Table header/row normalization | Pad rows to header count; drop extra columns |
| R5 | Multi-page handling | Tables from each page kept separate in flat `tables` array |
| R6 | Old format detection | `Array.isArray()` check in `toResponseDto()` — no DB migration |

## Phase 1 — Design & Contracts (see artifacts)

- [data-model.md](./data-model.md): DocumentTable entity, extractedFields shape change, DocumentAIClient interface update, DocumentResponseDto update
- [contracts/documents-api.md](./contracts/documents-api.md): POST/GET response contract changes, TypeScript interfaces, backward compatibility
- [quickstart.md](./quickstart.md): Verification steps, key files changed, test commands
