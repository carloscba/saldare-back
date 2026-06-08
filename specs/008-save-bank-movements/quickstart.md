# Quickstart: Bank Movement CRUD

**Feature**: 008-save-bank-movements | **Date**: 2026-06-07

## Prerequisites

- Running NestJS backend (Cloud Run or local via `npm run start:dev`)
- PostgreSQL database with the current schema applied (`npx prisma migrate deploy`)
- Firebase Authentication configured (a valid Firebase ID token for testing)

## Step 1: Apply Database Migration

After the Prisma schema is updated with the `Movement` model:

```bash
npx prisma migrate dev --name add-movement-table
```

This creates the `Movement` table with all fields and indexes.

## Step 2: Verify the Module is Loaded

The `MovementsModule` is imported in `AppModule`. Start the server:

```bash
npm run start:dev
```

The server listens on port 3001 (or `PORT` env var).

## Step 3: Create a Movement

**Precondition**: You need a document that is `COMPLETED` and belongs to a company you are a member of.

```bash
curl -X POST http://localhost:3001/api/movements \
  -H "Authorization: Bearer <firebase-id-token>" \
  -H "Content-Type: application/json" \
  -d '{
    "movementDate": "2026-06-01",
    "description": "Supermercado XYZ",
    "amount": -150.75,
    "category": "Groceries",
    "documentId": "<document-uuid>"
  }'
```

Expected: HTTP 201 with the created movement object including its `id`.

## Step 4: List Movements for a Document

```bash
curl "http://localhost:3001/api/movements?documentId=<document-uuid>&page=1&limit=20" \
  -H "Authorization: Bearer <firebase-id-token>"
```

Expected: HTTP 200 with paginated response: `{ items: [...], total, page, limit, totalPages }`.

## Step 5: Batch Create Movements

```bash
curl -X POST http://localhost:3001/api/movements/batch \
  -H "Authorization: Bearer <firebase-id-token>" \
  -H "Content-Type: application/json" \
  -d '{
    "documentId": "<document-uuid>",
    "movements": [
      { "movementDate": "2026-06-01", "description": "Compra A", "amount": -50.00, "category": "Shopping" },
      { "movementDate": "2026-06-02", "description": "Compra B", "amount": -30.00, "category": "Food" }
    ]
  }'
```

Expected: HTTP 201 with array of 2 created movement objects.

## Common Error Scenarios

| Action | Expected |
|---|---|
| No auth header | 401 Unauthorized |
| Expired/invalid token | 401 Unauthorized |
| Not a company member | 403 Forbidden |
| Document not found | 404 Not Found |
| Document is soft-deleted | 404 Not Found |
| Document not COMPLETED | 400 Bad Request |
| Future movementDate | 400 Bad Request |
| Empty/missing description | 400 Bad Request |
| Batch with >100 items | 400 Bad Request |
| Batch with invalid item | 400 Bad Request (no partial save) |

## Local Development Shortcut

If `AUTH_BYPASS_TOKEN` is set in your `.env`, you can use it as the Bearer token to skip Firebase verification:

```bash
curl -X POST http://localhost:3001/api/movements \
  -H "Authorization: Bearer $AUTH_BYPASS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{...}'
```
