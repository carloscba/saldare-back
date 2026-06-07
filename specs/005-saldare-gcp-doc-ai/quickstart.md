# Quickstart: Saldare Backend en Google Cloud con Document AI

## Prerequisites

- **Google Cloud account**: Con permisos de propietario (`roles/owner`) y billing administrator
- **Billing account**: Configurada y activa en Google Cloud
- **gcloud CLI**: Instalado y configurado (`gcloud auth login`, `gcloud config set account`)
- **Docker**: Instalado (para pruebas locales de la imagen)
- **Node.js 22**: Runtime objetivo en el contenedor
- **Código del backend**: Repositorio con el backend NestJS (spec 003), incluyendo `Dockerfile`, `package.json`, y configuración de Prisma

## Setup (Single Deploy)

Ejecutar el script de despliegue completo:

```bash
# Desde la raíz del repositorio
export GCP_PROJECT_ID="saldare-XXXXXX"
export GCP_BILLING_ACCOUNT="XXXXXX-XXXXXX-XXXXXX"

# 1. Crear proyecto y habilitar APIs
gcloud projects create ${GCP_PROJECT_ID} --name="Saldare Backend"
gcloud config set project ${GCP_PROJECT_ID}
gcloud beta billing projects link ${GCP_PROJECT_ID} --billing-account=${GCP_BILLING_ACCOUNT}

gcloud services enable \
  documentai.googleapis.com \
  run.googleapis.com \
  cloudbuild.googleapis.com \
  artifactregistry.googleapis.com \
  secretmanager.googleapis.com \
  sqladmin.googleapis.com \
  iam.googleapis.com \
  firebase.googleapis.com
```

## Firebase + Auth

```bash
# 2. Crear proyecto Firebase y habilitar Email/Password auth
# Via Firebase Console: https://console.firebase.google.com/
#   → Add project → Select GCP project → Enable Email/Password en Authentication
# Descargar service account key → Firebase Console → Project Settings → Service Accounts → Generate new private key
```

## Document AI Processor

```bash
# 3. Crear processor Form Parser en us-central1
gcloud documentai processors create \
  --display-name="saldare-form-parser" \
  --location=us-central1 \
  --type=FORM_PARSER

# Guardar PROCESSOR_ID del output anterior
export PROCESSOR_ID="abc123def456"
```

## Cloud SQL

```bash
# 4. Crear instancia Cloud SQL PostgreSQL
gcloud sql instances create saldare-db \
  --database-version=POSTGRES_15 \
  --tier=db-f1-micro \
  --region=us-central1 \
  --storage-size=10GB \
  --storage-type=SSD \
  --no-assign-ip

# Crear base de datos y usuario
gcloud sql databases create saldare --instance=saldare-db
gcloud sql users create saldare-user --instance=saldare-db --password=$(openssl rand -base64 32)
```

## Service Accounts & Secrets

```bash
# 5. Crear service account y asignar roles
gcloud iam service-accounts create saldare-backend-sa \
  --display-name="Saldare Backend Service Account"

gcloud projects add-iam-policy-binding ${GCP_PROJECT_ID} \
  --member="serviceAccount:saldare-backend-sa@${GCP_PROJECT_ID}.iam.gserviceaccount.com" \
  --role="roles/documentai.apiUser"

gcloud projects add-iam-policy-binding ${GCP_PROJECT_ID} \
  --member="serviceAccount:saldare-backend-sa@${GCP_PROJECT_ID}.iam.gserviceaccount.com" \
  --role="roles/cloudsql.client"

# Generar y almacenar secretos
gcloud secrets create saldare-gcp-sa-key --replication-policy=automatic
# Subir el contenido de la service account key JSON (generada desde IAM → Service Accounts → Keys)
gcloud secrets versions add saldare-gcp-sa-key --data-file=./gcp-sa-key.json

gcloud secrets create saldare-firebase-key --replication-policy=automatic
gcloud secrets versions add saldare-firebase-key --data-file=./firebase-sa-key.json

# Construir DATABASE_URL y almacenarlo
export DB_PASSWORD="<password-generado>"
export DB_URL="postgresql://saldare-user:${DB_PASSWORD}@localhost:5432/saldare?host=/cloudsql/${GCP_PROJECT_ID}:us-central1:saldare-db"
echo -n "${DB_URL}" | gcloud secrets create saldare-db-url --data-file=- --replication-policy=automatic
```

