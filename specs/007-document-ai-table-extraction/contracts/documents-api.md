# API Contracts: Document AI Table Extraction

**Feature**: `007-document-ai-table-extraction`

## Endpoints Affected

### POST `/api/documents/upload`

**No change to request contract.** Same multipart form upload.

**Response changed** — `extractedFields` shape:

```json
{
  "id": "uuid",
  "companyId": "uuid",
  "filename": "invoice.pdf",
  "mimeType": "application/pdf",
  "fileSize": 12345,
  "status": "COMPLETED",
  "extractedFields": {
    "tables": [
      {
        "headers": ["Item", "Quantity", "Price"],
        "rows": [
          ["Widget A", "10", "$100.00"],
          ["Widget B", "5", "$50.00"]
        ]
      }
    ]
  },
  "createdAt": "2026-06-06T00:00:00.000Z",
  "updatedAt": "2026-06-06T00:00:01.000Z"
}
```

**Before (old format)**:
```json
{
  "extractedFields": [
    { "label": "Invoice #", "value": "123", "confidence": 0.98 }
  ]
}
```

**After (new format)**:
```json
{
  "extractedFields": {
    "tables": [
      {
        "headers": ["Item", "Quantity", "Price"],
        "rows": [["Widget A", "10", "$100.00"]]
      }
    ]
  }
}
```

**Empty tables case**:
```json
{
  "extractedFields": {
    "tables": []
  }
}
```

**Processing failed**:
```json
{
  "extractedFields": null,
  "status": "FAILED",
  "errorMessage": "Document processing service is temporarily unavailable"
}
```

### GET `/api/documents`

**No change to request contract.**

**Response**: Each document in the `items` array follows the same `extractedFields` shape as above.

### GET `/api/documents/:id`

**No change to request contract.**

**Response**: Same `extractedFields` shape as POST upload.

**Old document (flat array format)**:
```json
{
  "extractedFields": {
    "tables": []
  }
}
```
Old flat-array documents return empty tables. No data loss; old content is simply not exposed in the new format.

### DELETE `/api/documents/:id`

**No change.** Request/response unchanged.

## TypeScript Interface Contracts

### DocumentTable

```typescript
export interface DocumentTable {
  headers: string[];
  rows: string[][];
}
```

### ExtractedData (new container)

```typescript
export interface ExtractedData {
  tables: DocumentTable[];
}
```

### DocumentAIClient (updated)

```typescript
export interface DocumentAIClient {
  processDocument(
    fileBuffer: Buffer,
    mimeType: string,
  ): Promise<{
    tables: DocumentTable[];
    rawResponse: unknown;
  }>;
}
```

### DocumentResponseDto (updated)

```typescript
export class DocumentResponseDto {
  id: string;
  companyId: string;
  filename: string;
  mimeType: string;
  fileSize: number;
  status: string;
  extractedFields?: ExtractedData;
  errorMessage?: string;
  createdAt: Date;
  updatedAt: Date;
  deletedAt?: Date;
}
```

## Backward Compatibility

Old documents with `extractedFields` as a flat array are handled at read time:

```typescript
// In toResponseDto()
const fields = doc.extractedFields;
if (Array.isArray(fields)) {
  return { ...rest, extractedFields: { tables: [] } };
}
return { ...rest, extractedFields: fields as ExtractedData };
```
