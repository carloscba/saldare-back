# Tasks: Bank Movement CRUD

**Input**: Design documents from `/specs/008-save-bank-movements/`

**Prerequisites**: plan.md (required), spec.md (required), research.md, data-model.md, contracts/

**Tests**: Included per plan.md D-009 (Jest unit tests for services, e2e tests for controllers).

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Create module directory structure

- [x] T001 Create module directory structure: `src/movements/` and `src/movements/dto/`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Prisma schema, shared DTOs, module skeleton — MUST be complete before ANY user story

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [x] T002 Add Movement model to `prisma/schema.prisma` (fields: id, documentId, movementDate @db.Date, description, amount @db.Decimal(15,2), category, createdAt, updatedAt, deletedAt, plus indexes on documentId and deletedAt)
- [x] T003 Add `movements Movement[]` reverse relation to Document model in `prisma/schema.prisma`
- [x] T004 Generate and apply Prisma migration: `npx prisma migrate dev --name add-movement-table`
- [x] T005 [P] Create MovementResponseDto with all fields (id, documentId, movementDate, description, amount, category, createdAt, updatedAt, deletedAt) in `src/movements/dto/movement-response.dto.ts`
- [x] T006 [P] Create PaginatedResponseDto generic class (items, total, page, limit, totalPages) in `src/movements/dto/paginated-response.dto.ts`
- [x] T007 Create MovementsService skeleton with PrismaService injection and a private `toResponseDto()` mapper method in `src/movements/movements.service.ts`
- [x] T008 Create MovementsModule importing nothing (PrismaService is @Global) and registering MovementsService in `src/movements/movements.module.ts`

**Checkpoint**: Foundation ready — database migrated, shared DTOs and module skeleton in place. User story implementation can now begin.

---

## Phase 3: User Story 1 - Save a Bank Movement (Priority: P1) 🎯 MVP

**Goal**: Authenticated company member can save a single bank movement linked to a COMPLETED document. Returns 201 with the created movement.

**Independent Test**: `POST /api/movements` with `{ movementDate, description, amount, documentId }` using a valid Bearer token — receives 201 with movement object including generated id.

### Tests for User Story 1

> Write these tests FIRST, ensure they FAIL before implementation.

- [x] T009 [P] [US1] Unit test: MovementsService.create() success path and error cases (document not found, not COMPLETED, future date, non-member) in `src/movements/movements.service.spec.ts`
- [x] T010 [P] [US1] E2e test: POST /api/movements — 201 success, 400 validation, 401 no auth, 403 non-member, 404 document not found in `test/movements/movements.e2e-spec.ts`

### Implementation for User Story 1

- [x] T011 [P] [US1] Create CreateMovementDto with class-validator decorators (IsDateString, IsString/MaxLength(255), IsNumber, IsOptional/String/MaxLength(255), IsUUID(4)) in `src/movements/dto/create-movement.dto.ts`
- [x] T012 [US1] Implement `create(dto: CreateMovementDto, userId: string)` in MovementsService:
  - Validate document exists and is not soft-deleted
  - Validate document.status === COMPLETED (FR-007)
  - Validate movementDate is not future (FR-010)
  - Validate company membership via Document -> Company -> CompanyMembership (FR-002, FR-006)
  - Create movement via `prisma.movement.create()`
  - Return MovementResponseDto with amount as string
  - Throw appropriate exceptions (NotFoundException, ForbiddenException, BadRequestException)
- [x] T013 [US1] Create MovementsController with `@UseGuards(FirebaseAuthGuard)` and `@Post()` handler extracting `userId` from `request.user.uid`, calling service.create(), returning 201 in `src/movements/movements.controller.ts`
- [x] T014 [US1] Register MovementsController in MovementsModule controllers array and import MovementsModule in `src/app.module.ts`

**Checkpoint**: User Story 1 fully functional — can create a single movement with all validation and access control. MVP ready.

---

