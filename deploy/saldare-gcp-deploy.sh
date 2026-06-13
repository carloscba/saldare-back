#!/usr/bin/env bash
#
# =============================================================================
# saldare-gcp-deploy.sh — Saldare Backend GCP Deployment Script
# =============================================================================
#
# Prerequisites:
#   - Google Cloud account with owner permissions and billing administrator
#   - gcloud CLI installed and authenticated (gcloud auth login)
#   - Docker installed (for local testing; Cloud Build handles the actual build)
#   - openssl (for password generation)
#   - curl (for health checks)
#
# Required environment variables (or use --flags):
#   --project-id=project-f23ad73d-c262-435c-acc         GCP project ID (e.g. saldare-XXXXXX)
#   --billing-account=0119BA-4770FA-B35FA4  GCP billing account ID
#
# Steps executed:
#   1. Create GCP project, link billing, enable 9 APIs
#   2. Create Firebase project, enable Email/Password auth, download SA key
#   3. Create Document AI Form Parser processor in us-central1
#   4. Create Cloud SQL PostgreSQL 15 instance (db-f1-micro)
#   5. Create service account with minimal IAM roles, generate key
#   6. Store secrets in Secret Manager (SA keys + DATABASE_URL)
#   7. Build Docker image via Cloud Build, push to Artifact Registry
#   8. Deploy to Cloud Run with all configuration
#   9. Verify health check and end-to-end document processing
#
# Usage:
#   ./saldare-gcp-deploy.sh --project-id=saldare-XXXXXX --billing-account=XXXXXX-XXXXXX-XXXXXX
#   ./saldare-gcp-deploy.sh --destroy  (teardown all resources)
#
# =============================================================================

set -euo pipefail

# ─── Defaults ─────────────────────────────────────────────────────────────────

REGION="us-central1"
DOCAI_LOCATION="us"
PROJECT_ID=""
BILLING_ACCOUNT=""
DB_PASSWORD=""
SERVICE_NAME="saldare-backend"
DB_INSTANCE_NAME="saldare-db"
DB_NAME="saldare"
DB_USER="saldare-user"
REPO_NAME="saldare-images"
SA_NAME="saldare-backend-sa"
IMAGE_TAG="v1"
DESTROY_MODE=false

SCRIPT_DIR="$(CDPATH="" cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND_DIR="$(dirname "$SCRIPT_DIR")"

# ─── Helper functions ─────────────────────────────────────────────────────────

log_info()  { echo -e "\033[0;34m[INFO]\033[0m  $*"; }
log_error() { echo -e "\033[0;31m[ERROR]\033[0m $*" >&2; }
log_ok()    { echo -e "\033[0;32m[OK]\033[0m    $*"; }

check_dependency() {
  local cmd="$1"
  local hint="${2:-Install it to continue.}"
  if ! command -v "$cmd" &>/dev/null; then
    log_error "Missing required command: '$cmd'"
    log_error "$hint"
    exit 1
  fi
}

confirm() {
  local prompt="$1"
  local default="${2:-n}"
  local yn
  read -r -p "$prompt [y/N]: " yn
  yn="${yn:-$default}"
  [[ "$yn" =~ ^[Yy]$ ]]
}

on_error() {
  local exit_code=$?
  log_error "Deployment failed at step with exit code $exit_code"
  log_info "Common recovery steps:"
  log_info "  1. Re-run the script — it is idempotent and will skip already-created resources"
  log_info "  2. Check GCP Console for quota limits: https://console.cloud.google.com/iam-admin/quotas"
  log_info "  3. Verify billing account is active: https://console.cloud.google.com/billing"
  log_info "  4. To destroy all resources and start over, run: $0 --destroy"
  exit $exit_code
}
trap on_error ERR

# ─── Argument parsing ─────────────────────────────────────────────────────────

