# Data Model: Saldare Backend en Google Cloud con Document AI

This feature is infrastructure-focused — the data model describes GCP resources and their configuration relationships rather than application entities.

## Entity: GCP Project

Represents the Google Cloud container for all resources.

| Field | Type | Description |
|-------|------|-------------|
| `projectId` | `string` | Unique GCP project identifier |
| `projectNumber` | `integer` | Auto-assigned numeric identifier |
| `billingAccountId` | `string` | Linked billing account |
| `region` | `string` | Default region (`us-central1`) |

**State**: `active` — billing and APIs must be enabled.

---

## Entity: Firebase Project

Represents the Firebase project linked to the GCP project.

| Field | Type | Description |
|-------|------|-------------|
| `firebaseProjectId` | `string` | Firebase project ID (usually same as GCP projectId) |
| `authProviders` | `string[]` | Enabled auth providers (`["email/password"]` for MVP) |
| `serviceAccountKey` | `SecretRef` | Secret Manager reference to Firebase Admin SDK JSON key |

**Relationship**: Linked 1:1 with GCP Project.

---

## Entity: Document AI Processor

| Field | Type | Description |
|-------|------|-------------|
| `processorId` | `string` | GCP-assigned processor UUID |
| `type` | `string` | Processor type (`FORM_PARSER`) |
| `region` | `string` | Processor location (`us-central1`) |
| `state` | `string` | `active` or `disabled` |

**State Transitions**: `creating` → `active`; `active` → `disabled` (manual).

---

## Entity: Service Account (Runtime)

The Cloud Run service identity.

| Field | Type | Description |
|-------|------|-------------|
| `email` | `string` | SA email (`saldare-backend-sa@<project>.iam.gserviceaccount.com`) |
| `roles` | `string[]` | IAM roles: `roles/documentai.apiUser`, `roles/cloudsql.client` |
| `keyJson` | `SecretRef` (optional) | Service account key JSON stored in Secret Manager |

**Note**: The Cloud Run service SA is separate from the key used for Document AI client auth. See Section "Service Account (Document AI Client)" below.

---

## Entity: Service Account (Document AI Client)

| Field | Type | Description |
|-------|------|-------------|
| `email` | `string` | SA email with minimal Document AI permissions |
| `roles` | `string[]` | IAM roles: `roles/documentai.apiUser` only |
| `keyJson` | `SecretRef` | SA key JSON stored in Secret Manager ↔ `GOOGLE_APPLICATION_CREDENTIALS` |

**Constraint**: Only `documentai.apiUser` — no Storage or Cloud SQL access.

---

## Entity: Cloud Run Service

| Field | Type | Description |
|-------|------|-------------|
| `serviceName` | `string` | Cloud Run service name (`saldare-backend`) |
| `region` | `string` | `us-central1` |
| `imageUrl` | `string` | Artifact Registry image path |
| `url` | `string` | Auto-assigned `*.run.app` URL |
| `memoryLimit` | `string` | `512Mi` (sufficient for NestJS with <100 req/día) |
| `maxInstances` | `integer` | `2` (cost control for MVP) |
| `minInstances` | `integer` | `0` (scale to zero, cold start acceptable) |
| `concurrency` | `integer` | `80` (default, more than enough for MVP) |
| `authPolicy` | `string` | `require-authentication` (no allow-unauthenticated) |
| `secrets` | `SecretRef[]` | Mounted secrets: GCP SA key, Firebase SA key, DATABASE_URL |

---

## Entity: Cloud SQL Instance

| Field | Type | Description |
|-------|------|-------------|
| `instanceName` | `string` | Instance name (`saldare-db`) |
| `connectionName` | `string` | GCP connection name (`<project>:us-central1:saldare-db`) |
| `tier` | `string` | `db-f1-micro` (shared-core, 0.6 GB RAM, 10 GB SSD) |
| `databaseVersion` | `string` | `POSTGRES_15` |
| `dbName` | `string` | Database name (`saldare`) |
| `dbUser` | `string` | Database user for Prisma connection |
| `dbPassword` | `SecretRef` | Database password stored in Secret Manager |
| `publicIp` | `boolean` | `false` (no public IP — accessed via Auth Proxy only) |

**Connection String Format**: `postgresql://<user>:<password>@/saldare?host=/cloudsql/<connection-name>`

---

## Entity: Artifact Registry Repository

| Field | Type | Description |
|-------|------|-------------|
| `repositoryName` | `string` | Repository name (`saldare-images`) |
| `format` | `string` | `docker` |
| `region` | `string` | `us-central1` |

---

## Entity: Secret Manager Secret

| Field | Type | Description |
|-------|------|-------------|
| `name` | `string` | Secret name (e.g., `saldare-gcp-sa-key`, `saldare-firebase-key`, `saldare-db-url`) |
| `version` | `string` | Latest version number |
| `mountedPath` | `string` | Path in Cloud Run container (`/run/secrets/<name>`) |
| `rotationPolicy` | `boolean` | `false` for MVP (manual rotation) |

---

## Secret ↔ Env Var Mapping

| Secret Manager Secret | Cloud Run Mount Path | Env Variable |
|----------------------|---------------------|--------------|
| `saldare-gcp-sa-key` | `/run/secrets/gcp-sa-key` | `GOOGLE_APPLICATION_CREDENTIALS=/run/secrets/gcp-sa-key` |
| `saldare-firebase-key` | `/run/secrets/firebase-key` | `FIREBASE_SERVICE_ACCOUNT_KEY=/run/secrets/firebase-key` |
| `saldare-db-url` | `/run/secrets/db-url` | `DATABASE_URL` (mounted as env var) |

---

## State Machine: Deployment Lifecycle

| State | Description |
|-------|-------------|
| `not-created` | GCP project does not exist or has no services |
| `apis-enabled` | Required APIs activated, billing linked |
| `processor-ready` | Document AI processor created and active |
| `db-ready` | Cloud SQL instance created, database and user configured |
| `image-built` | Docker image built and stored in Artifact Registry |
| `deployed` | Cloud Run service running, health check passing |
| `verified` | End-to-end document upload + extraction test passes |

**Transitions** (linear for initial setup):
`not-created` → `apis-enabled` → `processor-ready` → `db-ready` → `image-built` → `deployed` → `verified`
