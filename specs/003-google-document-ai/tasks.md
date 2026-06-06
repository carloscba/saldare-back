---

description: "Task list for Google Document AI Integration feature"

---

# Tasks: Google Document AI Integration

**Input**: Design documents from `specs/003-google-document-ai/`

**Prerequisites**: plan.md (required), spec.md (required for user stories), research.md, data-model.md, contracts/

**Tests**: Included per plan.md — unit tests via Jest, E2E tests via Supertest.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

## Path Conventions

- **Single project**: `src/`, `tests/` at repository root — NestJS backend under `/home/carloscba/Develop/saldare-spec/`
- Paths are relative to the repository root

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Project initialization and basic structure

- [X] T001 Install npm dependencies: `@google-cloud/documentai`, `firebase-admin`, `@nestjs/schedule`, `@nestjs/config`, `file-type`, `@prisma/client`, `prisma`
- [X] T002 [P] Create `src/documents/` module directory structure (controllers, services, dto/, guards/, filters/, interfaces/, config/)
- [X] T003 [P] Create `src/common/` directory for shared utilities
- [X] T004 [P] Create `tests/unit/` and `tests/e2e/` test directories

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core infrastructure that MUST be complete before ANY user story can be implemented

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [X] T005 Create Prisma schema with `Document` model and `DocumentStatus` enum in `src/prisma/schema.prisma`
- [X] T006 [P] Implement `ExtractedField` interface in `src/documents/interfaces/extracted-field.interface.ts`
- [X] T007 [P] Implement `DocumentAIConfig` configuration class in `src/documents/config/document-ai.config.ts`
- [X] T008 [P] Implement `FirebaseAuthGuard` in `src/documents/guards/firebase-auth.guard.ts`
- [X] T009 [P] Implement global `HttpExceptionFilter` in `src/documents/filters/http-exception.filter.ts`
- [X] T010 [P] Create `file-validator.ts` in `src/common/file-validator.ts` with MIME type + magic byte validation
- [X] T011 [P] Create `UploadDocumentDto` in `src/documents/dto/upload-document.dto.ts`
- [X] T012 [P] Create `DocumentResponseDto` in `src/documents/dto/document-response.dto.ts`

**Checkpoint**: Foundation ready — user story implementation can now begin in parallel

---

## Phase 3: User Story 1 — Upload a Document for Processing (Priority: P1) 🎯 MVP

**Goal**: API client uploads a file (PDF/PNG/JPEG/TIFF, ≤5MB), system validates it, sends to Document AI Form Parser, returns extracted structured fields synchronously.

**Independent Test**: POST a sample PDF to `/api/documents/upload` with valid JWT → expect 200 with `extractedFields`.

### Tests for User Story 1 (OPTIONAL) ⚠️

- [X] T013 [P] [US1] Unit test for `DocumentsService.upload()` in `tests/unit/documents.service.spec.ts`
- [X] T014 [P] [US1] E2E test for POST `/api/documents/upload` in `tests/e2e/documents.controller.spec.ts`

### Implementation for User Story 1

- [X] T015 [P] [US1] Implement `DocumentsService.upload()` — file validation, Document AI call, status management, persistence in `src/documents/documents.service.ts`
- [X] T016 [P] [US1] Implement POST `/api/documents/upload` endpoint in `src/documents/documents.controller.ts`
- [X] T017 [US1] Wire `DocumentsModule` — register controller, service, guard, filter, config in `src/documents/documents.module.ts`
- [X] T018 [US1] Add Multer file upload configuration (disk storage, max 5MB) in `src/documents/documents.controller.ts`
- [X] T019 [US1] Add Document AI error handling and 503 response mapping

**Checkpoint**: User Story 1 fully functional — a client can upload a document and get back extracted form fields.

---

## Phase 4: User Story 2 — List and Retrieve Processed Documents (Priority: P2)

**Goal**: API client can list previously processed documents (paginated) and retrieve individual extraction results.

**Independent Test**: Upload a document, then GET `/api/documents?companyId=...` → expect paginated list with the document. GET `/api/documents/:id` → expect full extraction result.

### Tests for User Story 2 (OPTIONAL) ⚠️

- [X] T020 [P] [US2] Unit test for `DocumentsService.findAll()` and `findOne()` in `tests/unit/documents.service.spec.ts`
- [X] T021 [P] [US2] E2E tests for GET endpoints in `tests/e2e/documents.controller.spec.ts`

### Implementation for User Story 2

- [X] T022 [P] [US2] Create `DocumentListQueryDto` in `src/documents/dto/document-list-query.dto.ts`
- [X] T023 [P] [US2] Implement `DocumentsService.findAll()` — paginated list with status/companyId filter in `src/documents/documents.service.ts`
- [X] T024 [P] [US2] Implement `DocumentsService.findOne()` — single document lookup with 404 handling in `src/documents/documents.service.ts`
- [X] T025 [US2] Implement GET `/api/documents` endpoint in `src/documents/documents.controller.ts`
- [X] T026 [US2] Implement GET `/api/documents/:id` endpoint in `src/documents/documents.controller.ts`