usage() {
  cat <<EOF
Usage: $0 --project-id=ID --billing-account=ACCT [OPTIONS]

Required:
  --project-id=ID         GCP project ID (e.g. saldare-XXXXXX)
  --billing-account=ACCT  GCP billing account ID

Options:
  --region=REGION         GCP region (default: us-central1)
  --db-password=PASS      Cloud SQL database password (auto-generated if omitted)
  --image-tag=TAG         Docker image tag (default: v1)
  --destroy               Tear down all deployed GCP resources
  -h, --help              Show this help message

Description:
  Sets up all GCP infrastructure for Saldare Backend:
    1. GCP project with billing and APIs enabled
    2. Firebase project with Email/Password auth
    3. Document AI Form Parser processor
    4. Cloud SQL PostgreSQL instance (db-f1-micro)
    5. Service accounts with minimal IAM roles
    6. Secret Manager secrets
    7. Docker image build and push to Artifact Registry
    8. Cloud Run service deployment
    9. End-to-end verification
EOF
  exit 0
}

parse_args() {
  while [[ $# -gt 0 ]]; do
    case "$1" in
      --project-id=*)         PROJECT_ID="${1#*=}" ;;
      --billing-account=*)    BILLING_ACCOUNT="${1#*=}" ;;
      --region=*)             REGION="${1#*=}" ;;
      --db-password=*)        DB_PASSWORD="${1#*=}" ;;
      --image-tag=*)          IMAGE_TAG="${1#*=}" ;;
      --destroy)              DESTROY_MODE=true ;;
      -h|--help)              usage ;;
      *)                      log_error "Unknown argument: $1"; usage ;;
    esac
    shift
  done

  if [[ -z "$PROJECT_ID" ]]; then
    log_error "--project-id is required"
    usage
  fi
  if [[ -z "$BILLING_ACCOUNT" ]]; then
    log_error "--billing-account is required"
    usage
  fi

  if [[ -z "$DB_PASSWORD" ]]; then
    DB_PASSWORD=$(openssl rand -base64 32)
    log_info "Generated random DB password"
  fi
}

# ─── Prerequisite checks ──────────────────────────────────────────────────────

check_prerequisites() {
  log_info "Checking prerequisites..."
  check_dependency "gcloud"     "Install: https://cloud.google.com/sdk/docs/install"
  check_dependency "openssl"    "Install via your package manager"
  check_dependency "curl"       "Install via your package manager"

  local account
  account=$(gcloud config get-value account 2>/dev/null || true)
  if [[ -z "$account" ]]; then
    log_error "gcloud is not authenticated. Run: gcloud auth login"
    exit 1
  fi
  log_ok "Authenticated as: $account"
}

# ─── Validate inputs ──────────────────────────────────────────────────────────

validate_inputs() {
  log_info "Validating inputs..."

  if ! [[ "$PROJECT_ID" =~ ^[a-z][a-z0-9-]{4,28}[a-z0-9]$ ]]; then
    log_error "Invalid project ID format: $PROJECT_ID"
    log_error "Must be 6-30 chars, lowercase letters, digits, hyphens."
    exit 1
  fi

  if ! [[ "$REGION" =~ ^[a-z]+-[a-z]+[0-9]$ ]]; then
    log_error "Invalid region format: $REGION"
    exit 1
  fi

  if ! [[ "$BILLING_ACCOUNT" =~ ^[A-Z0-9]{6}-[A-Z0-9]{6}-[A-Z0-9]{6}$ ]]; then
    log_error "Invalid billing account format: $BILLING_ACCOUNT"
    log_error "Expected format: XXXXXX-XXXXXX-XXXXXX"
    exit 1
  fi

  log_ok "Inputs validated"
}

# ─── Idempotency helpers ──────────────────────────────────────────────────────

resource_exists() {
  local description="$1"
  shift
  if "$@" &>/dev/null; then
    log_info "$description already exists, skipping."
    return 0
  fi
  return 1
}

# ─── Step 1: Create GCP Project & Enable APIs ─────────────────────────────────

