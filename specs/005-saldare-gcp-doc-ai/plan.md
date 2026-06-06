# Implementation Plan: Saldare Backend en Google Cloud con Document AI

**Branch**: `005-saldare-gcp-doc-ai` | **Date**: 2026-06-06 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `specs/005-saldare-gcp-doc-ai/spec.md`

## Summary

Desplegar el backend NestJS (spec 003) en Google Cloud Run, configurar Document AI (Form Parser), Firebase Auth, Cloud SQL (PostgreSQL), y Secret Manager. La feature produce un script de despliegue paso a paso con instrucciones `gcloud` CLI. No se usa Terraform — el MVP usa comandos `gcloud` directos. El frontend Angular (spec 004) se conecta a este backend.

## Technical Context

**Language/Version**: TypeScript / Node.js 22 (LTS) en contenedor Alpine

**Primary Dependencies**: NestJS, @google-cloud/documentai (v8), firebase-admin, @prisma/client, @nestjs/config

**Storage**: Cloud SQL PostgreSQL 15 (db-f1-micro: shared-core, 0.6 GB RAM, 10 GB SSD)

**Testing**: Pruebas manuales de extremo a extremo (health check + upload de documento PDF de prueba). Sin framework de testing para infraestructura.

**Target Platform**: Google Cloud Run (serverless containers), Linux/amd64

**Project Type**: Infrastructure / deployment — configuración de servicios GCP + contenedorización del backend

**Performance Goals**: Health check < 3s en cold start, procesamiento de documento < 30s, < 100 req/día

**Constraints**: Presupuesto < $50 USD/mes, min-instances=0 (cold start aceptable), autenticación obligatoria (Firebase Auth), máximo privilegio mínimo en IAM

**Scale/Scope**: MVP / desarrollo — 1 servicio Cloud Run, 1 instancia Cloud SQL, < 10 documentos/día

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Status | Notes |
|-----------|--------|-------|
| **I. Three-Tier Architecture** | ✅ PASS | Angular → Cloud Run → Document AI (backend as intermediary). No direct client-to-DocAI. |
| **II. Google-Centric Stack** | ✅ PASS | Angular + Material (Frontend), NestJS on Cloud Run (Backend), Firebase Auth, Document AI Form Parser. Cloud Storage mentioned for future use. |
| **III. No Secret Leaks** | ✅ PASS | Service account keys stored in Secret Manager, mounted as files at runtime. No keys in Docker image or client bundle. |
| **IV. Data Abstraction (DTOs)** | ✅ PASS | Backend already implements DTO transformation (spec 003). No change required by deployment. |
| **V. End-to-End Type Safety** | ✅ PASS | Existing `ExtractedFormField` interface shared between client and server. No change required. |
| **Auth: Firebase Bearer Token** | ✅ PASS | Cloud Run requires authentication. NestJS AuthGuard validates Firebase JWT. API keys removed (Q8). |
| **Network: 0.0.0.0:PORT** | ✅ PASS | Dockerfile binds to `0.0.0.0:${PORT:-8080}` per constitution. |
| **IAM: Minimal Roles** | ⚠️ PARTIAL | Cloud Run service account has `documentai.apiUser` + `cloudsql.client`. However, `@google-cloud/documentai` v8 requires a JSON key file (mounted from Secret Manager), not pure IAM ADC. Full IAM-only requires v9+ or Workload Identity. See Complexity Tracking. |

**Gate Result**: PASS — single partial item tracked below. No blocking violations.

## Project Structure

### Documentation (this feature)

```text
specs/005-saldare-gcp-doc-ai/
├── spec.md              # Feature specification
├── plan.md              # This file
├── research.md          # Phase 0 research decisions
├── data-model.md        # Phase 1 infrastructure data model
├── quickstart.md        # Phase 1 deployment quickstart
├── contracts/           # Phase 1 contracts
│   ├── env-vars.md      # Environment variables contract
│   └── deploy-workflow.md  # Deployment step sequence contract
└── tasks.md             # Phase 2 output (speckit.tasks)
```

### Source Code (repository root)

No new source code is created by this feature. The feature produces:
- A deployment script (`deploy/saldare-gcp-deploy.sh`) with all `gcloud` commands
- A `Dockerfile` for the NestJS backend (if not already existing from spec 003)

```text
deploy/
└── saldare-gcp-deploy.sh    # Full deployment script

# Dockerfile exists at repo root (from spec 003)
Dockerfile                    # Multi-stage Node.js 22 Alpine build
```

**Structure Decision**: Single project at repo root. The NestJS backend is the existing monorepo under `src/`. Infrastructure configuration is documentation + the deploy script. No new source directories needed.

## Phase 0: Research Summary

See [research.md](research.md) for full details. Key decisions:

