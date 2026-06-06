# Tasks: Saldare Backend en Google Cloud con Document AI

**Input**: Design documents from `specs/005-saldare-gcp-doc-ai/`

**Prerequisites**: plan.md (required), spec.md (required for user stories), research.md, data-model.md, contracts/

**Tests**: Manual end-to-end verification (health check + document upload). No automated test framework for infrastructure.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story. Each user story maps to writing the corresponding section of `saldare-back/deploy/saldare-gcp-deploy.sh`.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

## Path Conventions

- **NestJS backend**: `saldare-back/src/`, `saldare-back/prisma/`
- **Infrastructure**: `saldare-back/deploy/`
- **Docker artifacts**: `saldare-back/Dockerfile`, `saldare-back/.dockerignore`

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Create project scaffolding — Dockerfile, .dockerignore, deploy directory structure, and deploy script skeleton

- [x] T001 Create `saldare-back/deploy/` directory
- [x] T002 [P] Create multi-stage Dockerfile at `saldare-back/Dockerfile` (Node.js 22 Alpine, build stage + production stage, bind to `0.0.0.0:${PORT:-8080}`, run Prisma migrate + node dist/main)
- [x] T003 [P] Create `.dockerignore` at `saldare-back/.dockerignore` (exclude node_modules, dist, .git, test files, env files)
- [x] T004 Create deploy script skeleton at `saldare-back/saldare-back/deploy/saldare-gcp-deploy.sh` with CLI argument parsing (`--project-id`, `--billing-account`, `--region`, `--db-password`) and helper functions (`log_info`, `log_error`, `check_dependency`)

**Checkpoint**: Docker artifacts and deploy script skeleton are in place. Ready to implement deployment steps.

---

## Phase 2: User Story 1 - Configurar Proyecto GCP y Servicios Base (Priority: P1) 🎯 MVP

**Goal**: Write deployment script sections that create the GCP project, enable required APIs, create the Firebase project, and configure Email/Password authentication.

**Independent Test**: Execute the script section and verify in GCP Console that APIs are enabled and Firebase project exists with Email/Password auth active.

### Implementation for User Story 1

- [x] T005 [US1] Implement GCP project creation section in `saldare-back/deploy/saldare-gcp-deploy.sh` — `gcloud projects create`, `gcloud config set project`, `gcloud beta billing projects link`
- [x] T006 [US1] Implement API enablement section in `saldare-back/deploy/saldare-gcp-deploy.sh` — enable all 9 APIs: `documentai.googleapis.com`, `run.googleapis.com`, `cloudbuild.googleapis.com`, `artifactregistry.googleapis.com`, `secretmanager.googleapis.com`, `sqladmin.googleapis.com`, `iam.googleapis.com`, `firebase.googleapis.com`, `cloudresourcemanager.googleapis.com`
- [x] T007 [US1] Implement Firebase project creation section in `saldare-back/deploy/saldare-gcp-deploy.sh` — `gcloud firebase projects create` (or Console instructions), enable Email/Password auth provider via `gcloud alpha firebase` or documented manual steps
- [x] T008 [US1] Implement Firebase service account key download instructions in `saldare-back/deploy/saldare-gcp-deploy.sh` — guide user through Firebase Console → Project Settings → Service Accounts → Generate key, with validation that the downloaded JSON exists

**Checkpoint**: Script sections for GCP project + Firebase are testable. Running them creates a fully configured GCP project with Firebase authentication.

---

## Phase 3: User Story 2 - Configurar Document AI Processor y Service Account (Priority: P1)

**Goal**: Write deployment script sections that create the Document AI Form Parser processor, create service accounts with minimal IAM roles, and generate SA keys.

**Independent Test**: Execute the script section and verify in GCP Console that processor is active and service account has correct IAM bindings.

### Implementation for User Story 2