**Checkpoint**: User Stories 1 AND 2 work independently — clients can upload, list, and retrieve document extractions.

---

## Phase 5: User Story 3 — Delete a Document (Priority: P3)

**Goal**: API client can soft-delete a document and its extraction data.

**Independent Test**: Upload → DELETE `/api/documents/:id` → expect 200 with `status: "DELETED"`. Subsequent GET returns 404.

### Tests for User Story 3 (OPTIONAL) ⚠️

- [X] T027 [P] [US3] Unit test for `DocumentsService.remove()` in `tests/unit/documents.service.spec.ts`
- [X] T028 [P] [US3] E2E test for DELETE endpoint in `tests/e2e/documents.controller.spec.ts`

### Implementation for User Story 3

- [X] T029 [P] [US3] Implement `DocumentsService.remove()` — soft-delete (set `deletedAt`) in `src/documents/documents.service.ts`
- [X] T030 [US3] Implement DELETE `/api/documents/:id` endpoint in `src/documents/documents.controller.ts`
- [X] T031 [US3] Add soft-delete filtering to list/get queries (exclude deleted documents)

**Checkpoint**: All user stories independently functional.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Improvements that affect multiple user stories

- [X] T032 [P] Implement TTL cleanup cron job via `@nestjs/schedule` in `src/documents/documents.service.ts`
- [X] T033 [P] Add structured logging for Document AI API calls (success + error)
- [X] T034 Run `npx prisma migrate dev` to apply database migration
- [X] T035 Validate end-to-end flow via `quickstart.md` curl examples
- [X] T036 Code cleanup and final review

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — can start immediately
- **Foundational (Phase 2)**: Depends on Setup completion — BLOCKS all user stories
- **User Stories (Phase 3-5)**: All depend on Foundational phase completion
  - Stories can proceed in parallel (if staffed)
  - Or sequentially in priority order (P1 → P2 → P3)
- **Polish (Phase 6)**: Depends on all desired user stories being complete

### User Story Dependencies

- **User Story 1 (P1)**: Can start after Foundational — No dependencies on other stories
- **User Story 2 (P2)**: Can start after Foundational — Depends on upload working (US1) for test data but `findAll()`/`findOne()` are independently implementable
- **User Story 3 (P3)**: Can start after Foundational — Independently testable with direct DB inserts

### Within Each User Story

- Tests MUST be written and FAIL before implementation
- Models/interfaces before services
- Services before endpoints
- Story complete before moving to next priority

### Parallel Opportunities

- **Phase 1**: T002, T003, T004 can run in parallel
- **Phase 2**: T006, T007, T008, T009, T010, T011, T012 can run in parallel
- **Phase 3**: T013, T014 (tests) and T015, T016 (implementation) can run in parallel within the phase
- **Phase 4**: T022, T023, T024 can run in parallel
- **Phase 5**: T029 can run in parallel with tests
- **Phase 6**: T032, T033 can run in parallel

---

## Parallel Example: Phase 2 (Foundational)

```bash
# Launch all independent foundational tasks together:
Task: T006 Create ExtractedField interface
Task: T007 Create DocumentAIConfig
Task: T008 Create FirebaseAuthGuard
Task: T009 Create HttpExceptionFilter
Task: T010 Create file-validator
Task: T011 Create UploadDocumentDto
Task: T012 Create DocumentResponseDto
```

## Parallel Example: Phase 3 (User Story 1)

```bash
# Launch service + controller together:
Task: T015 Implement DocumentsService.upload()
Task: T016 Implement POST /api/documents/upload endpoint
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup
2. Complete Phase 2: Foundational (CRITICAL — blocks all stories)
3. Complete Phase 3: User Story 1 (P1 — upload + process)
4. **STOP and VALIDATE**: POST a PDF → verify extracted fields returned
5. Deploy/demo if ready

### Incremental Delivery

1. Complete Setup + Foundational → Foundation ready
2. Add US1 (Upload + Process) → MVP ready
3. Add US2 (List + Retrieve) → Review past results
4. Add US3 (Delete) → Data privacy compliance
5. Each story adds value without breaking previous stories

### Parallel Team Strategy

With multiple developers:

1. Team completes Setup + Foundational together
2. Once Foundational is done:
   - Developer A: User Story 1 (upload + Document AI)
   - Developer B: User Story 2 (list + get endpoints)
   - Developer C: User Story 3 (delete endpoint)
3. Stories complete and integrate independently

---

## Notes

- [P] tasks = different files, no dependencies
- [Story] label maps task to specific user story for traceability
- Each user story should be independently completable and testable
- Verify tests fail before implementing
- Commit after each task or logical group
- Stop at any checkpoint to validate story independently
- Avoid: vague tasks, same file conflicts, cross-story dependencies that break independence
