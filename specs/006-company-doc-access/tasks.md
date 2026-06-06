# Tasks: Control de Acceso a Documentos por Compañía

**Input**: Design documents from `specs/006-company-doc-access/`

**Prerequisites**: plan.md (required), spec.md (required), research.md, data-model.md, contracts/http-api.md, quickstart.md

**Tests**: Included — spec success criteria require E2E and unit tests to validate 100% rejection rate (SC-001) and data leak prevention (SC-004).

**Organization**: Tasks grouped by user story for independent implementation and testing.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Exact file paths in descriptions

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Create directory structure and placeholder files needed before implementation begins

- [ ] T001 [P] Create directory structure: `src/companies/`, `src/companies/dto/`, `src/documents/guards/` (verify all parent dirs exist)

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Database schema and migration — MUST complete before ANY user story can be implemented

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [ ] T002 Add `CompanyMembership` model to `prisma/schema.prisma` (fields: id, userId, companyId, createdAt, updatedAt, deletedAt; constraints: `@@unique([userId, companyId])`, `@@index([userId])`, `@@index([companyId])`; relation to Company)
- [ ] T003 Run database migration: `npx prisma migrate dev --name add_company_membership` (generates migration file + regenerates PrismaClient with new types)

**Checkpoint**: Foundation ready — user story implementation can now begin in parallel

---

## Phase 3: User Story 1 - Asegurar que usuarios solo acceden a documentos de sus compañías (Priority: P1) 🎯 MVP

**Goal**: Enforce membership verification on all document endpoints. Authenticated users not belonging to the document's company receive 403/404. Authorization denials are logged as structured JSON to stdout.

**Independent Test**: Authenticate two users assigned to different companies. User A accessing company B's documents gets 403 on list/upload, 404 on get-by-id/delete.

### Implementation for User Story 1

- [ ] T004 [US1] Implement `CompanyMembershipGuard` in `src/documents/guards/company-membership.guard.ts` — reads `request.user.uid` (set by FirebaseAuthGuard), extracts `companyId` from request query/body, queries `CompanyMembership` for active membership, throws `ForbiddenException` with structured log on denial
- [ ] T005 [US1] Wire `CompanyMembershipGuard` to `DocumentsController` in `src/documents/documents.controller.ts` — update `@UseGuards` on list and upload endpoints to include guard (findAll: extract from query, upload: extract from body); findOne/remove stay unchanged (handled in service layer)
- [ ] T006 [US1] Register `CompanyMembershipGuard` as a provider in `src/documents/documents.module.ts`
- [ ] T007 [US1] Add membership check to `DocumentsService.findOne()` in `src/documents/documents.service.ts` — after fetching document, resolve `companyId`, verify active membership via Prisma, throw `NotFoundException` if not a member (404 to hide document existence, consistent with FR-005)
- [ ] T008 [US1] Add membership check to `DocumentsService.remove()` in `src/documents/documents.service.ts` — same pattern as findOne: resolve companyId from document, verify membership, throw `NotFoundException` if not a member
- [ ] T009 [US1] Add structured audit logging to `CompanyMembershipGuard` in `src/documents/guards/company-membership.guard.ts` — log JSON to stdout on 403 with fields: `timestamp`, `userId`, `requestedCompanyId`, `endpoint`, `reason`; use NestJS `Logger` at `warn` level (per RD-005)

### Tests for User Story 1

- [ ] T010 [P] [US1] Create unit tests for `CompanyMembershipGuard` in `tests/unit/company-membership.guard.spec.ts` — test: allows member access, rejects non-member with 403, rejects missing companyId, verifies structured log output
- [ ] T011 [P] [US1] Update unit tests for `DocumentsService` in `tests/unit/documents.service.spec.ts` — add membership check scenarios: findOne/remove for non-member throws NotFoundException, findOne/remove for member succeeds; mock `companyMembership.findFirst`
- [ ] T012 [P] [US1] Update E2E tests for `DocumentsController` in `tests/e2e/documents.controller.spec.ts` — add 403 scenarios: list with non-member companyId, upload to non-member companyId; add 404 scenario: get-by-id when user is not member of document's company; override `CompanyMembershipGuard` with a pass-through for existing positive tests

**Checkpoint**: User Story 1 is fully functional — unauthorized users are blocked from all document endpoints with correct error codes and audit logs

---

## Phase 4: User Story 2 - Listar solo las compañías a las que pertenece el usuario (Priority: P1) 🎯 MVP

