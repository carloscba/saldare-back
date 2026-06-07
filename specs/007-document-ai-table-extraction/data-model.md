# Data Model: Document AI Table Extraction

**Feature**: `007-document-ai-table-extraction`

## Entities

### DocumentTable (New — in-memory / API contract)

Represents a single table extracted from a document page.

| Field | Type | Description |
|-------|------|-------------|
| `headers` | `string[]` | Column names from table header rows, in order |
| `rows` | `string[][]` | Body row values. Each inner array represents one row. Length always matches `headers.length`. |

**Validation rules**:
- `headers` MUST be a non-empty array for a valid table
- Each row in `rows` MUST have the same length as `headers`
- All cell values MUST be strings (empty string `""` for null/missing cells)
- Empty values are represented as `""`, never `null` or `undefined`

### ExtractedFields Container (Modified)

The `extractedFields` JSON column in the `Document` model changes shape.

**Old format** (pre-007):
```json
[
  { "label": "Invoice #", "value": "123", "confidence": 0.98 },
  { "label": "table_row", "value": "Item A | 10 | 100.00", "confidence": 1 }
]
```

**New format** (post-007):
```json
{
  "tables": [
    {
      "headers": ["Item", "Quantity", "Price"],
      "rows": [
        ["Item A", "10", "100.00"],
        ["Item B", "5", "50.00"]
      ]
    }
  ]
}
```

### Document (Prisma — Existing)

No schema changes. The `extractedFields` column remains `Json?`.

### DocumentAIClient (Modified Interface)

| Method | Signature | Change |
|--------|-----------|--------|
| `processDocument` | `(fileBuffer: Buffer, mimeType: string) => Promise<{ tables: DocumentTable[]; rawResponse: unknown }>` | Return type changes from `{ extractedFields, rawResponse }` to `{ tables, rawResponse }` |

### DocumentResponseDto (Modified)

| Field | Old Type | New Type |
|-------|----------|----------|
| `extractedFields` | `ExtractedField[]?` | `{ tables: DocumentTable[] }?` |

## State Transitions

Document processing status flow (unchanged):

```
PENDING → PROCESSING → COMPLETED
                     → FAILED
```

`extractedFields` population:
- `PENDING`: `null`
- `PROCESSING`: `null`
- `COMPLETED`: `{ tables: [...] }` (new format) or `[...]` (old format, existing docs)
- `FAILED`: `null`
- `DELETED`: `null` (logically, though data remains)

## Relationships (Unchanged)

```
Company 1──N Document
Company 1──N CompanyMembership
Document 1──1 ExtractedFields (JSON column, not a separate table)
```
