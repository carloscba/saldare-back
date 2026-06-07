# Tasks: Document AI Table Extraction Refactoring

**Input**: Design documents from `specs/007-document-ai-table-extraction/`

**Prerequisites**: plan.md (required), spec.md (required for user stories), research.md, data-model.md, contracts/documents-api.md, quickstart.md

**Tests**: Test update tasks are included — the existing `tests/unit/documents.service.spec.ts` must be updated to match new types, and US3 explicitly requires a testable factory.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story. Phases 1-2 establish shared types that all stories depend on.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

## Path Conventions

- **Backend source**: `src/documents/`
- **Tests**: `tests/unit/`, `tests/e2e/`
- Paths follow NestJS convention: modules → providers, dto, config, interfaces

---

## Phase 1: Setup (Shared Type Definitions)

**Purpose**: Create new type files needed by all subsequent phases — no existing code modified yet.

- [X] T001 [P] Create `DocumentTable` interface in `src/documents/dto/document-table.type.ts` — exports `{ headers: string[], rows: string[][] }`
- [X] T002 [P] Create `ExtractedData` interface in `src/documents/dto/extracted-data.type.ts` — exports `{ tables: DocumentTable[] }`

---

## Phase 2: Foundational (Interface & DTO Updates)

**Purpose**: Update shared interfaces and DTOs that all user stories depend on. These are blocking prerequisites for US1/US2/US3.

**⚠️ CRITICAL**: No user story work can begin until this phase is complete.

- [X] T003 Update `DocumentAIClient` interface return type in `src/documents/dto/document-ai-client.type.ts` — change `processDocument` return from `{ extractedFields: [...] }` to `{ tables: DocumentTable[]; rawResponse: unknown }`
- [X] T004 Update `DocumentResponseDto` in `src/documents/dto/document-response.dto.ts` — change `extractedFields` type from `ExtractedField[]` to `ExtractedData` (import from `extracted-data.type`)
- [X] T005 Delete `src/documents/interfaces/extracted-field.interface.ts` and remove its import from `src/documents/dto/document-response.dto.ts`

**Checkpoint**: Foundation ready — all shared types and DTOs updated. User story implementation can now begin.

---

## Phase 3: User Story 1 - Extract Structured Table Data from Documents (Priority: P1) 🎯 MVP

**Goal**: Refactor the Document AI client factory provider to extract only table data (removing key-value/entity extraction) and return structured `{ headers, rows }` arrays. The upload endpoint persists and returns the new format.

**Independent Test**: Upload a document containing a table; verify the response includes `extractedFields: { tables: [{ headers: [...], rows: [[...], ...] }] }` with columns preserved in order.

### Implementation for User Story 1

- [X] T006 [US1] Refactor factory in `src/documents/providers/document-ai-client.provider.ts`:
  - Remove form-fields loop (lines 56-65) — no more key-value extraction
  - Rewrite tables loop (lines 67-84) to build `DocumentTable[]` instead of flat `extractedFields`:
    - For each table: extract headers from `headerRows.cells[]` as `string[]`
    - For each table: extract body rows from `bodyRows.cells[]` as `string[][]`
    - Normalize rows: pad shorter rows with `""` to match `headers.length`; slice longer rows to `headers.length`
    - Handle empty cells: `cell.layout?.textAnchor?.content ?? ''`
    - Keep tables separate per page (do not merge across pages)
  - Return `{ tables: DocumentTable[], rawResponse: result }`
  - Keep `process.env` for config (will be replaced in US3)
- [X] T007 [US1] Update `upload()` method in `src/documents/documents.service.ts` (line 178-184): persist `result.tables` in `extractedFields` column as `{ tables: result.tables }` instead of `result.extractedFields` flat array
- [X] T008 [US1] Update unit test mock data in `tests/unit/documents.service.spec.ts` — change `processDocument` mock return to `{ tables: [...], rawResponse: {} }` format matching new DocumentTable shape

**Checkpoint**: User Story 1 should be fully functional — upload returns structured table data. Documents with no tables return `{ tables: [] }`.

---

## Phase 4: User Story 2 - Retrieve Documents with Structured Table Data (Priority: P2)

**Goal**: The GET endpoints return structured table data. Backward compatibility with old flat-format documents detected at read time — no DB migration needed.

**Independent Test**: Upload a document with tables, then GET `/api/documents/:id` and confirm `extractedFields` is `{ tables: [...] }` with structured headers and rows.

### Implementation for User Story 2

- [X] T009 [US2] Update `toResponseDto()` method in `src/documents/documents.service.ts` (line 208-223) with old-format detection:
  - Check if `doc.extractedFields` is an array with `Array.isArray()`
  - If array (old format) → return `{ tables: [] }`
  - If object with `tables` (new format) → return as-is
  - If null/undefined → return `undefined`
- [X] T010 [US2] Update e2e test assertions in `tests/e2e/documents.controller.spec.ts` — verify GET responses use new `{ tables: [...] }` shape (if test file exists and has extraction assertions)