**Goal**: `GET /api/companies` returns only companies where the authenticated user has an active membership (`deletedAt IS NULL`). Empty list for users with no memberships.

**Independent Test**: Create multiple companies, assign user to a subset. GET /api/companies returns only assigned companies.

### Implementation for User Story 2

- [ ] T013 [P] [US2] Create `CompanyResponseDto` in `src/companies/dto/company-response.dto.ts` — fields: `id` (string), `name` (string), `createdAt` (Date)
- [ ] T014 [US2] Implement `CompaniesService` in `src/companies/companies.service.ts` — method `findByUser(userId: string)`: joins `CompanyMembership` (active only) with `Company`, returns companies ordered by name ASC; depends on T013
- [ ] T015 [US2] Implement `CompaniesController` in `src/companies/companies.controller.ts` — single `GET /api/companies` endpoint; protected by `FirebaseAuthGuard`; reads `request.user.uid`, calls `CompaniesService.findByUser()`
- [ ] T016 [US2] Create `CompaniesModule` in `src/companies/companies.module.ts` — imports `PrismaModule` (already global), declares `CompaniesController` and `CompaniesService`, exports nothing
- [ ] T017 [US2] Import `CompaniesModule` into `AppModule` in `src/app.module.ts`

### Tests for User Story 2

- [ ] T018 [P] [US2] Create unit tests for `CompaniesService` in `tests/unit/companies.service.spec.ts` — test: returns only active memberships, excludes soft-deleted memberships, returns empty array for user with no memberships, verifies Prisma query shape (join + deletedAt filter)
- [ ] T019 [P] [US2] Create E2E tests for `CompaniesController` in `tests/e2e/companies.controller.spec.ts` — test: 401 without auth, 200 with companies (seeded memberships), 200 with empty list, verify response shape matches `CompanyResponseDto`

**Checkpoint**: Users can list their authorized companies. US1 + US2 together form the complete MVP.

---

## Phase 5: User Story 3 - Registrar la relación usuario-compañía (Priority: P2)

**Goal**: Membership records can be inserted directly in the database and the authorization layer immediately enforces them. Seed data enables testing and development workflows.

**Independent Test**: INSERT a membership row in the database, then verify the user can access the company's documents via US1 and see the company via US2.

### Implementation for User Story 3

- [ ] T020 [US3] Create seed script for test memberships in `prisma/seed.ts` (or extend existing seed) — insert test companies and memberships using `prisma.companyMembership.create()`; handle unique constraint gracefully for re-runs (use `upsert`)
- [ ] T021 [US3] Verify end-to-end membership lifecycle: test reactivation scenario — soft-delete a membership (`deletedAt = NOW()`), verify user loses access (403), then reactivate (`deletedAt = NULL`), verify user regains access (200) — documented in `specs/006-company-doc-access/quickstart.md` step 4.6-4.7

**Checkpoint**: Membership data is seedable and the authorization layer responds to state changes (add, remove, reactivate) in real time.

---

## Phase 6: User Story 4 - Documentos heredan visibilidad por compañía (Priority: P2)

**Goal**: Documents uploaded by one member are visible to all other members of the same company. Cross-company visibility is strictly prevented.

**Independent Test**: Two users in the same company upload documents; each can see the other's documents. A third user in a different company cannot see either user's documents.

### Implementation for User Story 4

- [ ] T022 [US4] Verify cross-user document visibility — confirm (via US1 tests) that the existing `findAll` query already returns all documents for a company (not filtered by uploader), and that the guard allows any active member regardless of who uploaded the document
- [ ] T023 [US4] Update E2E tests in `tests/e2e/documents.controller.spec.ts` — add scenario: user A uploads to company C1, user B (also member of C1) lists documents and sees user A's upload; user C (member of C2 only) lists C1 and gets 403

**Checkpoint**: Document visibility model confirmed — company-scoped documents visible to all members, invisible to non-members.

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: Final integration verification, cleanup, and validation against quickstart guide