- [x] T009 [US2] Implement Document AI processor creation section in `saldare-back/deploy/saldare-gcp-deploy.sh` — `gcloud documentai processors create` with `--type=FORM_PARSER`, `--location=us-central1`, capture and export `PROCESSOR_ID`
- [x] T010 [US2] Implement service account creation section in `saldare-back/deploy/saldare-gcp-deploy.sh` — `gcloud iam service-accounts create saldare-backend-sa` with `--display-name`
- [x] T011 [US2] Implement IAM role binding section in `saldare-back/deploy/saldare-gcp-deploy.sh` — bind `roles/documentai.apiUser` and `roles/cloudsql.client` to `saldare-backend-sa`
- [x] T012 [US2] Implement Document AI SA key generation section in `saldare-back/deploy/saldare-gcp-deploy.sh` — `gcloud iam service-accounts keys create` for the backend SA, store key path for later Secret Manager upload

**Checkpoint**: Document AI processor is active, service account exists with minimal IAM, and SA key JSON is ready for secret storage.

---

## Phase 4: User Story 5 - Configurar Base de Datos en la Nube (Priority: P3)

**Goal**: Write deployment script sections that create the Cloud SQL PostgreSQL instance, database, and user. (Placed before US4/US3 because Cloud SQL must exist before secrets can reference it.)

**Independent Test**: Execute the script section and verify via `gcloud sql connect` that the database and user are accessible.

### Implementation for User Story 5

- [x] T013 [US5] Implement Cloud SQL instance creation section in `saldare-back/deploy/saldare-gcp-deploy.sh` — `gcloud sql instances create saldare-db` with `--database-version=POSTGRES_15`, `--tier=db-f1-micro`, `--region=us-central1`, `--storage-size=10GB`, `--storage-type=SSD`, `--no-assign-ip`
- [x] T014 [US5] Implement database creation section in `saldare-back/deploy/saldare-gcp-deploy.sh` — `gcloud sql databases create saldare --instance=saldare-db`
- [x] T015 [US5] Implement database user creation section in `saldare-back/deploy/saldare-gcp-deploy.sh` — `gcloud sql users create saldare-user` with password generation via `openssl rand -base64 32`, capture and export `DB_PASSWORD`
- [x] T016 [US5] Implement connection name output and Unix socket path construction in `saldare-back/deploy/saldare-gcp-deploy.sh` — export `INSTANCE_CONNECTION_NAME` in format `<project>:us-central1:saldare-db`

**Checkpoint**: Cloud SQL instance is running with database and user created. Connection name is ready for DATABASE_URL construction.

---

## Phase 5: User Story 4 - Configurar Secretos y Variables de Entorno (Priority: P2)

**Goal**: Write deployment script sections that create Secret Manager secrets, upload SA keys and database URL, and configure environment variables for Cloud Run.

**Independent Test**: Execute the script section and verify in GCP Console that secrets exist in Secret Manager with correct content.

### Implementation for User Story 4

- [x] T017 [US4] Implement Secret Manager secret creation section in `saldare-back/deploy/saldare-gcp-deploy.sh` — create three secrets: `saldare-gcp-sa-key`, `saldare-firebase-key`, `saldare-db-url` with `--replication-policy=automatic`
- [x] T018 [US4] Implement secret version upload section in `saldare-back/deploy/saldare-gcp-deploy.sh` — upload GCP SA key JSON, Firebase SA key JSON, and DATABASE_URL using `gcloud secrets versions add --data-file=`
- [x] T019 [US4] Implement DATABASE_URL construction section in `saldare-back/deploy/saldare-gcp-deploy.sh` — build the Unix socket connection string: `postgresql://saldare-user:<password>@localhost:5432/saldare?host=/cloudsql/<instance-connection-name>`
- [x] T020 [US4] Implement non-secret environment variables documentation in `saldare-back/deploy/saldare-gcp-deploy.sh` — define `DOCUMENT_AI_PROJECT_ID`, `DOCUMENT_AI_PROCESSOR_LOCATION`, `GOOGLE_CLOUD_PROJECT`, `FIREBASE_PROJECT_ID`, `NODE_ENV` values with comments on their sources

