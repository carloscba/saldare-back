#!/usr/bin/env bash
set -euo pipefail

REGION="us-central1"
DOCAI_LOCATION="us"
PROJECT_ID=""
SERVICE_NAME="saldare-backend"
DB_INSTANCE_NAME="saldare-db"
REPO_NAME="saldare-images"
SA_NAME="saldare-backend-sa"
IMAGE_TAG="${IMAGE_TAG:-v1}"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND_DIR="$(dirname "$SCRIPT_DIR")"

log_info()  { echo -e "\033[0;34m[INFO]\033[0m  $*"; }
log_error() { echo -e "\033[0;31m[ERROR]\033[0m $*" >&2; }
log_ok()    { echo -e "\033[0;32m[OK]\033[0m    $*"; }

usage() {
  cat <<EOF
Usage: $0 --project-id=ID

Options:
  --project-id=ID    GCP project ID (required)
  --image-tag=TAG    Docker image tag (default: v1)

Steps:
  1. Build Docker image via Cloud Build, push to Artifact Registry
  2. Deploy to Cloud Run
  3. Health check
  4. Show end-to-end verification instructions
EOF
  exit 0
}

parse_args() {
  while [[ $# -gt 0 ]]; do
    case "$1" in
      --project-id=*)       PROJECT_ID="${1#*=}" ;;
      --image-tag=*)        IMAGE_TAG="${1#*=}" ;;
      -h|--help)            usage ;;
      *)                    log_error "Unknown argument: $1"; usage ;;
    esac
    shift
  done
  if [[ -z "$PROJECT_ID" ]]; then
    log_error "--project-id is required"
    usage
  fi
}

check_dependency() {
  local cmd="$1"
  local hint="${2:-Install it to continue.}"
  if ! command -v "$cmd" &>/dev/null; then
    log_error "Missing required command: '$cmd'"
    log_error "$hint"
    exit 1
  fi
}

trap 'log_error "Deploy failed at line $LINENO"' ERR

# ─── Main ──────────────────────────────────────────────────────────────────────

main() {
  parse_args "$@"

  log_info "Saldare Deploy-Only"
  log_info "===================="
  log_info "Project:         $PROJECT_ID"
  log_info "Region:          $REGION"
  log_info "Tag:     $IMAGE_TAG"

  check_dependency "gcloud"
  check_dependency "curl"

  SA_EMAIL="${SA_NAME}@${PROJECT_ID}.iam.gserviceaccount.com"
  INSTANCE_CONNECTION_NAME="${PROJECT_ID}:${REGION}:${DB_INSTANCE_NAME}"
  IMAGE_URL="${REGION}-docker.pkg.dev/${PROJECT_ID}/${REPO_NAME}/${SERVICE_NAME}:${IMAGE_TAG}"

  # ── Step 1: Build & Push ─────────────────────────────────────────────────────
  log_info "Step 1: Building and pushing Docker image via Cloud Build..."

  local project_number
  project_number=$(gcloud projects describe "$PROJECT_ID" --format="value(projectNumber)")

  log_info "Granting Cloud Build permissions..."
  gcloud projects add-iam-policy-binding "$PROJECT_ID" \
    --member="serviceAccount:${project_number}-compute@developer.gserviceaccount.com" \
    --role="roles/artifactregistry.writer" \
    --condition=None 2>/dev/null || true
  gcloud projects add-iam-policy-binding "$PROJECT_ID" \
    --member="serviceAccount:${project_number}-compute@developer.gserviceaccount.com" \
    --role="roles/storage.objectAdmin" \
    --condition=None 2>/dev/null || true
  gcloud projects add-iam-policy-binding "$PROJECT_ID" \
    --member="serviceAccount:${project_number}-compute@developer.gserviceaccount.com" \
    --role="roles/logging.logWriter" \
    --condition=None 2>/dev/null || true

  log_info "Image: $IMAGE_URL"
  log_info "Build context: $BACKEND_DIR"

  gcloud builds submit "$BACKEND_DIR" \
    --tag="$IMAGE_URL" \
    --project="$PROJECT_ID"

  log_ok "Image built and pushed"

  # ── Step 2: Deploy to Cloud Run ──────────────────────────────────────────────
  log_info "Step 2: Deploying to Cloud Run..."

  log_info "Reading DATABASE_URL from Secret Manager..."
  local db_url
  db_url=$(gcloud secrets versions access latest --secret=saldare-db-url --project="$PROJECT_ID")

  log_info "Retrieving processor ID..."
  local processor_id
  processor_id=$(curl -s -H "Authorization: Bearer $(gcloud auth print-access-token)" \
    "https://documentai.googleapis.com/v1/projects/${PROJECT_ID}/locations/${DOCAI_LOCATION}/processors" \
    | python3 -c "
import sys, json
data = json.load(sys.stdin)
for p in data.get('processors', []):
    if 'saldare-form-parser' in p.get('displayName', ''):
        print(p['name'].split('/')[-1])
        break
" 2>/dev/null)

  if [[ -z "$processor_id" ]]; then
    log_error "Could not find Document AI processor 'saldare-form-parser'"
    exit 1
  fi
  log_info "Processor ID: $processor_id"

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
    --set-env-vars="DOCUMENT_AI_PROCESSOR_ID=${processor_id}" \
    --set-env-vars="DOCUMENT_AI_PROCESSOR_LOCATION=${DOCAI_LOCATION}" \
    --set-env-vars="FIREBASE_PROJECT_ID=${PROJECT_ID}" \
    --set-env-vars="GOOGLE_CLOUD_PROJECT=${PROJECT_ID}" \
    --set-env-vars="NODE_ENV=production" \
    --project="$PROJECT_ID"

  log_ok "Cloud Run service deployed"

  # ── Step 3: Health Check ─────────────────────────────────────────────────────
  log_info "Step 3: Health check..."

  SERVICE_URL=$(gcloud run services describe "$SERVICE_NAME" \
    --region="$REGION" \
    --project="$PROJECT_ID" \
    --format="value(status.url)")

  log_info "Service URL: $SERVICE_URL"
  log_info "Waiting for service to be ready (cold start may take 3-5s)..."

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
      break
    fi

    if [[ $attempts -lt $max_attempts ]]; then
      log_info "  Got HTTP $response, retrying in ${delay}s..."
      sleep "$delay"
    fi
  done

  if [[ "${response:-000}" != "200" ]]; then
    log_error "Health check failed after $max_attempts attempts"
    log_info "Check logs: gcloud run logs tail $SERVICE_NAME --region=$REGION --project=$PROJECT_ID"
    exit 1
  fi

  # ── Step 4: E2E Verification Instructions ────────────────────────────────────
  cat <<EOF

  ────────────────────────────────────────────────────────────
  End-to-End Verification
  ────────────────────────────────────────────────────────────

  Service URL: $SERVICE_URL

  1. Create a test user in Firebase Console:
     → Authentication → Users → Add user

  2. Obtain a Firebase JWT:
     curl -X POST "https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=FIREBASE_API_KEY" \\
       -H "Content-Type: application/json" \\
       -d '{"email":"test@example.com","password":"TestPass123!","returnSecureToken":true}'

  3. Upload a test PDF:
     curl -X POST "${SERVICE_URL}/api/documents/upload" \\
       -H "Authorization: Bearer <JWT_TOKEN>" \\
       -F "file=@test-document.pdf"

  ────────────────────────────────────────────────────────────
EOF

  log_ok "Deploy complete!"
}

main "$@"