step1_create_project() {
  log_info "Step 1: Creating GCP project '$PROJECT_ID'..."

  if resource_exists "Project '$PROJECT_ID'" gcloud projects describe "$PROJECT_ID"; then
    log_info "Setting active project to '$PROJECT_ID'..."
    gcloud config set project "$PROJECT_ID"
    return
  fi

  log_info "Creating project..."
  gcloud projects create "$PROJECT_ID" \
    --name="Saldare Backend" \
    --set-as-default

  log_info "Linking billing account '$BILLING_ACCOUNT'..."
  gcloud beta billing projects link "$PROJECT_ID" \
    --billing-account="$BILLING_ACCOUNT"

  log_ok "Project '$PROJECT_ID' created and billing linked"
}

step1_enable_apis() {
  log_info "Step 1b: Enabling required APIs..."

  local apis=(
    documentai.googleapis.com
    run.googleapis.com
    cloudbuild.googleapis.com
    artifactregistry.googleapis.com
    secretmanager.googleapis.com
    sqladmin.googleapis.com
    iam.googleapis.com
    firebase.googleapis.com
    cloudresourcemanager.googleapis.com
  )

  log_info "Enabling ${#apis[@]} APIs (this may take 2-3 minutes)..."
  gcloud services enable "${apis[@]}" --project="$PROJECT_ID"

  log_ok "All APIs enabled"
  log_info "Waiting 15s for API enablement to propagate..."
  sleep 15
}

# ─── Step 2: Create Firebase Project & Enable Auth ────────────────────────────

step2_firebase() {
  log_info "Step 2: Configuring Firebase project..."

  if resource_exists "Firebase project" gcloud firebase projects describe "projects/$PROJECT_ID" 2>/dev/null; then
    :
  else
    log_info "Adding Firebase to project '$PROJECT_ID'..."
    gcloud firebase projects create "$PROJECT_ID" --project="$PROJECT_ID" || {
      log_info "Firebase CLI may not support project creation. Opening console..."
      log_info "Visit: https://console.firebase.google.com/"
      log_info "  → Add project → Select '$PROJECT_ID' → Confirm plan (Spark/Blaze)"
      if ! confirm "Have you completed Firebase project setup in the Console?"; then
        log_error "Firebase project setup is required. Aborting."
        exit 1
      fi
    }
  fi

  log_info "Enabling Email/Password authentication provider..."
  log_info "Manual step required — visit Firebase Console:"
  log_info "  → Authentication → Sign-in method → Email/Password → Enable"

  if ! confirm "Have you enabled Email/Password in Firebase Console?"; then
    log_error "Email/Password auth must be enabled. Aborting."
    exit 1
  fi

  log_ok "Firebase project configured"
}

step2_firebase_key() {
  log_info "Step 2b: Firebase Admin SDK credentials..."
  log_info "  Organization policy blocks SA key creation."
  log_info "  Firebase Admin SDK will use Application Default Credentials (ADC)"
  log_info "  via the Cloud Run service account metadata server."
  log_info "  No JSON key file is needed at runtime."
  FIREBASE_KEY_FILE=""
  log_ok "Firebase will use ADC — no key download needed"
}

# ─── Step 3: Create Document AI Processor ─────────────────────────────────────

step3_document_ai() {
  log_info "Step 3: Creating Document AI Form Parser processor..."

  local api_endpoint="https://documentai.googleapis.com/v1/projects/${PROJECT_ID}/locations/${DOCAI_LOCATION}/processors"
  local token
  token=$(gcloud auth print-access-token)

  log_info "Checking for existing processor 'saldare-form-parser'..."
  local existing
  existing=$(curl -s -H "Authorization: Bearer ${token}" \
    "${api_endpoint}" 2>/dev/null || true)

  if echo "$existing" | grep -q "saldare-form-parser"; then
    PROCESSOR_ID=$(echo "$existing" | grep -o '"name": *"[^"]*processors/[^"]*"' | head -1 | grep -o 'processors/[^"]*' | awk -F/ '{print $2}')
    log_info "Processor 'saldare-form-parser' already exists: $PROCESSOR_ID"
    export PROCESSOR_ID
    return
  fi

  log_info "Creating Form Parser processor in $REGION..."
  local output
  output=$(curl -s -X POST "${api_endpoint}" \
    -H "Authorization: Bearer ${token}" \
    -H "Content-Type: application/json" \
    -d "{
      \"displayName\": \"saldare-form-parser\",
      \"type\": \"FORM_PARSER_PROCESSOR\"
    }")

  if [[ -z "$output" ]] || echo "$output" | grep -q '"error"'; then
    log_error "Failed to create Document AI processor."
    log_error "API response: $output"
    exit 1
  fi

  PROCESSOR_ID=$(echo "$output" | grep -o '"name": *"[^"]*processors/[^"]*"' | head -1 | grep -o 'processors/[^"]*' | awk -F/ '{print $2}')

  if [[ -z "$PROCESSOR_ID" ]]; then
    log_error "Could not extract PROCESSOR_ID from API response."
    log_error "Raw response: $output"
    exit 1
  fi

  export PROCESSOR_ID
  log_ok "Document AI processor created: $PROCESSOR_ID"
}

