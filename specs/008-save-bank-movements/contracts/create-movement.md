# API Contracts: Bank Movement CRUD

**Feature**: 008-save-bank-movements | **Date**: 2026-06-07

## Endpoint 1: Create Single Movement

```
POST /api/movements
Authorization: Bearer <firebase-id-token>
Content-Type: application/json
```

### Request Body

```typescript
{
  movementDate: string;  // ISO date "YYYY-MM-DD", required
  description: string;    // 1-255 chars, trimmed, required
  amount: number;         // Decimal number (e.g. 1500.50, -200.00), required
  category?: string;      // Optional, max 255 chars, free text
  documentId: string;     // UUID of parent document, required
}
```

### Validation Rules

| Field | Rule | Error |
|---|---|---|
| movementDate | IsDateString, IsNotEmpty | "must be a valid ISO 8601 date string" |
| movementDate | Custom: date <= today | "must not be in the future" |
| description | IsString, MinLength(1), MaxLength(255) | "must be between 1 and 255 characters" |
| amount | IsNumber, IsNotEmpty | "must be a valid number" |
| category | IsOptional, IsString, MaxLength(255) | "must not exceed 255 characters" |
| documentId | IsUUID('4'), IsNotEmpty | "must be a valid UUID" |

### Success Response (201 Created)

```typescript
{
  id: string;           // UUID
  documentId: string;   // UUID
  movementDate: string; // "YYYY-MM-DD"
  description: string;
  amount: string;       // Decimal serialized as string
  category: string | null;
  createdAt: string;    // ISO 8601
  updatedAt: string;    // ISO 8601
  deletedAt: null;
}
```

### Error Responses

| Code | Condition |
|---|---|
| 400 | Validation failure (missing fields, invalid types, future date) |
| 400 | Document is not in COMPLETED status (FR-007) |
| 401 | Missing or invalid Bearer token |
| 403 | Authenticated user is not a member of the document's company |
| 404 | documentId does not reference an existing, non-deleted Document |