**Checkpoint**: All three secrets are stored in Secret Manager. Environment variables are defined and ready for Cloud Run deployment.

---

## Phase 6: User Story 3 - Desplegar el Backend en Google Cloud Run (Priority: P2)

**Goal**: Write deployment script sections that create Artifact Registry, build and push the Docker image, deploy to Cloud Run with all configuration flags, and verify the deployment.

**Independent Test**: Execute the script section and verify `curl <service-url>/health` returns 200.

### Implementation for User Story 3

- [x] T021 [US3] Implement Artifact Registry repository creation section in `saldare-back/deploy/saldare-gcp-deploy.sh` — `gcloud artifacts repositories create saldare-images` with `--repository-format=docker`, `--location=us-central1`
- [x] T022 [US3] Implement Docker image build and push section in `saldare-back/deploy/saldare-gcp-deploy.sh` — `gcloud builds submit` from `saldare-back/` with `--tag` pointing to Artifact Registry
- [x] T023 [US3] Implement Cloud Run deployment section in `saldare-back/deploy/saldare-gcp-deploy.sh` — `gcloud run deploy saldare-backend` with all flags: `--memory=512Mi`, `--max-instances=2`, `--min-instances=0`, `--concurrency=80`, `--no-allow-unauthenticated`, `--service-account`, `--add-cloudsql-instances`, `--set-secrets`, `--set-env-vars`, `--region=us-central1`, `--platform=managed`
- [x] T024 [US3] Implement service URL retrieval and health check section in `saldare-back/deploy/saldare-gcp-deploy.sh` — `gcloud run services describe` to capture URL, `curl` health check endpoint, handle cold start delay with retry logic

**Checkpoint**: Cloud Run service is deployed and responding to health checks. The backend is live at `*.run.app`.

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: Validation, error handling, documentation, and end-to-end verification

- [x] T025 Add input validation and prerequisite checks to `saldare-back/deploy/saldare-gcp-deploy.sh` — validate that `gcloud`, `openssl` are installed, billing account format, project ID format, region validity
- [x] T026 [P] Add idempotency checks to `saldare-back/deploy/saldare-gcp-deploy.sh` — check if resources already exist before creating (project, APIs, processor, Cloud SQL instance, secrets) and skip with a log message
- [x] T027 [P] Add error handling and rollback guidance to `saldare-back/deploy/saldare-gcp-deploy.sh` — trap errors with `set -e`, print clear error messages with suggested recovery steps, document manual cleanup commands
- [x] T028 Implement end-to-end verification section in `saldare-back/deploy/saldare-gcp-deploy.sh` — instructions for creating a Firebase test user, obtaining a JWT, and uploading a test PDF via `curl` to `/api/documents/upload`
- [x] T029 Implement cleanup/teardown section in `saldare-back/deploy/saldare-gcp-deploy.sh` — `--destroy` flag that deletes all resources in reverse order (Cloud Run → Cloud SQL → Artifact Registry → Secrets → SAs → Project)
- [x] T030 Validate `saldare-back/deploy/saldare-gcp-deploy.sh` against `specs/005-saldare-gcp-doc-ai/quickstart.md` — ensure all commands match, environment variables are consistent, and the step sequence is correct
- [x] T031 [P] Add usage documentation header to `saldare-back/deploy/saldare-gcp-deploy.sh` — prerequisites, required environment variables, example invocation, step-by-step description of what the script does

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — can start immediately
- **US1 - GCP & Firebase (Phase 2)**: Depends on Phase 1 (deploy script skeleton) — configures project identity used by all subsequent phases
- **US2 - Document AI & SAs (Phase 3)**: Depends on US1 (GCP project must exist, APIs enabled). Can run in parallel with Phase 4 (Cloud SQL)
- **US5 - Cloud SQL (Phase 4)**: Depends on US1 (GCP project + APIs). Can run in **parallel with US2** (independent GCP resources)
- **US4 - Secrets (Phase 5)**: Depends on US2 (SA keys) AND US5 (DB URL components). Must run after both
- **US3 - Cloud Run Deploy (Phase 6)**: Depends on ALL previous phases — needs project, processor ID, SA, secrets, DB connection name
- **Polish (Phase 7)**: Depends on all user story phases being complete