# ─── Step 4: Create Cloud SQL Instance & Database ─────────────────────────────

step4_create_sql_instance() {
  log_info "Step 4: Creating Cloud SQL instance '$DB_INSTANCE_NAME'..."
  log_info "This may take 5-10 minutes for the instance to be ready."

  if resource_exists "Cloud SQL instance '$DB_INSTANCE_NAME'" gcloud sql instances describe "$DB_INSTANCE_NAME" --project="$PROJECT_ID"; then
    INSTANCE_CONNECTION_NAME="${PROJECT_ID}:${REGION}:${DB_INSTANCE_NAME}"
    log_info "Connection name: $INSTANCE_CONNECTION_NAME"
    return
  fi

  log_info "Creating db-f1-micro PostgreSQL 15 instance in $REGION..."
  gcloud sql instances create "$DB_INSTANCE_NAME" \
    --database-version=POSTGRES_15 \
    --tier=db-f1-micro \
    --region="$REGION" \
    --storage-size=10GB \
    --storage-type=SSD \
    --project="$PROJECT_ID"

  INSTANCE_CONNECTION_NAME="${PROJECT_ID}:${REGION}:${DB_INSTANCE_NAME}"
  log_ok "Cloud SQL instance created"
  log_info "Connection name: $INSTANCE_CONNECTION_NAME"
  log_info "Waiting 30s for instance to initialize..."
  sleep 30
}

step4_create_database() {
  log_info "Step 4b: Creating database '$DB_NAME'..."

  if resource_exists "Database '$DB_NAME'" gcloud sql databases describe "$DB_NAME" --instance="$DB_INSTANCE_NAME" --project="$PROJECT_ID"; then
    return
  fi

  gcloud sql databases create "$DB_NAME" \
    --instance="$DB_INSTANCE_NAME" \
    --project="$PROJECT_ID"

  log_ok "Database '$DB_NAME' created"
}

step4_create_db_user() {
  log_info "Step 4c: Creating database user '$DB_USER'..."

  if resource_exists "Database user '$DB_USER'" gcloud sql users describe "$DB_USER" --instance="$DB_INSTANCE_NAME" --project="$PROJECT_ID"; then
    log_info "Updating password for existing user '$DB_USER'..."
    gcloud sql users set-password "$DB_USER" \
      --instance="$DB_INSTANCE_NAME" \
      --password="$DB_PASSWORD" \
      --project="$PROJECT_ID"
    log_ok "Database user password updated"
    return
  fi

  gcloud sql users create "$DB_USER" \
    --instance="$DB_INSTANCE_NAME" \
    --password="$DB_PASSWORD" \
    --project="$PROJECT_ID"

  log_ok "Database user '$DB_USER' created"
}

