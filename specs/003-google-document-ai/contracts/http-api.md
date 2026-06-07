# HTTP API Contracts

## POST /api/documents/upload

Upload a document and process it with Document AI Form Parser.

**Auth**: Firebase Bearer JWT (via `AuthGuard`)

**Request**: `multipart/form-data`

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `file` | File | Yes | Document file (PDF, PNG, JPEG, TIFF), max 5MB |
| `companyId` | UUID | Yes | Owning company identifier |
| `ttlDays` | Integer | No | Retention days (default: 30, min: 1, max: 365) |

**Response 200**:
```json
{
  "id": "0195f1c2-...",
  "companyId": "0195f1a1-...",
  "filename": "invoice-123.pdf",
  "mimeType": "application/pdf",
  "fileSize": 245760,
  "status": "COMPLETED",
  "extractedFields": [
    { "label": "Invoice Number", "value": "INV-2026-001", "confidence": 0.98 },
    { "label": "Total Amount", "value": "$1,250.00", "confidence": 0.95 },
    { "label": "Date", "value": "2026-05-15", "confidence": 0.97 }
  ],
  "createdAt": "2026-05-30T10:00:00Z"
}
```

**Response 400** (invalid file type):
```json
{
  "statusCode": 400,
  "message": "Unsupported file type. Accepted: PDF, PNG, JPEG, TIFF",
  "error": "Bad Request"
}
```

**Response 413** (file too large):
```json
{
  "statusCode": 413,
  "message": "File size exceeds 5MB limit",
  "error": "Payload Too Large"
}
```

**Response 503** (Document AI unavailable):
```json
{
  "statusCode": 503,
  "message": "Document processing service is temporarily unavailable",
  "error": "Service Unavailable",
  "retryAfter": 30
}
```

---

## GET /api/documents

List processed documents for a company.

**Auth**: Firebase Bearer JWT (via `AuthGuard`)

**Query Parameters**:

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `companyId` | UUID | — | Required |
| `status` | Enum | all | Filter: `PENDING`, `PROCESSING`, `COMPLETED`, `FAILED` |
| `page` | Integer | 1 | Page number |
| `limit` | Integer | 20 | Items per page (max 100) |

**Response 200**:
```json
{
  "items": [
    {
      "id": "0195f1c2-...",
      "companyId": "0195f1a1-...",
      "filename": "invoice-123.pdf",
      "mimeType": "application/pdf",
      "fileSize": 245760,
      "status": "COMPLETED",
      "extractedFields": [
        { "label": "Invoice Number", "value": "INV-2026-001", "confidence": 0.98 }
      ],
      "createdAt": "2026-05-30T10:00:00Z"
    }
  ],
  "total": 42,
  "page": 1,
  "limit": 20,
  "totalPages": 3
}
```

---

## GET /api/documents/:id

Retrieve a single document's details and extraction result.

**Auth**: Firebase Bearer JWT (via `AuthGuard`)

**Response 200**: Same shape as a single item above.

**Response 404**:
```json
{
  "statusCode": 404,
  "message": "Document not found",
  "error": "Not Found"
}
```

---

## DELETE /api/documents/:id

Soft-delete a document (sets `deletedAt` timestamp).

**Auth**: Firebase Bearer JWT (via `AuthGuard`)

**Response 200**:
```json
{
  "id": "0195f1c2-...",
  "status": "DELETED",
  "deletedAt": "2026-06-01T12:00:00Z"
}
```

**Response 404**: Document not found.
