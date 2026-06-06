# Feature Specification: Google Document AI Integration

**Feature Branch**: `003-google-document-ai`

**Created**: 2026-05-30

**Status**: Draft

**Input**: User description: "Configure backend to use Google Document AI services — upload files and process them with Document AI for document parsing and extraction."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Upload a Document for Processing (Priority: P1)

As an API client, I want to upload a document file and have it processed by Google Document AI, so that structured data is extracted from the document automatically.

**Why this priority**: This is the core value proposition — the primary interaction that delivers the feature's purpose.

**Independent Test**: Can be fully tested by sending a POST request with a sample PDF document to the upload endpoint and verifying a 200 response with extracted document data.

**Acceptance Scenarios**:

1. **Given** a valid PDF document file, **When** I POST it to `/api/documents/upload`, **Then** the system returns a 200 response with the extracted structured data (entities, text, tables).
2. **Given** a corrupted or non-document file, **When** I POST it to `/api/documents/upload`, **Then** the system returns a 400 error with a meaningful error message.
3. **Given** the Google Document AI service is unavailable, **When** I POST a document, **Then** the system returns a 503 error with a retry-after hint.

---

### User Story 2 - List and Retrieve Processed Documents (Priority: P2)

As an API client, I want to list previously processed documents and retrieve their extraction results, so that I can review or reuse past extractions without re-uploading.

**Why this priority**: Adds persistence and auditability, useful for workflows that need to reference past results.

**Independent Test**: Can be tested by uploading a document, then requesting the document list and retrieval endpoints to confirm the processed data is accessible.

**Acceptance Scenarios**:

1. **Given** one or more previously uploaded documents, **When** I GET `/api/documents`, **Then** the system returns a paginated list of document metadata (id, filename, status, created_at).
2. **Given** a specific document ID, **When** I GET `/api/documents/:id`, **Then** the system returns the full extraction result for that document.
3. **Given** a document that failed processing, **When** I GET `/api/documents/:id`, **Then** the response includes the error details.

---

### User Story 3 - Delete a Document (Priority: P3)

As an API client, I want to delete a previously uploaded document and its extraction data, so that I can manage storage and remove sensitive information.

**Why this priority**: Important for data privacy compliance but not part of the core document processing flow.

**Independent Test**: Can be tested by uploading and then deleting a document, confirming it no longer appears in the document list.

**Acceptance Scenarios**:

1. **Given** an existing processed document, **When** I DELETE `/api/documents/:id`, **Then** the system returns a 200 and the document is no longer retrievable.
2. **Given** a non-existent document ID, **When** I DELETE `/api/documents/:id`, **Then** the system returns a 404 error.

---

### Edge Cases

- What happens when the uploaded file exceeds the maximum allowed size (> 5MB)?
- How does the system handle unsupported file formats (e.g., .exe, .zip instead of PDF/PNG/JPEG/TIFF)?
- How does the system handle concurrent uploads hitting Document AI rate limits?
- What happens if the Google Cloud service account is misconfigured or credentials expire?
- How does the system handle Document AI processor version updates or deprecation?

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST authenticate with Google Cloud using a service account and enable the Document AI API.
- **FR-002**: System MUST provide a POST `/api/documents/upload` endpoint accepting multipart file uploads.
- **FR-003**: System MUST validate uploaded files for supported MIME types (PDF, PNG, JPEG, TIFF) and reject unsupported formats with a 400 error.
- **FR-004**: System MUST send the uploaded document to Google Document AI for processing using a configured processor.
- **FR-005**: System MUST store the raw Document AI response (entities, text, layout) in a persistent data store.
- **FR-006**: System MUST return the extracted structured data in the upload response.
- **FR-007**: System MUST provide a GET `/api/documents` endpoint returning a paginated list of processed documents.
- **FR-008**: System MUST provide a GET `/api/documents/:id` endpoint returning the full extraction result for a specific document.
- **FR-009**: System MUST provide a DELETE `/api/documents/:id` endpoint to remove a document and its extraction data.
- **FR-010**: System MUST enforce a maximum file size limit of 5 MB.
- **FR-011**: System MUST log all Document AI API calls and errors for observability.
- **FR-012**: System MUST configure Document AI processor via environment variables (processor ID, location, project ID).

### Key Entities *(include if feature involves data)*

- **Document**: Represents an uploaded file with metadata (id, filename, mime_type, size, status, created_at). Contains the extracted Document AI response data.
- **ExtractionResult**: The structured output from Document AI (entities, text blocks, tables, pages). Associated 1:1 with a Document.
- **DocumentAIConfig**: Configuration entity holding Google Cloud project ID, processor ID, processor location, and service account credentials.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A valid PDF document can be uploaded and fully processed in under 10 seconds (excluding Document AI processing time).
- **SC-002**: The system correctly rejects unsupported file formats with a descriptive error message.
- **SC-003**: Extraction results for a previously processed document can be retrieved within 1 second.
- **SC-004**: The system handles up to 10 concurrent document uploads without errors or data loss.

## Assumptions

- The backend will run on Node.js/NestJS (based on existing project conventions).
- Google Cloud service account credentials will be provided via a JSON key file referenced by the `GOOGLE_APPLICATION_CREDENTIALS` environment variable.
- The Document AI processor (e.g., "General OCR" or "Invoice Parser") is pre-created in the Google Cloud Console — the feature only configures the API integration.
- Uploaded files are stored temporarily in memory or on local disk; production deployments should use cloud storage (GCS).
- The Document AI processor type will be **Form Parser** — extracting key-value pairs and fields from structured forms.
- Processed documents should be retained with a configurable TTL (time-to-live). Default retention period is 30 days, after which both the uploaded file and extraction result are auto-deleted.

## Clarifications

### Q1: Upload Processing Mode
**Question**: Should processing be synchronous or asynchronous?
**Decision**: Synchronous. The POST `/api/documents/upload` endpoint blocks until Document AI returns the extraction result. Appropriate for files ≤5MB with Form Parser (typical processing <30s).

### Q2: API Authentication Method
**Question**: How should API clients authenticate?
**Decision**: API Key. Clients pass an API key in the `Authorization: Bearer <key>` header. Keys are stored hashed in the database, one per client service. Sufficient for backend-to-backend document processing.

### Q3: File Storage Strategy
**Question**: Where should uploaded files be stored before and after processing?
**Decision**: Local disk + temp. Files are written to a temp directory on local disk during processing, then the raw file is discarded after Document AI returns. Only the extraction result is persisted in the database. Simplest for MVP; can migrate to GCS later.

### Q4: Document AI Processor Region
**Question**: Which GCP region should the Document AI processor use?
**Decision**: `us-central1`. Configured via `DOCUMENT_AI_PROCESSOR_LOCATION` env var. Default recommended for US-based backends; changeable if data residency requirements arise.

### Q5: Document AI Retry Strategy
**Question**: How should transient Document AI failures be handled?
**Decision**: Fail fast, no retry. On any Document AI error (429, 500, 503, timeout), the system returns a 503 directly to the client with the error details. Simpler implementation and avoids long request hangs; client is responsible for retrying if needed.