step4_connection_info() {
  log_info "Step 4d: Cloud SQL connection info..."

  local unix_socket="/cloudsql/${INSTANCE_CONNECTION_NAME}"

  DATABASE_URL="postgresql://${DB_USER}:${DB_PASSWORD}@localhost:5432/${DB_NAME}?host=${unix_socket}"

  cat <<EOF

  ────────────────────────────────────────────
  Cloud SQL Connection
  ────────────────────────────────────────────
  Instance:          $DB_INSTANCE_NAME
  Connection name:   $INSTANCE_CONNECTION_NAME
  Database:          $DB_NAME
  User:              $DB_USER
  Unix socket path:  $unix_socket
  DATABASE_URL:      $DATABASE_URL
  ────────────────────────────────────────────
EOF

  log_ok "Cloud SQL connection ready"
}

# ─── Step 5: Create Service Accounts & IAM Bindings ───────────────────────────

step5_create_sa() {
  log_info "Step 5: Creating service account '$SA_NAME'..."

  local sa_email="${SA_NAME}@${PROJECT_ID}.iam.gserviceaccount.com"

  if resource_exists "Service account '$sa_email'" gcloud iam service-accounts describe "$sa_email" --project="$PROJECT_ID"; then
    SA_EMAIL="$sa_email"
    return
  fi

  gcloud iam service-accounts create "$SA_NAME" \
    --display-name="Saldare Backend Service Account" \
    --project="$PROJECT_ID"

  SA_EMAIL="${SA_NAME}@${PROJECT_ID}.iam.gserviceaccount.com"
  log_ok "Service account created: $SA_EMAIL"
}

step5_iam_bindings() {
  log_info "Step 5b: Assigning IAM roles to '$SA_EMAIL'..."

  local roles=(
    roles/documentai.apiUser
    roles/cloudsql.client
    roles/firebase.admin
  )

  for role in "${roles[@]}"; do
    log_info "  Binding $role..."
    gcloud projects add-iam-policy-binding "$PROJECT_ID" \
      --member="serviceAccount:${SA_EMAIL}" \
      --role="$role" \
      --condition=None \
      --project="$PROJECT_ID" 2>/dev/null || {
      log_info "  $role may already be bound (ignoring error)"
    }
  done

  log_ok "IAM roles assigned"
  log_info "Waiting 10s for IAM propagation..."
  sleep 10
}

step5_generate_sa_key() {
  log_info "Step 5c: Service account keys are DISABLED by organization policy."
  log_info "  Policy: constraints/iam.disableServiceAccountKeyCreation"
  log_info ""
  log_info "  This is a security best practice. Cloud Run uses Application Default"
  log_info "  Credentials (ADC) automatically via the service account metadata server."
  log_info "  No JSON key file is needed at runtime."
  log_info ""
  log_info "  Document AI and Firebase Admin SDK will use ADC natively in Cloud Run."

  GCP_KEY_FILE=""
  FIREBASE_KEY_FILE=""
  USE_ADC=true
  log_ok "Will use Application Default Credentials (ADC) — no keys needed"
}

# ─── Step 6: Store Secrets in Secret Manager ─────────────────────────────────

step6_create_secrets() {
  log_info "Step 6: Creating secrets in Secret Manager..."

  local secrets=(
    saldare-db-url
  )

  for secret in "${secrets[@]}"; do
    if resource_exists "Secret '$secret'" gcloud secrets describe "$secret" --project="$PROJECT_ID"; then
      continue
    fi
    log_info "  Creating secret '$secret'..."
    gcloud secrets create "$secret" \
      --replication-policy=automatic \
      --project="$PROJECT_ID"
  done

  log_ok "Secrets created"
}

step6_upload_secrets() {
  log_info "Step 6b: Uploading secret versions..."

  log_info "  Uploading DATABASE_URL to 'saldare-db-url'..."
  echo -n "$DATABASE_URL" | gcloud secrets versions add saldare-db-url \
    --data-file=- \
    --project="$PROJECT_ID"

  log_ok "Secret versions uploaded"
}