## Phase 4: User Story 2 - List Movements for a Document (Priority: P2)

**Goal**: Authenticated company member can list all movements for a document with pagination (sorted by movementDate desc).

**Independent Test**: `GET /api/movements?documentId=<id>&page=1&limit=20` returns paginated response `{ items, total, page, limit, totalPages }`.

### Tests for User Story 2

- [x] T015 [P] [US2] Unit test: MovementsService.findAll() — paginated results, empty list, non-member access denied in `src/movements/movements.service.spec.ts`
- [x] T016 [P] [US2] E2e test: GET /api/movements — 200 paginated, 200 empty, 403 non-member, 404 document not found, 400 invalid params in `test/movements/movements.e2e-spec.ts`

### Implementation for User Story 2

- [x] T017 [P] [US2] Create MovementListQueryDto with class-validator decorators (IsUUID(4) on documentId, IsOptional/IsInt/Min(1) on page default 1, IsOptional/IsInt/Min(1)/Max(100) on limit default 20, with @Type(() => Number)) in `src/movements/dto/movement-list-query.dto.ts`
- [x] T018 [US2] Implement `findAll(query: MovementListQueryDto, userId: string)` in MovementsService:
  - Validate document exists and is not soft-deleted
  - Validate company membership (same pattern as create)
  - Query `prisma.movement.findMany()` with `where: { documentId, deletedAt: null }`, `orderBy: { movementDate: 'desc' }`, `skip`/`take` for pagination
  - Run `prisma.movement.count()` with same where for total
  - Return `{ items: MovementResponseDto[], total, page, limit, totalPages }`
- [x] T019 [US2] Add `@Get()` handler to MovementsController using `@Query(ValidationPipe)` to receive MovementListQueryDto, calling service.findAll(), returning 200

**Checkpoint**: User Stories 1 AND 2 both functional — can create and list movements for a document.

---

## Phase 5: User Story 3 - Batch Save Movements (Priority: P3)

**Goal**: Authenticated company member can save multiple movements atomically for a single document (max 100 items). Either all succeed or none are persisted.

**Independent Test**: `POST /api/movements/batch` with array of N movements — receives 201 with array of N created movements. Invalid batch returns 400 with no partial save.

### Tests for User Story 3

- [x] T020 [P] [US3] Unit test: MovementsService.batchCreate() — success, atomic rollback on invalid item, batch >100 rejected in `src/movements/movements.service.spec.ts`
- [x] T021 [P] [US3] E2e test: POST /api/movements/batch — 201 success, 400 validation/atomicity, 400 exceeding 100 limit, 403 non-member in `test/movements/movements.e2e-spec.ts`

### Implementation for User Story 3

- [x] T022 [P] [US3] Create CreateMovementItemDto with class-validator decorators (IsDateString, IsString/MaxLength(255), IsNumber, IsOptional/String/MaxLength(255)) — same as CreateMovementDto but without documentId — in `src/movements/dto/create-movement-item.dto.ts`
- [x] T023 [P] [US3] Create BatchCreateMovementsDto with IsUUID(4) documentId and IsArray/ValidateNested({each: true})/ArrayMinSize(1)/ArrayMaxSize(100)/@Type(() => CreateMovementItemDto) movements in `src/movements/dto/batch-create-movements.dto.ts`
- [x] T024 [US3] Implement `batchCreate(dto: BatchCreateMovementsDto, userId: string)` in MovementsService:
  - Validate document exists, not soft-deleted, status === COMPLETED
  - Validate company membership
  - Pre-validate all items (future dates, required fields)
  - Wrap all creates in `prisma.$transaction()` for atomicity
  - Return array of MovementResponseDto
  - Throw BadRequestException on any item validation failure (no partial save)
- [x] T025 [US3] Add `@Post('batch')` handler to MovementsController using `@Body(ValidationPipe)` to receive BatchCreateMovementsDto, calling service.batchCreate(), returning 201