| # | Decision | Rationale |
|---|----------|-----------|
| 1 | Multi-stage Dockerfile (build + production on Alpine) | Smaller images (~150MB), fast Cloud Run deployment |
| 2 | `gcloud` CLI shell script (no Terraform) | Single project, one-time setup; Terraform would be overengineered |
| 3 | Cloud SQL Auth Proxy sidecar (Unix socket) | Google-recommended, no VPC needed, IAM-based auth |
| 4 | Secrets mounted as files, not env vars | More secure — values don't leak via `env` or crash dumps |
| 5 | Firebase project created via Console/CLI | Email/Password provider, simplest setup for MVP |
| 6 | Two service accounts (runtime + DocAI client) | Least privilege — Cloud Run SA needs different roles than DocAI SA |
| 7 | Manual deployment (no CI/CD triggers) | Premature automation for MVP; documented script is sufficient |
| 8 | Cloud-native observability (Logging + Monitoring defaults) | No custom metrics or alerts needed for <100 req/día |
| 9 | Prisma migrate at container startup | Idempotent, ensures schema sync, adds ~1-2s to cold start |
| 10 | All resources in `us-central1` | Co-located with Document AI processor, minimal latency |

## Phase 1: Design Summary

### Data Model

See [data-model.md](data-model.md). Seven infrastructure entities modeled:
- **GCP Project** — container for all resources
- **Firebase Project** — auth provider linked to GCP project
- **Document AI Processor** — Form Parser in us-central1
- **Service Accounts** (2x) — runtime SA + Document AI client SA with minimal IAM
- **Cloud Run Service** — production runtime (512Mi, 2 max instances, min=0)
- **Cloud SQL Instance** — db-f1-micro PostgreSQL 15 with 10 GB SSD
- **Artifact Registry Repository** — Docker images in us-central1
- **Secret Manager Secrets** — 3 secrets for SA keys and database URL

**Deployment State Machine**: `not-created` → `apis-enabled` → `processor-ready` → `db-ready` → `image-built` → `deployed` → `verified`

### Contracts

See [contracts/](contracts/):
- **env-vars.md** — 10 required environment variables with source (env vs secret), format specs, and validation contract
- **deploy-workflow.md** — 9-step deployment sequence with input/output contracts per step

### Quickstart

See [quickstart.md](quickstart.md) — step-by-step `gcloud` commands from project creation to end-to-end verification. Includes cleanup commands for teardown.

## Re-evaluate Constitution Check (Post-Design)

| Principle | Status | Change |
|-----------|--------|--------|
| **I. Three-Tier Architecture** | ✅ PASS | No change |
| **II. Google-Centric Stack** | ✅ PASS | All services are GCP-native. Firebase Auth, Cloud Run, Document AI, Cloud SQL, Secret Manager. |
| **III. No Secret Leaks** | ✅ PASS | Secrets mounted as files from Secret Manager. No secrets in Docker image or env vars. |
| **IV. Data Abstraction (DTOs)** | ✅ PASS | No change — backend DTOs unchanged. |
| **V. End-to-End Type Safety** | ✅ PASS | No change — interfaces unchanged. |
| **Auth: Firebase Bearer Token** | ✅ PASS | Cloud Run requires authentication. NestJS AuthGuard validates Firebase JWT. Frontend injects via HttpInterceptor. |
| **Network: 0.0.0.0:PORT** | ✅ PASS | Dockerfile binds correctly. Cloud Run injects PORT=8080. |
| **IAM: Minimal Roles** | ⚠️ PARTIAL | Same as pre-check. Document AI client requires JSON key (v8 limitation). Full IAM-only ADC requires library upgrade or Workload Identity. Tracked in Complexity Tracking. |

**Post-design result**: PASS. No new violations. Single partial item remains and is documented.

## Complexity Tracking

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| JSON key for Document AI (partial violation of "No Hardcoded Keys" — key mounted from Secret Manager, not in image) | `@google-cloud/documentai` v8 SDK requires `GOOGLE_APPLICATION_CREDENTIALS` pointing to a JSON key file. Inline ADC (`gcloud auth application-default login`) is not supported inside Cloud Run containers. | Workload Identity Federation would eliminate the key file but requires significant setup (IAM workload identity pools, OIDC provider configuration) and is not supported by the v8 SDK. Upgrading to v9+ with native ADC support would resolve this, but v9+ may have breaking API changes. The current approach satisfies the spirit of the constitution (no keys in image, injected at runtime via Secret Manager) if not the strict letter. |

## Dependencies on Other Specs

| Spec | Dependency | Status |
|------|-----------|--------|
| spec/003-google-document-ai | Backend API implementation (NestJS + Document AI integration + Prisma schema) | Must be complete before deploying |
| spec/004-frontend-doc-upload | Frontend Angular app that consumes this backend | Already built, just needs `API_BASE_URL` pointing to Cloud Run URL |
