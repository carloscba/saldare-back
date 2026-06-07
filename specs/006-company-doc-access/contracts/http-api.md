# API Contracts: Control de Acceso a Documentos por Compañía

**Feature**: `006-company-doc-access`
**Date**: 2026-06-06

---

## 1. GET /api/companies

List companies the authenticated user is an active member of.

### Request

```
GET /api/companies
Authorization: Bearer <firebase-id-token>
```

No query parameters. No request body.

### Response

**200 OK** — User has one or more company memberships:

```json
{
  "companies": [
    {
      "id": "550e8400-e29b-41d4-a716-446655440000",
      "name": "Acme Corp",
      "createdAt": "2026-06-01T10:00:00.000Z"
    },
    {
      "id": "660e8400-e29b-41d4-a716-446655440001",
      "name": "Globex Inc",
      "createdAt": "2026-06-02T14:30:00.000Z"
    }
  ]
}
```

**200 OK** — User has no company memberships:

```json
{
  "companies": []
}
```

**401 Unauthorized** — Missing or invalid Firebase token:

```json
{
  "statusCode": 401,
  "message": "Invalid or expired Firebase token"
}
```

### Behavior

- Active membership: `CompanyMembership.deletedAt IS NULL`
- No pagination needed (expected < 50 companies per user)
- Companies ordered by `name` ASC
- No `companyId` filtering — returns all user's companies

---

## 2. GET /api/documents (Modified)

List documents for a company. **New behavior**: membership check before returning results.

### Request

```
GET /api/documents?companyId=<uuid>&status=COMPLETED&page=1&limit=20
Authorization: Bearer <firebase-id-token>
```

| Query Param | Type | Required | Default | Description |
|-------------|------|----------|---------|-------------|
| `companyId` | UUID | **Yes** | — | Company to list documents for |
| `status` | string | No | — | Filter by DocumentStatus (PENDING, PROCESSING, COMPLETED, FAILED, DELETED) |
| `page` | integer | No | 1 | Page number (min 1) |
| `limit` | integer | No | 20 | Items per page (min 1, max 100) |

### Response

**200 OK** — User is a member of the company:

```json
{
  "items": [
    {
      "id": "doc-uuid-1",
      "companyId": "550e8400-e29b-41d4-a716-446655440000",
      "filename": "invoice-march.pdf",
      "mimeType": "application/pdf",
      "fileSize": 245760,
      "status": "COMPLETED",
      "extractedFields": [
        { "label": "invoice_number", "value": "INV-001", "confidence": 0.98 },
        { "label": "total_amount", "value": "$1,250.00", "confidence": 0.95 }
      ],
      "errorMessage": null,
      "createdAt": "2026-06-05T08:00:00.000Z",
      "updatedAt": "2026-06-05T08:01:00.000Z",
      "deletedAt": null
    }
  ],
  "total": 42,
  "page": 1,
  "limit": 20,
  "totalPages": 3
}
```

**403 Forbidden** — Authenticated user is not a member of the requested company:

```json
{
  "statusCode": 403,
  "message": "You do not have access to this company's documents"
}
```

**404 Not Found** — Company does not exist:

```json
{
  "statusCode": 404,
  "message": "Company not found"
}
```

**401 Unauthorized** — Missing or invalid Firebase token:

```json
{
  "statusCode": 401,
  "message": "Invalid or expired Firebase token"
}
```

### Behavior Changes from Current

| Aspect | Before | After |
|--------|--------|-------|
| `companyId` param | Validated for existence | Validated for existence **+ membership** |
| 403 response | Never returned | Returned when user is not a member |
| Query | Direct `prisma.document.findMany` | Preceded by membership verification |

---

## 3. GET /api/documents/:id (Modified)

Get a single document by ID. **New behavior**: resolves company from document, checks membership.

### Request

```
GET /api/documents/<document-uuid>
Authorization: Bearer <firebase-id-token>
```

No query parameters.

### Response

**200 OK** — Document exists and user is a member of its company:

```json
{
  "id": "doc-uuid-1",
  "companyId": "550e8400-e29b-41d4-a716-446655440000",
  "filename": "invoice-march.pdf",
  "mimeType": "application/pdf",
  "fileSize": 245760,
  "status": "COMPLETED",
  "extractedFields": [
    { "label": "invoice_number", "value": "INV-001", "confidence": 0.98 }
  ],
  "errorMessage": null,
  "createdAt": "2026-06-05T08:00:00.000Z",
  "updatedAt": "2026-06-05T08:01:00.000Z",
  "deletedAt": null
}
```

