# List Movements

```
GET /api/movements?documentId=<uuid>&page=1&limit=20
Authorization: Bearer <firebase-id-token>
```

## Query Parameters

| Param | Type | Required | Default | Constraints |
|---|---|---|---|---|
| documentId | UUID string | Yes | - | Must reference existing Document |
| page | integer | No | 1 | Min 1 |
| limit | integer | No | 20 | Min 1, Max 100 |

## Success Response (200 OK)

```typescript
{
  items: MovementResponseDto[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}
```

Where MovementResponseDto:
```typescript
{
  id: string;
  documentId: string;
  movementDate: string;  // "YYYY-MM-DD"
  description: string;
  amount: string;        // Decimal as string
  category: string | null;
  createdAt: string;     // ISO 8601
  updatedAt: string;     // ISO 8601
  deletedAt: null;
}
```

## Sorting

Movements are sorted by `movementDate` descending (most recent first).

## Error Responses

| Code | Condition |
|---|---|
| 400 | Invalid query params (non-uuid documentId, page < 1, limit > 100) |
| 401 | Missing or invalid Bearer token |
| 403 | User is not a member of the document's company |
| 404 | documentId does not reference an existing, non-deleted Document |

## Example

Request: `GET /api/movements?documentId=550e8400-e29b-41d4-a716-446655440000&page=1&limit=2`

Response:
```json
{
  "items": [
    {
      "id": "abc-123",
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
      "id": "def-456",
      "documentId": "550e8400-e29b-41d4-a716-446655440000",
      "movementDate": "2026-05-28",
      "description": "Deposito nomina",
      "amount": "3500.00",
      "category": "Income",
      "createdAt": "2026-06-07T10:00:00.000Z",
      "updatedAt": "2026-06-07T10:00:00.000Z",
      "deletedAt": null
    }
  ],
  "total": 50,
  "page": 1,
  "limit": 2,
  "totalPages": 25
}
```
