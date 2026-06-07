# Environment Variables Contract

**Purpose**: Define all environment variables required by the Saldare backend running on Cloud Run. This is the source of truth for what the NestJS application expects at runtime.

## Required Variables

| Variable | Source | Type | Description | Required |
|----------|--------|------|-------------|----------|
| `PORT` | Cloud Run (auto) | `number` | Port to listen on. Cloud Run injects 8080. | Yes |
| `NODE_ENV` | Cloud Run (set) | `string` | `production` for deployed service | Yes |
| `DOCUMENT_AI_PROJECT_ID` | Cloud Run (env) | `string` | GCP project ID hosting the Document AI processor | Yes |
| `DOCUMENT_AI_PROCESSOR_ID` | Cloud Run (env) | `string` | Document AI Form Parser processor UUID | Yes |
| `DOCUMENT_AI_PROCESSOR_LOCATION` | Cloud Run (env) | `string` | Region of the processor (`us-central1`) | Yes |
| `GOOGLE_APPLICATION_CREDENTIALS` | Cloud Run (secret) | `filepath` | Path to GCP service account JSON key file | Yes |
| `GOOGLE_CLOUD_PROJECT` | Cloud Run (env) | `string` | GCP project ID for Cloud Logging and other SDKs | Yes |
| `DATABASE_URL` | Cloud Run (secret) | `string` | PostgreSQL connection string (Unix socket) | Yes |
| `FIREBASE_PROJECT_ID` | Cloud Run (env) | `string` | Firebase project ID for Firebase Admin SDK | Yes |
| `FIREBASE_SERVICE_ACCOUNT_KEY` | Cloud Run (secret) | `filepath` | Path to Firebase Admin SDK service account JSON | Yes |

## DATABASE_URL Format

```
postgresql://<USER>:<PASSWORD>@localhost:5432/<DB_NAME>?host=/cloudsql/<INSTANCE_CONNECTION_NAME>
```

The `host` query parameter overrides the Unix socket path for Cloud SQL Auth Proxy connections.

## Secret Mount Paths

```
/run/secrets/gcp-sa-key      → GOOGLE_APPLICATION_CREDENTIALS
/run/secrets/firebase-key     → FIREBASE_SERVICE_ACCOUNT_KEY
```

Secrets mounted as volumes (files) rather than env vars. The env vars hold paths, not the values.

## Non-Secret Environment Variables

These are set directly in the Cloud Run configuration (not Secret Manager):

```yaml
DOCUMENT_AI_PROJECT_ID: "saldare-XXXXXX"
DOCUMENT_AI_PROCESSOR_ID: "abc123def456"
DOCUMENT_AI_PROCESSOR_LOCATION: "us-central1"
GOOGLE_CLOUD_PROJECT: "saldare-XXXXXX"
FIREBASE_PROJECT_ID: "saldare-XXXXXX"
NODE_ENV: "production"
```

## Validation Contract

The NestJS application MUST validate on startup that all required variables are present. Missing variables result in a startup failure with a clear error message indicating which variable is missing.
