# Quickstart: Google Document AI Integration

## Prerequisites

- Node.js 20+, npm
- Google Cloud project with Document AI API enabled
- Form Parser processor created in `us-central1`
- PostgreSQL database (local or Cloud SQL)
- Firebase project with Authentication enabled

## Environment Setup

```bash
# Clone and install
git clone <repo> && cd <repo>
npm install

# Configure environment
cp .env.example .env
# Edit .env with your GCP project ID, processor ID, Firebase project ID, and DATABASE_URL

# Run database migrations
npx prisma migrate dev

# Start the server
npm run start:dev
```

## API Usage

### Upload and process a document

```bash
curl -X POST http://localhost:8080/api/documents/upload \
  -H "Authorization: Bearer <FIREBASE_JWT>" \
  -F "file=@/path/to/invoice.pdf" \
  -F "companyId=0195f1a1-..." \
  -F "ttlDays=30"
```

Response:
```json
{
  "id": "0195f1c2-...",
  "status": "COMPLETED",
  "extractedFields": [
    { "label": "Invoice Number", "value": "INV-2026-001", "confidence": 0.98 },
    { "label": "Total Amount", "value": "$1,250.00", "confidence": 0.95 }
  ]
}
```

### List documents

```bash
curl "http://localhost:8080/api/documents?companyId=0195f1a1-..." \
  -H "Authorization: Bearer <FIREBASE_JWT>"
```

### Get a document

```bash
curl "http://localhost:8080/api/documents/0195f1c2-..." \
  -H "Authorization: Bearer <FIREBASE_JWT>"
```

### Delete a document

```bash
curl -X DELETE "http://localhost:8080/api/documents/0195f1c2-..." \
  -H "Authorization: Bearer <FIREBASE_JWT>"
```

## Integration Scenarios

### Scenario 1: Angular Frontend

```typescript
// Upload a document via Angular service
const formData = new FormData();
formData.append('file', fileInput.files[0]);
formData.append('companyId', companyId);

this.http.post('/api/documents/upload', formData).subscribe({
  next: (doc) => console.log('Extracted:', doc.extractedFields),
  error: (err) => this.snackBar.open(err.message)
});
```

### Scenario 2: Automated Ingest (CLI/Script)

```bash
#!/bin/bash
# Batch upload all PDFs in a directory
for file in ./invoices/*.pdf; do
  curl -X POST http://localhost:8080/api/documents/upload \
    -H "Authorization: Bearer $(gcloud auth print-identity-token)" \
    -F "file=@$file" \
    -F "companyId=$COMPANY_ID"
done
```

## Testing

```bash
# Unit tests
npm run test -- --testPathPattern=document

# E2E test
npm run test:e2e
```

## Troubleshooting

| Problem | Likely Cause | Solution |
|---------|-------------|----------|
| 401 Unauthorized | Invalid/missing Firebase JWT | Verify token with Firebase Auth |
| 400 Bad Request | Unsupported file type | Send PDF, PNG, JPEG, or TIFF |
| 413 Payload Too Large | File >5MB | Compress or split file |
| 503 Service Unavailable | Document AI down | Retry with exponential backoff |
| Document AI returns no fields | Wrong processor type | Use Form Parser processor |
