# Feature Specification: Document AI Table Extraction Refactoring

**Feature Branch**: `007-document-ai-table-extraction`

**Created**: 2026-06-06

**Status**: Draft

**Input**: "Refactor DocumentAiClientFactory to extract table data from Form Parser instead of key-value pairs. The relevant information for our project is in Table, not in Key value pair or entity."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Extract Structured Table Data from Documents (Priority: P1)

As an API client, I want tables extracted from uploaded documents to be returned as structured data (with headers and rows preserved), so that I can directly consume tabular information without having to parse flattened label-value strings.

**Why this priority**: This is the core change — the project's primary data lives in tables within the documents, and the current implementation flattens that data into unparseable label-value pairs, rendering it unusable.

**Independent Test**: Upload a document containing a table, verify the response includes a `tables` array where each table has a `headers` array and a `rows` array of string arrays, with columns preserved in order.

**Acceptance Scenarios**:

1. **Given** a PDF document with a table of 3 columns and 2 rows, **When** I POST it to the upload endpoint, **Then** the response includes extracted data with a `tables` array containing one table with 3 headers and 2 rows of 3 values each.
2. **Given** a PDF document with no tables, **When** I upload it, **Then** the response includes an empty `tables` array and the document is still processed successfully.
3. **Given** a PDF document with multiple tables, **When** I upload it, **Then** the response includes all tables as separate entries in the `tables` array, each preserving its own headers.

---

### User Story 2 - Retrieve Documents with Structured Table Data (Priority: P2)

As an API client, I want to retrieve a previously processed document and get structured table data, so that I can query historical documents and consistently consume tabular data without parsing flat label-value strings.

**Why this priority**: Consumers of the GET endpoint (dashboard, reports) need to render tables in a predictable structured format. The current flat merged structure forces clients to reconstruct table data from flattened strings.

**Independent Test**: Upload a document with tables, then retrieve it via GET `/api/documents/:id` and confirm the `extractedFields` response property is an object with a `tables` array containing structured headers and rows.

**Acceptance Scenarios**:

1. **Given** a previously uploaded document with extracted tables, **When** I GET `/api/documents/:id`, **Then** the `extractedFields` response property contains `{ tables: [...] }` with structured headers and rows.
2. **Given** a document that failed processing, **When** I GET `/api/documents/:id`, **Then** `tables` is null or absent, and `status` is `FAILED`.

---

### User Story 3 - Factory Uses Proper Configuration Injection (Priority: P3)

As a developer, I want the DocumentAiClientFactory to receive its configuration (project ID, processor ID, location) through NestJS dependency injection rather than reading `process.env` directly, so that the factory is testable, the config is centralized, and environment changes don't require code changes.

**Why this priority**: While important for maintainability and testability, this is an internal refactoring that doesn't change user-facing behavior.

**Independent Test**: Mock the NestJS config in a unit test and verify the factory reads config values from the injected config object rather than `process.env`.

**Acceptance Scenarios**:

1. **Given** the NestJS config has `documentAi.projectId = "test-project"`, **When** the factory creates a client and processes a document, **Then** the Document AI API request targets `projects/test-project/...` without reading `process.env.DOCUMENT_AI_PROJECT_ID`.
2. **Given** a unit test with a mocked config, **When** the factory is instantiated, **Then** it uses the mock values without requiring real environment variables.

---

### Edge Cases

- What happens when Document AI returns a table with header rows but no body rows? → Table is included with headers and empty `rows` array.
- What happens when a table has merged cells or irregular column counts across rows? → Rows are padded/dropped to match header count (see Q5).
- How does the system handle documents with zero tables (document has no tabular content)? → Returns empty `{ tables: [] }`.
- What happens when the Document AI response contains empty cells (null or undefined content)? → Empty cells are stored as empty strings `""`.
- How does the system handle backward compatibility with existing documents that have the old flattened `extractedFields` format? → Read-time detection. Old array-format documents return `{ tables: [] }`. No DB migration.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST extract table headers and rows from the Document AI Form Parser response as structured arrays, preserving column order.
- **FR-002**: System MUST return extracted tables in a dedicated `tables` property.
- **FR-003**: Each extracted table MUST include a `headers` array of strings and a `rows` array of string arrays (each inner array representing one row of values).
- **FR-004**: System MUST NOT extract key-value form fields or entities — only table data is extracted from the Document AI response.
- **FR-005**: System MUST use NestJS configuration injection instead of reading `process.env` directly in the factory provider.
- **FR-006**: System MUST handle documents that contain tables or have no tables without crashing — returning an empty `tables` array when no tables are found.
- **FR-007**: System MUST persist extracted tables as structured JSON in the `extractedFields` database column with shape `{ tables: [...] }`.
- **FR-008**: System MUST return the `{ tables: [...] }` object under the `extractedFields` response property in both the upload response (POST) and the document retrieval response (GET).

### Key Entities

- **DocumentTable**: Represents a single table extracted from a document. Contains `headers` (column names as string array) and `rows` (array of string arrays, each inner array representing one row of cell values). Cell-level confidence scores are not preserved — only extracted text content is stored.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A document containing at least one table returns structured table data with all columns and rows correctly identified and ordered within 15 seconds of upload.
- **SC-002**: 100% of extracted tables preserve column-to-value alignment (cell at position N in a row maps to header at position N).
- **SC-003**: The factory provider can be instantiated in a unit test with mocked configuration (no real environment variables needed) — verified by test passing.
- **SC-004**: Existing documents with the old flattened `extractedFields` format remain retrievable without errors.

## Clarifications

### Q1: Key-Value Extraction Scope
**Question**: Should the refactored factory keep key-value/entity extraction alongside table extraction, or extract only tables?
**Decision**: Remove key-value and entity extraction entirely. Only table data is relevant to the project. Fields and entities are out of scope.

### Q2: Response DTO Structure
**Question**: How should the new structured table data be exposed in the API response?
**Decision**: Replace the existing `extractedFields` response property. It changes from a flat array to an object: `{ tables: [...] }`. No new top-level property is added.

### Q3: Old Document Migration
**Question**: How should existing documents with the old flat `extractedFields` array format be handled during retrieval?
**Decision**: No database migration. The API detects old format (array) vs new format (object with `tables`) at read time. Old documents return `{ tables: [] }` or `null`.

### Q4: Multi-Page Table Handling
**Question**: When Document AI returns tables distributed across multiple pages, should they be merged or kept separate?
**Decision**: Keep tables separate per page. Each page's tables are individual entries in the `tables` array. Page boundaries are preserved.

### Q5: Irregular Cell Handling
**Question**: How should the system handle tables with merged cells or rows with column counts that don't match the header?
**Decision**: Pad rows with empty strings to match header column count. Extra columns beyond header count are dropped. All rows in a table always have the same length as `headers`.

## Assumptions

- Google Document AI Form Parser processor type is already configured and operational in the Google Cloud project.
- The Form Parser response structure (`document.pages[].tables[]` with `headerRows` and `bodyRows`) matches the `@google-cloud/documentai` v9.x API format.
- The `extractedFields` JSON column in the database can store the new structured format without a schema migration (JSONB column supports arbitrary shapes).
- Cell content is plain text; merged cells will be handled by repeating the value or marking as empty as an edge case.
- The existing `DocumentAIClient` TypeScript interface and `ExtractedField` interface will be extended, not replaced, to maintain type compatibility where possible.