## Build & Deploy

```bash
# 6. Crear repositorio Artifact Registry
gcloud artifacts repositories create saldare-images \
  --repository-format=docker \
  --location=us-central1

# 7. Construir y subir imagen (usa Cloud Build, evita Docker local)
gcloud builds submit \
  --tag us-central1-docker.pkg.dev/${GCP_PROJECT_ID}/saldare-images/saldare-backend:v1

# 8. Desplegar en Cloud Run
export CONNECTION_NAME="${GCP_PROJECT_ID}:us-central1:saldare-db"

gcloud run deploy saldare-backend \
  --image=us-central1-docker.pkg.dev/${GCP_PROJECT_ID}/saldare-images/saldare-backend:v1 \
  --region=us-central1 \
  --platform=managed \
  --memory=512Mi \
  --max-instances=2 \
  --min-instances=0 \
  --concurrency=80 \
  --no-allow-unauthenticated \
  --service-account=saldare-backend-sa@${GCP_PROJECT_ID}.iam.gserviceaccount.com \
  --add-cloudsql-instances=${CONNECTION_NAME} \
  --set-secrets=/run/secrets/gcp-sa-key=saldare-gcp-sa-key:latest \
  --set-secrets=/run/secrets/firebase-key=saldare-firebase-key:latest \
  --set-env-vars=GOOGLE_APPLICATION_CREDENTIALS=/run/secrets/gcp-sa-key \
  --set-env-vars=FIREBASE_SERVICE_ACCOUNT_KEY=/run/secrets/firebase-key \
  --set-env-vars=DATABASE_URL=$(gcloud secrets versions access latest --secret=saldare-db-url) \
  --set-env-vars=DOCUMENT_AI_PROJECT_ID=${GCP_PROJECT_ID} \
  --set-env-vars=DOCUMENT_AI_PROCESSOR_ID=${PROCESSOR_ID} \
  --set-env-vars=DOCUMENT_AI_PROCESSOR_LOCATION=us-central1 \
  --set-env-vars=FIREBASE_PROJECT_ID=${GCP_PROJECT_ID} \
  --set-env-vars=GOOGLE_CLOUD_PROJECT=${GCP_PROJECT_ID} \
  --set-env-vars=NODE_ENV=production
```

## Verification

```bash
# Obtener URL del servicio
SERVICE_URL=$(gcloud run services describe saldare-backend --region=us-central1 --format='value(status.url)')

# Health check (cold start puede tardar 2-3s la primera vez)
curl -i ${SERVICE_URL}/health

# Subir documento de prueba (requiere token Firebase Auth)
# 1. Crear usuario en Firebase Auth console
# 2. Obtener token JWT via Firebase Auth REST API
# 3. curl -X POST ${SERVICE_URL}/api/documents/upload \
#      -H "Authorization: Bearer <FIREBASE_JWT>" \
#      -F "file=@test-document.pdf"
```

## Access from Frontend

Configurar el frontend Angular (spec 004) con la URL del servicio:

```bash
export API_BASE_URL="${SERVICE_URL}"
```

O en el `environment.prod.ts` del frontend:
```typescript
export const environment = {
  apiBaseUrl: 'https://saldare-backend-XXXXXX-uc.a.run.app'
};
```

## Cleanup

```bash
# Eliminar todos los recursos para evitar costos
gcloud run services delete saldare-backend --region=us-central1 --quiet
gcloud sql instances delete saldare-db --quiet
gcloud artifacts repositories delete saldare-images --location=us-central1 --quiet
gcloud secrets delete saldare-gcp-sa-key --quiet
gcloud secrets delete saldare-firebase-key --quiet
gcloud secrets delete saldare-db-url --quiet
gcloud iam service-accounts delete saldare-backend-sa@${GCP_PROJECT_ID}.iam.gserviceaccount.com --quiet
gcloud projects delete ${GCP_PROJECT_ID} --quiet
```
