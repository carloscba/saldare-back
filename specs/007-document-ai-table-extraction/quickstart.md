# Quickstart: Document AI Table Extraction

**Feature**: `007-document-ai-table-extraction`

## Verify the Feature Works

1. **Start the backend** with GCP credentials configured:
   ```bash
   npm run start:dev
   ```

2. **Upload a PDF with tables**:
   ```bash
   curl -X POST http://localhost:8080/api/documents/upload \
     -H "Authorization: Bearer <FIREBASE_TOKEN>" \
     -F "file=@test-files/invoice-with-table.pdf" \
     -F "companyId=<COMPANY_UUID>"
   ```

3. **Verify structured table response**:
   - Response `extractedFields` is an object (not an array)
   - `extractedFields.tables` is an array of `{ headers: [...], rows: [[...], ...] }`
   - Each row in a table has exactly `headers.length` columns
   - Empty cells are `""` strings

4. **Upload a document with no tables**:
   - Response `extractedFields.tables` is an empty array `[]`
   - Upload succeeds without error

5. **Retrieve an old document** (pre-007):
   - Response `extractedFields` is `{ tables: [] }` (old flat format detected)
   - No 500 error, document is retrievable

## Key Files Changed

| File | Change |
|------|--------|
| `src/documents/providers/document-ai-client.provider.ts` | Refactor: inject config, extract only tables, return `{ tables, rawResponse }` |
| `src/documents/dto/document-ai-client.type.ts` | Update `DocumentAIClient` return type: `tables` instead of `extractedFields` |
| `src/documents/dto/document-response.dto.ts` | Change `extractedFields` type to `ExtractedData` |
| `src/documents/documents.service.ts` | Update `toResponseDto()` for old format detection |
| `tests/unit/documents.service.spec.ts` | Update mock data to new format |

## Run Tests

```bash
# Unit tests
npm run test -- tests/unit/documents.service.spec.ts

# E2E tests
npm run test:e2e -- tests/e2e/documents.controller.spec.ts
```

## Configuration

No new environment variables. Existing `DOCUMENT_AI_*` variables continue to work:

```
DOCUMENT_AI_PROJECT_ID=my-project
DOCUMENT_AI_PROCESSOR_ID=abc123
DOCUMENT_AI_PROCESSOR_LOCATION=us
```