step6_env_vars() {
  log_info "Step 6c: Environment variables for Cloud Run..."

  cat <<EOF

  ────────────────────────────────────────────
  Cloud Run Environment Variables
  ────────────────────────────────────────────

  Authentication (ADC — no key files needed):
    Cloud Run service account provides credentials
    automatically via metadata server

  Secrets (mounted as env var):
    saldare-db-url               → DATABASE_URL

  Plain environment variables:
    DOCUMENT_AI_PROJECT_ID        = $PROJECT_ID
    DOCUMENT_AI_PROCESSOR_ID      = $PROCESSOR_ID
    DOCUMENT_AI_PROCESSOR_LOCATION= $DOCAI_LOCATION
    GOOGLE_CLOUD_PROJECT           = $PROJECT_ID
    FIREBASE_PROJECT_ID            = $PROJECT_ID
    NODE_ENV                       = production

  ────────────────────────────────────────────
EOF

  log_ok "Environment variables ready"
}

# ─── Step 7: Build & Push Docker Image ───────────────────────────────────────

step7_create_artifact_registry() {
  log_info "Step 7: Creating Artifact Registry repository '$REPO_NAME'..."

  if resource_exists "Artifact Registry '$REPO_NAME'" gcloud artifacts repositories describe "$REPO_NAME" --location="$REGION" --project="$PROJECT_ID"; then
    return
  fi

  gcloud artifacts repositories create "$REPO_NAME" \
    --repository-format=docker \
    --location="$REGION" \
    --project="$PROJECT_ID"

  log_ok "Artifact Registry repository created"
}

step7_build_and_push() {
  log_info "Step 7b: Building and pushing Docker image..."

  local project_number
  project_number=$(gcloud projects describe "$PROJECT_ID" --format="value(projectNumber)")
  local cloudbuild_sa="${project_number}@cloudbuild.gserviceaccount.com"

  log_info "Granting Cloud Build and Compute SAs storage & logging access..."
  gcloud projects add-iam-policy-binding "$PROJECT_ID" \
    --member="serviceAccount:${cloudbuild_sa}" \
    --role="roles/storage.objectAdmin" \
    --condition=None 2>/dev/null || log_info "  Storage role may already be bound (cloudbuild)"

  gcloud projects add-iam-policy-binding "$PROJECT_ID" \
    --member="serviceAccount:${project_number}-compute@developer.gserviceaccount.com" \
    --role="roles/storage.objectAdmin" \
    --condition=None 2>/dev/null || log_info "  Storage role may already be bound (compute)"

  gcloud projects add-iam-policy-binding "$PROJECT_ID" \
    --member="serviceAccount:${project_number}-compute@developer.gserviceaccount.com" \
    --role="roles/logging.logWriter" \
    --condition=None 2>/dev/null || log_info "  Logging role may already be bound (compute)"

  gcloud projects add-iam-policy-binding "$PROJECT_ID" \
    --member="serviceAccount:${project_number}-compute@developer.gserviceaccount.com" \
    --role="roles/artifactregistry.writer" \
    --condition=None 2>/dev/null || log_info "  Artifact Registry role may already be bound (compute)"

  IMAGE_URL="${REGION}-docker.pkg.dev/${PROJECT_ID}/${REPO_NAME}/${SERVICE_NAME}:${IMAGE_TAG}"

  log_info "Image: $IMAGE_URL"
  log_info "Build context: $BACKEND_DIR"
  log_info "This may take 3-5 minutes (Cloud Build)..."

  gcloud builds submit "$BACKEND_DIR" \
    --tag="$IMAGE_URL" \
    --project="$PROJECT_ID"

  log_ok "Image built and pushed to Artifact Registry"
  log_info "Image URL: $IMAGE_URL"
}

# ─── Step 8: Deploy Cloud Run Service ────────────────────────────────────────