**Checkpoint**: User Stories 1 AND 2 both work independently — upload and retrieval both use structured table format. Old documents are retrievable.

---

## Phase 5: User Story 3 - Factory Uses Proper Configuration Injection (Priority: P3)

**Goal**: The factory provider receives Document AI configuration via NestJS dependency injection instead of reading `process.env` directly.

**Independent Test**: Mock the NestJS config in a unit test and verify the factory reads config values from the injected config object rather than `process.env`.

### Implementation for User Story 3

- [X] T011 [US3] Refactor factory in `src/documents/providers/document-ai-client.provider.ts`:
  - Import `ConfigType` from `@nestjs/config` and `documentAiConfig` from `../config/document-ai.config`
  - Add `inject: [documentAiConfig.KEY]` to the `FactoryProvider` definition
  - Change `useFactory` from `() => { ... }` to `(config: ConfigType<typeof documentAiConfig>) => { ... }`
  - Replace `process.env.DOCUMENT_AI_PROJECT_ID` → `config.projectId`
  - Replace `process.env.DOCUMENT_AI_PROCESSOR_ID` → `config.processorId`
  - Replace `process.env.DOCUMENT_AI_PROCESSOR_LOCATION` → `config.processorLocation`
  - The `apiEndpoint` uses `config.processorLocation` instead of the old `process.env` default
- [X] T012 [US3] Update unit test in `tests/unit/documents.service.spec.ts` — verify factory config injection works with the mocked `documentAiConfig` token (already mocked in test setup, verify it propagates correctly through the provider)

**Checkpoint**: All user stories now independently functional. Factory is testable with mocked config.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Validation, cleanup, and verification across all stories.

- [X] T013 [P] Run lint and type-check on changed files: `npm run lint` and `npm run build`
- [X] T014 Run quickstart.md validation steps — verify upload and retrieval flow with new table format
- [X] T015 [P] Review and remove any remaining references to `ExtractedField` across the codebase (grep for `ExtractedField`, `extracted-field`)

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — can start immediately. T001 and T002 are parallel.
- **Foundational (Phase 2)**: Depends on Phase 1 (types must exist first). T003-T005 are sequential (DTO imports changed types). BLOCKS all user stories.
- **User Story 1 (Phase 3)**: Depends on Phase 2. T006 must precede T007 (service uses updated factory return type). T008 depends on T006-T007.
- **User Story 2 (Phase 4)**: Depends on Phase 3 (service must already persist new format). T009 depends on T007. T010 depends on T009.
- **User Story 3 (Phase 5)**: Depends on Phase 3 (provider must already have table extraction logic). T011 is an additive change on top of T006. T012 depends on T011.
- **Polish (Phase 6)**: Depends on all desired user stories being complete.

### User Story Dependencies

- **User Story 1 (P1)**: Can start after Phase 2 — no dependencies on US2/US3.
- **User Story 2 (P2)**: Can start after US1 (T007 must be done first — service upload is the prerequisite for retrieval format).
- **User Story 3 (P3)**: Can start after US1-core (T006 must be done first — config injection is additive on top of the refactored factory).

### Within Each User Story

- Provider changes before service changes
- Service changes before test updates
- Core implementation before integration

### Parallel Opportunities

- T001 and T002 can run in parallel (different files, no dependencies)
- T013 and T015 can run in parallel (different concerns)
- Once Phase 2 completes, US1 is the only active story (sequential by priority per spec)

---

## Parallel Example: Phase 1 Setup

```bash
# Launch both type definition tasks together:
Task: "Create DocumentTable interface in src/documents/dto/document-table.type.ts"
Task: "Create ExtractedData interface in src/documents/dto/extracted-data.type.ts"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup (T001, T002 in parallel)
2. Complete Phase 2: Foundational (T003 → T004 → T005 sequentially)
3. Complete Phase 3: User Story 1 (T006 → T007 → T008)
4. **STOP and VALIDATE**: Upload a document with tables, verify structured response
5. Deploy/demo if ready — upload returns `{ tables: [...] }`

### Incremental Delivery

1. Setup + Foundational → Foundation ready
2. Add User Story 1 → Upload returns structured tables → Deploy/Demo (MVP!)
3. Add User Story 2 → Retrieval returns structured tables, old docs compatible → Deploy/Demo
4. Add User Story 3 → Factory testable with mocked config → Deploy/Demo
5. Add Polish → Lint, typecheck, cleanup → Release

### Refactoring Cohesion Note

T006 (US1) and T011 (US3) both modify the same provider file (`document-ai-client.provider.ts`). They are intentionally split across user stories to preserve the spec's priority ordering (P1 → P3). If implementing sequentially, T011 should be applied as an additive change on top of T006 — do not rewrite the entire factory. The provider file will be complete after both T006 and T011.

---

## Notes

- [P] tasks = different files, no dependencies
- [Story] label maps task to specific user story (US1, US2, US3)
- Each user story should be independently completable and testable
- Commit after each task or logical group
- Stop at any checkpoint to validate story independently
- Avoid: vague tasks, same file conflicts, cross-story dependencies that break independence
