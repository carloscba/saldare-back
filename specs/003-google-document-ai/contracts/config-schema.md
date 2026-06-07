# Environment Configuration

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `PORT` | No | `8080` | Cloud Run HTTP port |
| `DATABASE_URL` | Yes | — | PostgreSQL connection string |
| `GOOGLE_APPLICATION_CREDENTIALS` | No* | — | Path to GCP service account JSON (local dev only) |
| `DOCUMENT_AI_PROJECT_ID` | Yes | — | GCP project ID |
| `DOCUMENT_AI_PROCESSOR_ID` | Yes | — | Form Parser processor ID |
| `DOCUMENT_AI_PROCESSOR_LOCATION` | No | `us-central1` | Processor location |
| `FIREBASE_PROJECT_ID` | Yes | — | Firebase project ID for JWT verification |
| `MAX_FILE_SIZE` | No | `5242880` | Max upload size in bytes (5MB) |
| `DEFAULT_TTL_DAYS` | No | `30` | Default document retention days |
| `UPLOAD_DIR` | No | `/tmp/uploads` | Temp directory for uploaded files |

*Not required on Cloud Run — uses attached service account via IAM.