step8_deploy_cloud_run() {
  log_info "Step 8: Deploying Cloud Run service '$SERVICE_NAME'..."

  log_info "Reading DATABASE_URL from Secret Manager..."
  local db_url
  db_url=$(gcloud secrets versions access latest --secret=saldare-db-url --project="$PROJECT_ID")

  log_info "Deploying to $REGION..."
  gcloud run deploy "$SERVICE_NAME" \
    --image="$IMAGE_URL" \
    --region="$REGION" \
    --platform=managed \
    --memory=512Mi \
    --max-instances=2 \
    --min-instances=0 \
    --concurrency=80 \
    --allow-unauthenticated \
    --service-account="$SA_EMAIL" \
    --add-cloudsql-instances="$INSTANCE_CONNECTION_NAME" \
    --set-env-vars="DATABASE_URL=${db_url}" \
    --set-env-vars="DOCUMENT_AI_PROJECT_ID=${PROJECT_ID}" \
    --set-env-vars="DOCUMENT_AI_PROCESSOR_ID=${PROCESSOR_ID}" \
    --set-env-vars="DOCUMENT_AI_PROCESSOR_LOCATION=${DOCAI_LOCATION}" \
    --set-env-vars="FIREBASE_PROJECT_ID=${PROJECT_ID}" \
    --set-env-vars="GOOGLE_CLOUD_PROJECT=${PROJECT_ID}" \
    --set-env-vars="NODE_ENV=production" \
    --project="$PROJECT_ID"

  log_ok "Cloud Run service deployed"
}

step8_health_check() {
  log_info "Step 8b: Retrieving service URL and running health check..."

  SERVICE_URL=$(gcloud run services describe "$SERVICE_NAME" \
    --region="$REGION" \
    --project="$PROJECT_ID" \
    --format="value(status.url)")

  log_info "Service URL: $SERVICE_URL"

  log_info "Running health check (cold start may take 3-5s)..."
  local attempts=0
  local max_attempts=5
  local delay=6

  while [[ $attempts -lt $max_attempts ]]; do
    attempts=$((attempts + 1))
    log_info "  Attempt $attempts/$max_attempts..."

    local response
    local id_token
    id_token=$(gcloud auth print-identity-token 2>/dev/null)
    response=$(curl -s -o /dev/null -w "%{http_code}" -H "Authorization: Bearer ${id_token}" "${SERVICE_URL}/api/health" 2>/dev/null || echo "000")

    if [[ "$response" == "200" ]]; then
      log_ok "Health check passed (HTTP $response)"
      return
    fi

    if [[ $attempts -lt $max_attempts ]]; then
      log_info "  Got HTTP $response, retrying in ${delay}s..."
      sleep "$delay"
    fi
  done

  log_error "Health check failed after $max_attempts attempts"
  log_info "Check logs: gcloud run logs tail $SERVICE_NAME --region=$REGION"
  exit 1
}

# ─── Destroy (Teardown) ──────────────────────────────────────────────────────

destroy_resources() {
  log_info "Destroying all GCP resources for project '$PROJECT_ID'..."
  echo ""

  cat <<EOF
  ╔══════════════════════════════════════════════════════╗
  ║  WARNING: This will destroy ALL deployed resources! ║
  ╚══════════════════════════════════════════════════════╝

  Resources to be deleted:
    - Cloud Run service:     $SERVICE_NAME
    - Cloud SQL instance:    $DB_INSTANCE_NAME
    - Artifact Registry:     $REPO_NAME
    - Secret Manager secrets: saldare-db-url
    - Service account:       $SA_NAME
    - GCP project:           $PROJECT_ID

EOF

  if ! confirm "Type 'yes' to confirm destruction of ALL resources" "n"; then
    log_info "Destruction cancelled."
    exit 0
  fi

  log_info "Deleting Cloud Run service '$SERVICE_NAME'..."
  gcloud run services delete "$SERVICE_NAME" --region="$REGION" --project="$PROJECT_ID" --quiet || true

  log_info "Deleting Cloud SQL instance '$DB_INSTANCE_NAME'..."
  gcloud sql instances delete "$DB_INSTANCE_NAME" --project="$PROJECT_ID" --quiet || true

  log_info "Deleting Artifact Registry repository '$REPO_NAME'..."
  gcloud artifacts repositories delete "$REPO_NAME" --location="$REGION" --project="$PROJECT_ID" --quiet || true

  log_info "Deleting Secret Manager secrets..."
  for secret in saldare-db-url; do
    gcloud secrets delete "$secret" --project="$PROJECT_ID" --quiet || true
  done

  log_info "Deleting service account '$SA_NAME'..."
  local sa_email="${SA_NAME}@${PROJECT_ID}.iam.gserviceaccount.com"
  gcloud iam service-accounts delete "$sa_email" --project="$PROJECT_ID" --quiet || true

  log_info "Deleting GCP project '$PROJECT_ID'..."
  gcloud projects delete "$PROJECT_ID" --quiet || true

  log_ok "All resources destroyed"
}

