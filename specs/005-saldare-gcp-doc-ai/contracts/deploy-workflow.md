# Deployment Workflow Contract

**Purpose**: Define the sequence and contracts between each deployment step. Each step can be implemented as a `gcloud` command or manual action.

## Step Sequence

```
Step 1: Create GCP Project & Enable APIs
    ↓
Step 2: Create Firebase Project & Enable Auth
    ↓
Step 3: Create Document AI Processor
    ↓  (parallel with Step 4)
Step 4: Create Cloud SQL Instance & Database
    ↓
Step 5: Create Service Accounts & IAM Bindings
    ↓
Step 6: Store Secrets in Secret Manager
    ↓
Step 7: Build & Push Docker Image
    ↓
Step 8: Deploy Cloud Run Service
    ↓
Step 9: Verify End-to-End
```

## Step Contracts

### Step 1: Create GCP Project & Enable APIs

**Input**: Billing account ID, project name
**Output**: Project ID, project number
**Artifacts**: Project with billing linked and APIs enabled

```yaml
APIs:
  - documentai.googleapis.com
  - run.googleapis.com
  - cloudbuild.googleapis.com
  - artifactregistry.googleapis.com
  - secretmanager.googleapis.com
  - sqladmin.googleapis.com
  - cloudresourcemanager.googleapis.com
  - iam.googleapis.com
  - firebase.googleapis.com
```

### Step 2: Create Firebase Project & Enable Auth

**Input**: GCP project ID
**Output**: Firebase project ID, service account key
**Artifacts**: Firebase project with Email/Password auth enabled

### Step 3: Create Document AI Processor

**Input**: Project ID, region (`us-central1`), processor type (`FORM_PARSER`)
**Output**: Processor ID
**Artifacts**: Active Form Parser processor

### Step 4: Create Cloud SQL Instance & Database

**Input**: Project ID, region (`us-central1`), tier (`db-f1-micro`), database name
**Output**: Instance connection name, database user, database password
**Artifacts**: PostgreSQL 15 instance with database created

### Step 5: Create Service Accounts & IAM Bindings

**Input**: Project ID
**Output**: SA emails, SA key JSON files
**Artifacts**:
- `saldare-backend-sa` with roles: `documentai.apiUser`, `cloudsql.client`
- Document AI key (separate SA or same SA key)

### Step 6: Store Secrets in Secret Manager

**Input**: SA key JSON files, database URL
**Output**: Secret names and versions
**Artifacts**: Three secrets stored: `saldare-gcp-sa-key`, `saldare-firebase-key`, `saldare-db-url`

### Step 7: Build & Push Docker Image

**Input**: Source code (with Dockerfile), Artifact Registry repository
**Output**: Image URL with tag
**Contract**: `gcloud builds submit --tag <region>-docker.pkg.dev/<project>/<repo>/<image>:<tag>`

### Step 8: Deploy Cloud Run Service

**Input**: Image URL, secret references, env vars, SA email, Cloud SQL connection name
**Output**: Service URL (`*.run.app`)
**Contract**:
```yaml
service: saldare-backend
region: us-central1
memory: 512Mi
max-instances: 2
min-instances: 0
concurrency: 80
auth: require-authentication
secrets:
  - /run/secrets/gcp-sa-key → saldare-gcp-sa-key:latest
  - /run/secrets/firebase-key → saldare-firebase-key:latest
cloudsql-instances: <project>:us-central1:saldare-db
service-account: saldare-backend-sa@<project>.iam.gserviceaccount.com
```

### Step 9: Verify End-to-End

**Input**: Service URL, test PDF file
**Output**: HTTP 200 with extraction result
**Acceptance**: Authenticated POST to `/api/documents/upload` returns extracted form fields