**Checkpoint**: All user stories functional — create, list, and batch-create movements.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Validation and quality assurance across all stories

- [ ] T026 Run quickstart.md validation — execute all curl examples against local server, verify each response matches expected output
- [x] T027 [P] Run ESLint: `npx eslint src/movements/ --ext .ts` and fix any issues
- [x] T028 [P] Run TypeScript typecheck: `npx tsc --noEmit` and fix any type errors
- [x] T029 Run all tests: `npm test` and verify all pass

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — can start immediately
- **Foundational (Phase 2)**: Depends on Phase 1 (directory exists). T002-T004 sequentially. T005-T006 parallel. T007 after T004 (needs Prisma types). T008 after T007. **BLOCKS all user stories.**
- **User Story 1 (Phase 3)**: Depends on Phase 2. T009-T010 (tests) parallel. T011 parallel with tests. T012 after T011 (DTO needed). T013 after T012. T014 after T008,T013.
- **User Story 2 (Phase 4)**: Depends on Phase 3 (needs controller/service already created). T015-T016 (tests) parallel. T017 parallel with tests. T018 after T017. T019 after T018.
- **User Story 3 (Phase 5)**: Depends on Phase 3 (needs controller/service already created). T020-T021 (tests) parallel. T022-T023 parallel. T024 after T022,T023. T025 after T024.
- **Polish (Phase 6)**: Depends on all user stories complete. T027-T028 parallel. T026 after T029 (tests pass first).

### Within Each User Story

- Tests (T009-T010, T015-T016, T020-T021) MUST be written and FAIL before implementation
- DTOs before service methods
- Service methods before controller handlers
- Controller+service before module wiring

### Parallel Opportunities

- T005 and T006 (shared DTOs) can run in parallel
- T009 and T010 (US1 tests) can run in parallel
- T011 (US1 DTO) can run in parallel with T009,T010
- T015 and T016 (US2 tests) can run in parallel
- T020 and T021 (US3 tests) can run in parallel
- T022 and T023 (US3 DTOs) can run in parallel
- T027 and T028 (lint + typecheck) can run in parallel
- US2 and US3 could theoretically start in parallel after US1 Phase 3 is done (they extend the same service/controller but different methods)

---

## Parallel Example: Phase 3 (US1)

```bash
# Launch all US1 DTOs and tests together:
Task: "Create CreateMovementDto in src/movements/dto/create-movement.dto.ts"  (T011)
Task: "Unit tests for MovementsService.create() in src/movements/movements.service.spec.ts"  (T009)
Task: "E2e tests for POST /api/movements in test/movements/movements.e2e-spec.ts"  (T010)
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup (T001)
2. Complete Phase 2: Foundational (T002-T008)
3. Complete Phase 3: User Story 1 (T009-T014)
4. **STOP and VALIDATE**: Test User Story 1 independently
5. Deploy/demo if ready — single movement save endpoint working

### Incremental Delivery

1. Setup + Foundational → Foundation ready
2. Add User Story 1 → Test independently → Deploy/Demo (MVP!)
3. Add User Story 2 → Test independently → Deploy/Demo (list functionality)
4. Add User Story 3 → Test independently → Deploy/Demo (batch save)
5. Each story adds value without breaking previous stories

### Parallel Team Strategy

With multiple developers:
1. Team completes Setup + Foundational together (Phase 1-2)
2. Once Foundational is done, Developer A takes US1
3. After US1 Phase 3 is done:
   - Developer A: User Story 2
   - Developer B: User Story 3 (can start in parallel with US2)

---

## Notes

- [P] tasks = different files, no dependencies
- [Story] label maps task to specific user story for traceability
- Each user story should be independently completable and testable
- Verify tests fail before implementing
- Commit after each task or logical group
- Stop at any checkpoint to validate story independently
- PrismaService is @Global() — no need to import PrismaModule in MovementsModule
- FirebaseAuthGuard import path: `src/documents/guards/firebase-auth.guard`