### User Story Dependencies

```
Phase 1: Setup
    ↓
Phase 2: US1 (P1) — GCP Project + Firebase
    ↓
    ├── Phase 3: US2 (P1) — Document AI + SAs ──┐
    │                                            ├── Phase 5: US4 (P2) — Secrets
    └── Phase 4: US5 (P3) — Cloud SQL ──────────┘         ↓
                                                   Phase 6: US3 (P2) — Cloud Run Deploy
                                                          ↓
                                                   Phase 7: Polish
```

**Note**: US5 (Cloud SQL) is P3 priority but positioned at Phase 4 because it's a deployment prerequisite for US4 (secrets need DB URL) and US3 (Cloud Run needs Cloud SQL connection). P3 reflects business priority ("can test with local DB"), not deployment ordering.

### Within Each Phase

- Script sections should be written in the order listed (sequential execution)
- Error handling is added per-section as the script is written
- Verification of each section should be performed before moving to the next section

### Parallel Opportunities

- **Phase 1**: T002 (Dockerfile) and T003 (.dockerignore) can be created in parallel
- **Phase 3 and Phase 4**: US2 (Document AI + SAs) and US5 (Cloud SQL) can be implemented in parallel — they operate on independent GCP resources
- **Phase 7**: T026 (idempotency), T027 (error handling), and T031 (usage docs) can be done in parallel

---

## Parallel Example: Setup Phase

```bash
# Launch independent setup tasks together:
Task: "Create multi-stage Dockerfile at saldare-back/Dockerfile"
Task: "Create .dockerignore at saldare-back/.dockerignore"
```

## Parallel Example: US2 and US5

```bash
# After US1 is complete, these two phases can run in parallel:
Task: "Phase 3: Document AI Processor + Service Accounts (US2)"
Task: "Phase 4: Cloud SQL Database (US5)"
```

---

## Implementation Strategy

### MVP First (US1 + US2 Only)

1. Complete Phase 1: Setup (Dockerfile, script skeleton)
2. Complete Phase 2: US1 — GCP project and Firebase configuration
3. Complete Phase 3: US2 — Document AI processor and service accounts
4. **STOP and VALIDATE**: Test that GCP project exists, APIs are enabled, Document AI processor is active
5. Result: The foundational GCP infrastructure is ready for backend deployment

### Incremental Delivery

1. Setup → Docker and deploy script scaffolding exist
2. + US1 → GCP project and Firebase configured, APIs enabled
3. + US2 → Document AI processor ready, service accounts with minimal IAM
4. + US5 → Cloud SQL database running, ready for Prisma migrations
5. + US4 → All secrets stored in Secret Manager, env vars defined
6. + US3 → Backend deployed to Cloud Run, health check passing
7. + Polish → Script is idempotent, validated, documented, with cleanup support

### Execution Notes

- The `saldare-back/deploy/saldare-gcp-deploy.sh` script is built incrementally — each phase adds new sections
- Each phase's checkpoint verifies that the script sections work correctly when executed
- All `gcloud` commands should use the same region (`us-central1`) per the research decision
- The script should be executable (`chmod +x saldare-back/deploy/saldare-gcp-deploy.sh`) and use `#!/usr/bin/env bash` with `set -euo pipefail`

---

## Notes

- [P] tasks = different files or independent script sections, no dependencies
- [Story] label maps task to specific user story for traceability
- Each user story section of the deploy script should be independently executable (if prerequisites are met)
- The Dockerfile must follow NestJS best practices: multi-stage build, Alpine for production, Prisma generate in build stage
- All secret values must be stored in Secret Manager, never hardcoded in the script or Dockerfile
- The script should validate all required environment variables before starting any operation
- Commit after each logical group of tasks
- Stop at any checkpoint to validate the script section independently
