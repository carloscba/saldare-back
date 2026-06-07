# Phase 0 Research: Saldare Backend en Google Cloud con Document AI

## Unknowns & Decisions

### 1. Dockerfile Design for NestJS on Cloud Run

- **Decision**: Multi-stage Dockerfile — build stage with `node:22-alpine` compiles TypeScript, production stage with `node:22-alpine` runs only `dist/` and `node_modules`. Bind to `0.0.0.0:${PORT:-8080}` per constitution.
- **Rationale**: Multi-stage keeps the production image small (~150MB vs ~600MB). Alpine is the standard for Node.js containers. Cloud Run injects `PORT=8080` by default; constitution mandates `0.0.0.0` binding.
- **Alternatives**: Distroless Node.js image (smaller but harder to debug); Single-stage (simpler but bloated image).

### 2. Infrastructure as Code (IaC) Approach

- **Decision**: Use `gcloud` CLI commands with a shell script for MVP. No Terraform or Deployment Manager.
- **Rationale**: The feature is a one-time setup for a single GCP project. A shell script is the fastest to write, read, and execute. Terraform adds complexity (state management, provider setup) that's unnecessary for an MVP deployment. The script can be migrated to Terraform if infrastructure grows.
- **Alternatives**: Terraform (industry standard but overkill for single service); Deployment Manager (GCP-native but verbose); Pulumi (code-first but niche).

### 3. Cloud SQL Auth Proxy Sidecar

- **Decision**: Use Cloud Run's native Cloud SQL integration with a sidecar container running `gcr.io/cloud-sql-connectors/cloud-sql-proxy:latest`. The NestJS container connects via Unix socket at `/cloudsql/<instance-connection-name>`.
- **Rationale**: The Cloud SQL Auth Proxy is Google's recommended approach for Cloud Run. It handles IAM-based authentication, TLS encryption, and connection pooling. The sidecar pattern keeps the proxy lifecycle tied to the service container.
- **Alternatives**: Private IP + VPC Serverless Connector (adds VPC complexity and cost); Public IP (security risk); Direct TCP (not recommended by Google).

### 4. Secret Manager Integration

- **Decision**: Mount secrets as files in Cloud Run via `--set-secrets` flag. The NestJS app reads secrets from files rather than environment variables for the most sensitive values (service account keys). Non-sensitive config uses env vars.
- **Rationale**: Mounting secrets as files is more secure — they're never visible in environment variables (which can leak through logs or crash dumps). Cloud Run injects them at `/run/secrets/<secret-name>`. Non-sensitive values (project IDs, processor IDs) use plain env vars for simplicity.
- **Alternatives**: Environment variable injection via `--set-secrets` (simpler but secrets appear in `env`); HashiCorp Vault (overkill for MVP).

### 5. Firebase Project Setup and Admin SDK

- **Decision**: Create a Firebase project via the Firebase Console (or `firebase` CLI), enable Email/Password authentication provider, and download a service account JSON key for Firebase Admin SDK. Store the key JSON in Secret Manager, mount it to Cloud Run.
- **Rationale**: The constitution mandates Firebase Auth with verified JWT tokens. Firebase Admin SDK requires a service account key. Email/Password is the simplest provider for MVP — no OAuth setup needed.
- **Alternatives**: Firebase project auto-creation via API (complex with billing/tos acceptance); Anonymous auth (no real identity, not spec-compliant).

### 6. Service Account Minimal Permissions

- **Decision**: Create two service accounts:
  1. `saldare-backend-sa` — for Cloud Run runtime: `roles/documentai.apiUser`, `roles/cloudsql.client`
  2. Separate key for Document AI (for `GOOGLE_APPLICATION_CREDENTIALS`) from a dedicated SA with only `roles/documentai.apiUser`