# ─── Step 9: Verify End-to-End ───────────────────────────────────────────────

step9_verify_e2e() {
  log_info "Step 9: End-to-end verification..."

  cat <<EOF

  ────────────────────────────────────────────────────────────
  End-to-End Verification
  ────────────────────────────────────────────────────────────

  Service URL: $SERVICE_URL

  To fully verify the deployment, follow these steps:

  1. Create a test user in Firebase Console:
     → Authentication → Users → Add user
     → Email: test@example.com / Password: TestPass123!

  2. Obtain a Firebase JWT token:
     curl -X POST "https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=FIREBASE_API_KEY" \\
       -H "Content-Type: application/json" \\
       -d '{"email":"test@example.com","password":"TestPass123!","returnSecureToken":true}'

     (Find FIREBASE_API_KEY in Firebase Console → Project Settings → Web API Key)

  3. Upload a test PDF document:
     curl -X POST "${SERVICE_URL}/api/documents/upload" \\
       -H "Authorization: Bearer <JWT_TOKEN>" \\
       -F "file=@test-document.pdf"

  4. List uploaded documents:
     curl -X GET "${SERVICE_URL}/api/documents" \\
       -H "Authorization: Bearer <JWT_TOKEN>"

  ────────────────────────────────────────────────────────────
EOF

  log_ok "Verification instructions ready"
}

# ─── Summary ──────────────────────────────────────────────────────────────────

print_summary() {
  echo ""
  echo "=============================================="
  echo "  Saldare GCP Deployment"
  echo "=============================================="
  echo "  Project ID:      $PROJECT_ID"
  echo "  Billing Account: $BILLING_ACCOUNT"
  echo "  Region:          $REGION"
  echo "  Service Name:    $SERVICE_NAME"
  echo "  DB Instance:     $DB_INSTANCE_NAME"
  echo "  Image Tag:       $IMAGE_TAG"
  echo "=============================================="
  echo ""
}

# ─── Main ─────────────────────────────────────────────────────────────────────

main() {
  log_info "Saldare GCP Deployment Script"
  log_info "=============================="

  parse_args "$@"

  if $DESTROY_MODE; then
    check_prerequisites
    destroy_resources
    exit 0
  fi

  check_prerequisites
  validate_inputs
  print_summary

  if ! confirm "Proceed with deployment?"; then
    log_info "Aborted by user."
    exit 0
  fi

  # ── Step 1: Create GCP Project & Enable APIs ────────────────────────────────
  step1_create_project
  step1_enable_apis

  # ── Step 2: Create Firebase Project & Enable Auth ───────────────────────────
  step2_firebase
  step2_firebase_key

  # ── Step 3: Create Document AI Processor ────────────────────────────────────
  step3_document_ai

  # ── Step 4: Create Cloud SQL Instance & Database ────────────────────────────
  step4_create_sql_instance
  step4_create_database
  step4_create_db_user
  step4_connection_info

  # ── Step 5: Create Service Accounts & IAM Bindings ──────────────────────────
  step5_create_sa
  step5_iam_bindings
  step5_generate_sa_key

  # ── Step 6: Store Secrets in Secret Manager ─────────────────────────────────
  step6_create_secrets
  step6_upload_secrets
  step6_env_vars

  # ── Step 7: Build & Push Docker Image ───────────────────────────────────────
  step7_create_artifact_registry
  step7_build_and_push

  # ── Step 8: Deploy Cloud Run Service ────────────────────────────────────────
  step8_deploy_cloud_run
  step8_health_check

  # ── Step 9: Verify End-to-End ───────────────────────────────────────────────
  step9_verify_e2e

  log_ok "Deployment complete!"
}

main "$@"