- [ ] T024 Run quickstart.md validation — execute all steps from `specs/006-company-doc-access/quickstart.md` and verify expected results
- [ ] T025 [P] Run npm typecheck/lint — `npm run lint` (if available) to verify no TypeScript errors or lint violations introduced
- [ ] T026 [P] Run full test suite — `npm test` and `npm run test:e2e` to confirm all existing and new tests pass
- [ ] T027 Review all FR-001 to FR-010 coverage against implemented code (guard, service, controller, schema) — document any gaps

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — can start immediately
- **Foundational (Phase 2)**: Depends on Setup completion — BLOCKS all user stories
- **User Story 1 (Phase 3)**: Depends on Foundational (Phase 2) — needs Prisma types for CompanyMembership
- **User Story 2 (Phase 4)**: Depends on Foundational (Phase 2) — needs Prisma types; CAN run in parallel with Phase 3
- **User Story 3 (Phase 5)**: Depends on Foundational (Phase 2) — no dependency on US1/US2 but validates against them
- **User Story 4 (Phase 6)**: Depends on US1 (Phase 3) — cross-user visibility tests require guard to be operational
- **Polish (Phase 7)**: Depends on all desired user stories being complete

### User Story Dependencies

```
Phase 2: Foundational (BLOCKS all)
  ├── Phase 3: US1 - Authorization (P1) ──┐
  ├── Phase 4: US2 - Company List (P1) ──┤
  ├── Phase 5: US3 - Membership DB (P2) ─┤
  │                                      │
  └── Phase 6: US4 - Visibility (P2) ────┘ (depends on US1)
       │
       └── Phase 7: Polish
```

### Within Each User Story

- Guard before controller wiring (T004 → T005)
- Service before controller (T014 → T015)
- Module after controller + service (T016 after T014, T015)
- Core implementation before tests (T004-T009 before T010-T012)
- Tests marked [P] within a story can run in parallel

### Parallel Opportunities

- **Phase 2**: T002 and T003 are sequential (migrate needs schema first)
- **Phase 3 vs Phase 4**: Can run simultaneously after Phase 2 completes
- **Phase 5 vs Phase 3/4**: Can start after Phase 2, validates independently
- **Within Phase 3**: T010, T011, T012 (all tests) can run in parallel after T004-T009 complete
- **Within Phase 4**: T013 and T018 (DTO + unit test) can start early; T019 after T015-T017 complete

## Parallel Example: Phase 3 + Phase 4 Simultaneous

```bash
# After Phase 2 completes, launch Phase 3 and Phase 4 in parallel:

# Phase 3 tasks:
Task: "T004 [US1] Implement CompanyMembershipGuard in src/documents/guards/company-membership.guard.ts"
Task: "T005 [US1] Wire CompanyMembershipGuard to DocumentsController..."
Task: "T006 [US1] Register guard in documents.module.ts"
Task: "T007-T009 [US1] Service-layer checks + audit logging"

# Phase 4 tasks (different files, no conflicts):
Task: "T013 [P] [US2] Create CompanyResponseDto in src/companies/dto/company-response.dto.ts"
Task: "T014-T017 [US2] CompaniesService → Controller → Module → AppModule"
```

---

## Implementation Strategy

### MVP First (User Story 1 + 2 Only)

1. Complete Phase 1: Setup
2. Complete Phase 2: Foundational (Prisma schema + migration) — **CRITICAL blocker**
3. Complete Phase 3: User Story 1 (Authorization enforcement)
4. Complete Phase 4: User Story 2 (Company list endpoint)
5. **STOP and VALIDATE**: Seed test data, verify 403 blocks, verify company list
6. Deploy MVP — authorization layer is functional

### Incremental Delivery

1. Setup + Foundational → Database ready
2. Add US1 + US2 → Test independently → Deploy (MVP!)
3. Add US3 → Verify lifecycle → Deploy
4. Add US4 → Verify cross-user visibility → Deploy
5. Polish → Final validation

### Suggested MVP Scope

**MVP consists of Phases 1-4** (Setup + Foundational + US1 + US2). These are both P1 stories and together provide:
- Complete authorization guard on all document endpoints
- `GET /api/companies` filtering by membership
- Audit logging for all 403 denials
- Unit and E2E test coverage for both stories

---

## Notes

- [P] tasks = different files, no dependencies — can run in parallel
- [Story] label maps task to specific user story for traceability
- `CompanyMembershipGuard` dependency injection: uses `PrismaService` (global, available via `PrismaModule`)
- `CompaniesService` dependency injection: uses `PrismaService` (global)
- Existing `PassAuthGuard` pattern in E2E tests (`tests/e2e/documents.controller.spec.ts:30-35`) should be replicated for `CompanyMembershipGuard` overrides
- The `companyId` query param in `GET /api/documents` remains required (no cross-company listing per Q8)
- Soft-delete reactivation uses UPDATE (not INSERT) due to `@@unique([userId, companyId])` constraint per RD-001
