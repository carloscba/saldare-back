# Research: Google Document AI Integration

## Unknowns & Decisions

### 1. Node.js Document AI Client Library
- **Decision**: Use `@google-cloud/documentai` npm package (v8.x).
- **Rationale**: Official Google Cloud client library for Node.js with NestJS-compatible dependency injection. Provides `DocumentAIServiceClient` with typed methods for `processDocument()`.
- **Alternatives**: Direct REST API calls via `fetch/axios` — more control but no type safety, retries, or auth convenience.

### 2. File Upload Handling in NestJS
- **Decision**: Use `multer` via NestJS's built-in `FileInterceptor` with `diskStorage` engine.
- **Rationale**: Multer is NestJS's default file upload middleware. Disk storage writes files to a configurable temp directory, aligning with our local-disk+temp strategy. Memory storage is unsuitable for files up to 5MB that need to be forwarded to Document AI.
- **Alternatives**: `memoryStorage` (risks OOM under concurrency), custom streaming (over-engineered for <5MB files).

### 3. File Validation
- **Decision**: Validate MIME type + magic bytes on the NestJS side before forwarding to Document AI.
- **Rationale**: Prevents unnecessary Document AI API costs for corrupt/unsupported files. Use `file-type` npm package for magic byte detection.
- **Alternatives**: Rely solely on Document AI's own validation — wastes API calls and cost.

### 4. Document AI Synchronous Processing
- **Decision**: Use `client.processDocument()` (synchronous API) for files ≤5MB.
- **Rationale**: Form Parser supports synchronous processing for files up to 5 pages / 5MB. Aligns with our sync upload mode and 5MB limit.
- **Alternatives**: `batchProcessDocuments()` (async, for larger files) — unnecessary given the 5MB constraint.

### 5. Firebase Auth for API Security
- **Decision**: Use Firebase Auth JWT verification via `firebase-admin` SDK, implemented as a NestJS `AuthGuard`.
- **Rationale**: The Constitution mandates Firebase Auth. The spec's "API Key" clarification is superseded by the Constitution. Firebase provides managed identity with token refresh, revocation, and user management.
- **Alternatives**: API keys (simpler, but violates Constitution); custom JWT (more maintenance).

### 6. Data Persistence
- **Decision**: Use PostgreSQL via Prisma ORM for storing Document metadata and extraction results.
- **Rationale**: NestJS + Prisma is a proven combination in the ecosystem. PostgreSQL provides JSONB columns ideal for storing structured extraction results alongside relational metadata.
- **Alternatives**: MongoDB (schemaless but adds a second data system); in-memory cache (no persistence).

### 7. DTO Design for Extracted Data
- **Decision**: Follow the Constitution's `ExtractedFormField` interface, extended with metadata.
- **Rationale**: Constitution mandates DTO abstraction with typed interfaces shared between Angular and NestJS.
- **Alternatives**: Raw Document AI response passthrough — violates Constitution's data abstraction principle.

### 8. File Storage
- **Decision**: Temp local disk for processing, then discard raw file. Only the extraction result is persisted in PostgreSQL.
- **Rationale**: Constitution mentions GCS for heavy file batching, but our sync processing with ≤5MB files and TTL-based deletion makes local disk sufficient for MVP. GCS integration can be added later for audit log requirements.
- **Alternatives**: GCS always (closer to Constitution but adds complexity for MVP); in-memory only (no reprocessing capability).

### 9. TTL Cleanup
- **Decision**: Implement a scheduled NestJS job (via `@nestjs/schedule`) that runs daily and deletes documents past their TTL.
- **Rationale**: Simple cron-based approach. Constitution's "state-driven ingestion" mentions async processing for large files, but for TTL cleanup, a periodic sweep is sufficient.
- **Alternatives**: GCS lifecycle policies (if using GCS); Document AI TTL (not available for extraction results).

### 10. Error Handling
- **Decision**: Global NestJS `ExceptionFilter` that formats errors consistently per Constitution guidelines.
- **Rationale**: Constitution mandates a global ExceptionFilter for API errors with MatSnackBar-friendly formatting.
- **Alternatives**: Per-controller error handling (inconsistent, violates Constitution).

## Key Dependencies
| Package | Purpose |
|---------|---------|
| `@google-cloud/documentai` | Document AI client library |
| `firebase-admin` | Firebase Auth token verification |
| `@nestjs/schedule` | TTL cleanup cron jobs |
| `@nestjs/config` | Environment variable management |
| `@nestjs/platform-express` | Multer file upload support |
| `file-type` | Magic byte MIME validation |
| `@prisma/client` + `prisma` | PostgreSQL ORM |

## Open Questions (Resolved)
All ambiguities from the spec's `## Clarifications` section have been addressed. No remaining unknowns.
