# Batch Create Movements

```
POST /api/movements/batch
Authorization: Bearer <firebase-id-token>
Content-Type: application/json
```

## Request Body

```typescript
{
  documentId: string;              // UUID - all movements belong to this document
  movements: CreateMovementItem[]; // Array of movement objects
}
```

Where CreateMovementItem:
```typescript
{
  movementDate: string;  // ISO date "YYYY-MM-DD", required
  description: string;    // 1-255 chars, trimmed, required
  amount: number;         // Decimal number, required
  category?: string;      // Optional, max 255 chars
}
```

## Validation Rules

| Rule | Constraint |
|---|---|
| Array length | 1 to 100 items (C-004 clarifies max 100) |
| Atomicity | ALL items valid and saved, or NONE saved (FR-009) |
| Per-item validation | Same rules as single create endpoint |
| documentId | Shared across all movements in the batch |
| Document status | Must be COMPLETED (FR-007) |

## Success Response (201 Created)

```typescript
MovementResponseDto[]   // Array of created movements
```

## Error Responses

| Code | Condition |
|---|---|
| 400 | Array is empty or exceeds 100 items |
| 400 | Any item fails validation (no partial save) |
| 400 | Document is not COMPLETED |
| 401 | Missing or invalid Bearer token |
| 403 | User is not a member of the document's company |
| 404 | documentId does not exist or is soft-deleted |

## Atomicity Guarantee

The entire batch is wrapped in a Prisma `$transaction`. If any individual movement fails validation (pre-check before DB insert) or any DB insert fails, the entire transaction is rolled back. No movements are persisted from a failed batch.

## Example

Request:
```json
{
  "documentId": "550e8400-e29b-41d4-a716-446655440000",
  "movements": [
    {
      "movementDate": "2026-06-01",
      "description": "Supermercado XYZ",
      "amount": -150.75,
      "category": "Groceries"
    },
    {
      "movementDate": "2026-06-01",
      "description": "Gasolina",
      "amount": -45.00,
      "category": "Transport"
    }
  ]
}
```

Response (201):
```json
[
  {
    "id": "abc-789",
    "documentId": "550e8400-e29b-41d4-a716-446655440000",
    "movementDate": "2026-06-01",
    "description": "Supermercado XYZ",
    "amount": "-150.75",
    "category": "Groceries",
    "createdAt": "2026-06-07T10:00:00.000Z",
    "updatedAt": "2026-06-07T10:00:00.000Z",
    "deletedAt": null
  },
  {
    "id": "def-012",
    "documentId": "550e8400-e29b-41d4-a716-446655440000",
    "movementDate": "2026-06-01",
    "description": "Gasolina",
    "amount": "-45.00",
    "category": "Transport",
    "createdAt": "2026-06-07T10:00:00.000Z",
    "updatedAt": "2026-06-07T10:00:00.000Z",
    "deletedAt": null
  }
]
```
