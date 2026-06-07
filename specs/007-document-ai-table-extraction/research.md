# Research: Document AI Table Extraction Refactoring

**Feature**: `007-document-ai-table-extraction`
**Date**: 2026-06-06

## R1: Document AI Form Parser Table Response Structure

**Decision**: Use the existing `document.pages[].tables[]` structure from `@google-cloud/documentai` v9.x. Each table has `headerRows` and `bodyRows`, each row has `cells[]`, and each cell exposes `layout.textAnchor.content` for the text value.

**Rationale**: The current provider already accesses this structure (lines 67-84 of `document-ai-client.provider.ts`). The refactoring reuses the same API response field — only the parsing and shaping logic changes.

**Alternatives considered**:
- Using `textAnchor.textSegments` — More complex, requires segment concatenation, unnecessary for Form Parser table extraction.
- Switching to a different processor type (e.g., Layout Parser) — Out of scope; Form Parser is the constitution-mandated processor.

## R2: NestJS FactoryProvider with Config Injection

**Decision**: Refactor the factory from a closure-based `useFactory` to use the `inject` array to receive the `ConfigType<typeof documentAiConfig>` token. This makes the factory testable without `process.env`.

**How**: A `FactoryProvider` in NestJS supports an `inject` property:
```typescript
export const DocumentAiClientFactory: FactoryProvider<DocumentAIClient> = {
  provide: 'DOCUMENT_AI_CLIENT',
  inject: [documentAiConfig.KEY],
  useFactory: (config: ConfigType<typeof documentAiConfig>) => {
    // Use config.projectId, config.processorId, config.processorLocation
    // instead of process.env
  },
};
```

**Rationale**: The config already exists as a `registerAs('documentAi', ...)` namespace injected into `DocumentsService` (line 23-24 of `documents.service.ts`) and registered in `DocumentsModule` via `ConfigModule.forFeature(documentAiConfig)`. Injecting it into the factory is a one-line change to the provider definition.

**Alternatives considered**:
- Inject `ConfigService` directly — Possible but less type-safe. The typed config token (`documentAiConfig.KEY`) provides compile-time checks.
- Keep `process.env` — Rejected; violates P3 (testability) requirement.

## R3: Response DTO Shape Change

**Decision**: The `DocumentResponseDto.extractedFields` property changes type from `ExtractedField[]` to `{ tables: DocumentTable[] }`. The `DocumentTable` interface is new:

```typescript
interface DocumentTable {
  headers: string[];
  rows: string[][];
}
```

The `toResponseDto` method in `DocumentsService` detects old vs new format via `Array.isArray(doc.extractedFields)`.

**Rationale**: Per Q2/Q3 decisions: response shape is `{ tables: [...] }` under the existing `extractedFields` property, and old format is detected at read time.

**Alternatives considered**:
- New top-level `tables` property — Rejected (Q2). Would complicate the DTO and require coordinated frontend changes.
- Separate `extractedTables` DB column — Rejected (Q3). Unnecessary schema change for a format migration that can be handled in application logic.

## R4: Table Header/Row Normalization

**Decision**: For each table, extract headers from `headerRows[].cells[]` as flat strings and body rows from `bodyRows[].cells[]`. Pad rows with fewer columns than headers with empty strings; drop extra columns.

```typescript
// Pseudocode
const headers = headerRows.flatMap(row =>
  row.cells.map(cell => cell.layout?.textAnchor?.content ?? '')
);
const rows = bodyRows.map(row => {
  const values = row.cells.map(cell => cell.layout?.textAnchor?.content ?? '');
  while (values.length < headers.length) values.push('');
  return values.slice(0, headers.length);
});
```

**Rationale**: Per Q5, all rows in a table must have the same length as headers. Document AI's Form Parser may return irregular column counts for merged cells or OCR errors.

**Alternatives considered**:
- Preserve raw column counts — Rejected (Q5). Consumers need predictable array shapes.
- Skip rows with mismatched lengths — Too aggressive; would lose data for minor OCR artifacts.

## R5: Multi-Page Handling

**Decision**: Iterate over `document.pages[]`, extract tables from each page independently, and append them to a single flat `tables` array. No page index is included in the output.

**Rationale**: Per Q4, tables are kept separate per page. Since Document AI does not guarantee that a logical table spanning pages is marked as connected, keeping them separate is the safest approach. Each page's tables are independent entries.

**Alternatives considered**:
- Concatenate all tables into one — Rejected (Q4). Would lose multi-page context.
- Include page metadata — Could be added later if needed; out of scope for MVP.

## R6: Old Format Detection Strategy

**Decision**: In `DocumentResponseDto.toResponseDto()`, check if `doc.extractedFields` is an array. If array → old format, return `{ tables: [] }`. If object with `tables` → new format, return as-is.

```typescript
if (Array.isArray(doc.extractedFields)) {
  return { tables: [] };
}
return doc.extractedFields;
```

**Rationale**: Per Q3, no DB migration. Detection at read time is cheap (O(1) check) and preserves all existing data. Old documents remain accessible with empty table data.

**Alternatives considered**:
- Migration script — Rejected. Adds operational overhead for a read-time solvable problem.
- 410 Gone for old docs — Rejected. Unnecessarily breaks existing API consumers.