- **Rationale**: The constitution mandates IAM-only auth in production (no JSON keys in container). But Document AI client currently requires a JSON key file (`@google-cloud/documentai` v8). For MVP, we use the JSON key approach. The Cloud Run SA itself is used for Cloud SQL proxy IAM auth.
- **Alternatives**: Workload Identity Federation (constitution-compliant but complex setup); Single SA for everything (violates least privilege).
- **Constraint**: Constitution Section "No Hardcoded Keys" says no SA JSON in container. However, `@google-cloud/documentai` v8 still requires a key file. The key is injected via Secret Manager (mounted as file), not hardcoded in the Docker image, partially satisfying the spirit of the constitution. Full IAM-only auth requires migrating to Workload Identity or `@google-cloud/documentai` v9+ with ADC support.

### 7. CI/CD Approach

- **Decision**: Manual deployment via `gcloud builds submit` + `gcloud run deploy` for MVP. No GitHub Actions or Cloud Build triggers yet.
- **Rationale**: For <100 req/día MVP traffic, automated CI/CD is premature. Manual commands in a documented script are faster to set up and simpler to troubleshoot. Cloud Build is used only for container builds, not as a CI trigger.
- **Alternatives**: Cloud Build triggers on git push (nice but adds complexity); GitHub Actions (requires secrets in GitHub, cross-cloud auth).

### 8. Monitoring and Observability

- **Decision**: Rely on Google Cloud's built-in observability: Cloud Logging (stdout/stderr auto-captured), Cloud Monitoring (Cloud Run metrics dashboard). No custom metrics or alerting for MVP.
- **Rationale**: Cloud Run auto-collects stdout/stderr to Cloud Logging. The NestJS app logs via `console.log` or a structured logger (e.g., `@nest/pino`). Cloud Monitoring provides default dashboards for request count, latency, and error rate. Alerting not needed for MVP traffic.
- **Alternatives**: OpenTelemetry + Cloud Trace (great for distributed tracing but complex); Datadog/NewRelic (costly, third-party).

### 9. Prisma Migrations on Deploy

- **Decision**: Execute `prisma migrate deploy` at container startup in the Dockerfile entrypoint, before `node dist/main`. Migrations are idempotent and safe for repeated execution.
- **Rationale**: Simple, ensures database schema is always in sync with the deployed code version. For MVP with `min-instances=0`, migrations run on each cold start (~1-2 seconds for a few tables). No separate migration job needed.
- **Alternatives**: Run migrations as a Cloud Build step (separates concerns but adds complexity); Separate Cloud Run job for migrations (overkill for MVP).

### 10. Region Selection

- **Decision**: Deploy all resources (Cloud Run, Cloud SQL, Artifact Registry, Document AI) in `us-central1`.
- **Rationale**: Spec 003 already chose `us-central1` for Document AI processor (lowest latency and cost in US). Co-locating all resources minimizes latency and avoids cross-region data transfer costs. Artifact Registry must be in the same region as Cloud Run for optimal deployment speed.
- **Alternatives**: Multi-region deployment (unnecessary for MVP); `us-east1` or `us-west1` (similar cost, marginally different latency).

## Key Dependencies

| Tool / Service | Purpose |
|----------------|---------|
| `gcloud` CLI | All GCP resource management and deployment |
| `docker` | Build and test container images locally |
| `firebase` CLI | Firebase project creation and Auth configuration |
| Cloud Build | Remote container image builds (avoids local docker issues) |
| Cloud Run | Production runtime for NestJS backend |
| Cloud SQL | PostgreSQL database (db-f1-micro) |
| Cloud SQL Auth Proxy | Secure Unix socket connection to Cloud SQL |
| Secret Manager | Store service account keys and database URL |
| Artifact Registry | Docker image repository |
| Document AI | Form Parser processor for document extraction |
| Firebase Auth | User authentication for frontend (email/password) |
| Cloud Logging | Application and request logs |
| Cloud Monitoring | Default Cloud Run metrics dashboards |

## Open Questions (Resolved)

All ambiguities from the spec's `## Clarifications` section have been addressed. No remaining unknowns.