**404 Not Found** — Document does not exist, is soft-deleted, OR user is not a member of the document's company:

```json
{
  "statusCode": 404,
  "message": "Document not found"
}
```

**401 Unauthorized** — Missing or invalid Firebase token:

```json
{
  "statusCode": 401,
  "message": "Invalid or expired Firebase token"
}
```

### Behavior Changes from Current

| Aspect | Before | After |
|--------|--------|-------|
| Lookup | `prisma.document.findUnique({ id })` | Fetch document → get `companyId` → check membership → return or 404 |
| 404 cases | Document not found, soft-deleted | Same + user not member of document's company |
| Performance | 1 query | 2 queries (document fetch + membership check) |

---

## 4. POST /api/documents/upload (Modified)

Upload a document to a company. **New behavior**: membership check before upload.

### Request

```
POST /api/documents/upload
Authorization: Bearer <firebase-id-token>
Content-Type: multipart/form-data
```

| Form Field | Type | Required | Description |
|------------|------|----------|-------------|
| `file` | file | **Yes** | Document file (PDF, PNG, JPEG, TIFF, max 5MB) |
| `companyId` | string (UUID) | **Yes** | Target company |
| `ttlDays` | integer | No | Time-to-live in days (default 30) |

### Response

**201 Created** — Upload successful and user is a member:

```json
{
  "id": "doc-uuid-2",
  "companyId": "550e8400-e29b-41d4-a716-446655440000",
  "filename": "receipt-q2.pdf",
  "mimeType": "application/pdf",
  "fileSize": 102400,
  "status": "PENDING",
  "extractedFields": null,
  "errorMessage": null,
  "createdAt": "2026-06-06T12:00:00.000Z",
  "updatedAt": "2026-06-06T12:00:00.000Z",
  "deletedAt": null
}
```

**403 Forbidden** — Authenticated user is not a member of the target company:

```json
{
  "statusCode": 403,
  "message": "You do not have access to upload documents to this company"
}
```

**404 Not Found** — Company does not exist:

```json
{
  "statusCode": 404,
  "message": "Company not found"
}
```

**400 Bad Request** — Invalid file type, file too large, or missing fields:

```json
{
  "statusCode": 400,
  "message": "Validation failed"
}
```

**401 Unauthorized** — Missing or invalid Firebase token:

```json
{
  "statusCode": 401,
  "message": "Invalid or expired Firebase token"
}
```

### Behavior Changes from Current

| Aspect | Before | After |
|--------|--------|-------|
| `companyId` validation | Only existence check | Existence **+ membership** check |
| Upload flow | company check → upload → process | membership check → company check → upload → process |

---

## 5. DELETE /api/documents/:id (Modified)

Soft-delete a document. **New behavior**: resolves company from document, checks membership.

### Request

```
DELETE /api/documents/<document-uuid>
Authorization: Bearer <firebase-id-token>
```

No request body.

### Response

**200 OK** — Document soft-deleted. Response shape identical to GET /api/documents/:id with `status: "DELETED"` and `deletedAt` set.

**404 Not Found** — Document does not exist, is already soft-deleted, OR user is not a member of the document's company:

```json
{
  "statusCode": 404,
  "message": "Document not found"
}
```

**401 Unauthorized** — Missing or invalid Firebase token:

```json
{
  "statusCode": 401,
  "message": "Invalid or expired Firebase token"
}
```

### Behavior Changes from Current

| Aspect | Before | After |
|--------|--------|-------|
| Authorization | None beyond auth | Membership verification via document's companyId |
| 404 cases | Document not found, soft-deleted | Same + user not member of document's company |

---

## Common Error Responses

All endpoints may return:

**500 Internal Server Error** — Unexpected server error:

```json
{
  "statusCode": 500,
  "message": "Internal server error"
}
```

**503 Service Unavailable** — Document AI processing failure (upload endpoint only):

```json
{
  "statusCode": 503,
  "message": "Document processing service is temporarily unavailable",
  "retryAfter": 30
}
```
