# Feature Specification: Bank Movement CRUD

**Feature Branch**: `008-save-bank-movements`

**Created**: 2026-06-07

**Status**: Draft

**Input**: User description: "Create endpoint to save bank movements with movementDate, description, amount, category linked to a document, protected by company-level access control"

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Save a Bank Movement (Priority: P1)

Un usuario necesita guardar un movimiento bancario individual extraído de un documento PDF. El movimiento pertenece a un documento que a su vez pertenece a una empresa, y solo los miembros de esa empresa pueden guardar movimientos en sus documentos.

**Why this priority**: Es la funcionalidad mínima indispensable. Sin la capacidad de guardar un movimiento bancario individual, el resto de funcionalidades (listar, guardar en lote) no tienen datos sobre los cuales operar.

**Independent Test**: Se puede probar completamente haciendo un POST al endpoint con los campos requeridos (movementDate, description, amount, documentId) usando un token de un usuario miembro de la empresa del documento. Entrega valor inmediato al permitir persistir movimientos bancarios.

**Acceptance Scenarios**:

1. **Given** un usuario autenticado y miembro de la empresa X, con un documento existente y activo en dicha empresa, **When** envía `POST /api/movements` con `{ movementDate, description, amount, documentId }`, **Then** el sistema guarda el movimiento, lo asocia al documento, y retorna el movimiento creado con su ID y código HTTP 201.
2. **Given** un usuario autenticado que NO es miembro de la empresa del documento, **When** intenta guardar un movimiento en ese documento, **Then** el sistema retorna HTTP 403 Forbidden.
3. **Given** un usuario no autenticado, **When** intenta guardar un movimiento, **Then** el sistema retorna HTTP 401 Unauthorized.
4. **Given** un usuario autenticado que envía campos requeridos faltantes o inválidos (ej. monto no numérico), **When** intenta guardar, **Then** el sistema retorna HTTP 400 Bad Request con detalles de validación.
5. **Given** un usuario autenticado miembro de la empresa, **When** intenta guardar un movimiento en un documento que no existe, **Then** el sistema retorna HTTP 404 Not Found.
6. **Given** un usuario autenticado miembro de la empresa, **When** intenta guardar un movimiento con `movementDate` futura, **Then** el sistema retorna HTTP 400 Bad Request.

---

### User Story 2 - List Movements for a Document (Priority: P2)

Un usuario necesita ver todos los movimientos bancarios que pertenecen a un documento específico. Esto le permite revisar los movimientos extraídos y curados para un documento dado.

**Why this priority**: Una vez que los movimientos pueden guardarse, el siguiente paso natural es poder listarlos para revisión/auditoría. Es independiente del guardado y puede implementarse en paralelo o después.

**Independent Test**: Se puede probar haciendo un GET al endpoint con el ID del documento como parámetro, usando un token de usuario miembro de la empresa del documento.

**Acceptance Scenarios**:

1. **Given** un usuario autenticado miembro de la empresa, con un documento que tiene N movimientos guardados, **When** envía `GET /api/movements?documentId=<id>&page=1&limit=20`, **Then** el sistema retorna HTTP 200 con una respuesta paginada: `{ items: [...], total, page, limit, totalPages }`, donde `items` contiene los movimientos ordenados por fecha descendente.
2. **Given** un usuario autenticado miembro de la empresa, con un documento sin movimientos, **When** lista movimientos para ese documento, **Then** retorna HTTP 200 con `{ items: [], total: 0, page: 1, limit: 20, totalPages: 0 }`.
3. **Given** un usuario autenticado miembro de la empresa, con un documento que tiene 50 movimientos, **When** pide la página 2 con limit=20, **Then** retorna los movimientos 21-40 con total=50 y totalPages=3.
4. **Given** un usuario autenticado que NO es miembro de la empresa del documento, **When** intenta listar movimientos de ese documento, **Then** el sistema retorna HTTP 403 Forbidden.

---

### User Story 3 - Batch Save Movements (Priority: P3)

Un usuario necesita guardar múltiples movimientos bancarios de una sola vez para un mismo documento. Esto es útil cuando el proceso de extracción (Document AI) produce varios movimientos simultáneamente.

**Why this priority**: Es una optimización de conveniencia. El guardado individual (P1) ya cubre la funcionalidad base. El guardado en lote reduce el número de peticiones HTTP y mejora la experiencia cuando se procesan documentos con múltiples movimientos.

**Independent Test**: Se puede probar enviando un array de movimientos en un solo POST al endpoint batch, verificando que todos se guarden correctamente o que falle atómicamente.

**Acceptance Scenarios**:

1. **Given** un usuario autenticado miembro de la empresa, **When** envía `POST /api/movements/batch` con un array de 3 movimientos válidos para un mismo documentoId, **Then** el sistema guarda los 3 movimientos y retorna HTTP 201 con el array de movimientos creados.
2. **Given** un usuario autenticado miembro de la empresa, **When** envía un batch con al menos un movimiento inválido, **Then** el sistema retorna HTTP 400 Bad Request sin guardar ningún movimiento (atomicidad).
3. **Given** un usuario autenticado miembro de la empresa, **When** envía un batch con más de 100 movimientos, **Then** el sistema retorna HTTP 400 Bad Request.

---

### Edge Cases

- ¿Qué sucede si el documento asociado al movimiento está en estado `PENDING`, `PROCESSING` o `FAILED`? La especificación restringe el guardado a documentos en estado `COMPLETED` únicamente.
- ¿Qué sucede si el documento está `DELETED` (soft-delete)? — Todas las operaciones sobre movimientos de un documento soft-deleted son rechazadas (ver C-003).
- ¿Qué sucede si el monto (`amount`) es cero? ¿Se permite un monto de $0.00?
- ¿Qué sucede si se intenta guardar un movimiento con una fecha futura (`movementDate`)? — Rechazado (ver C-005).
- ¿Qué sucede si `category` excede una longitud razonable? ¿Cuál es el límite?
- ¿Qué sucede si el documento no tiene `companyId` (borde teórico, no debería ocurrir con integridad referencial)?

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST provide a `POST /api/movements` endpoint to create a single bank movement with fields: `movementDate` (date), `description` (string), `amount` (decimal number), `category` (optional string), and `documentId` (UUID reference to an existing Document).
- **FR-002**: System MUST validate that the authenticated user has an active CompanyMembership for the company that owns the document before allowing movement creation or listing.
- **FR-003**: System MUST validate that `documentId` references an existing, non-deleted Document (both `deletedAt IS NULL` and status not `DELETED`).
- **FR-004**: System MUST return HTTP 201 with the created Movement object (including its generated `id`) on successful creation.
- **FR-005**: System MUST provide a `GET /api/movements?documentId=<id>` endpoint to list all non-deleted movements belonging to a specific document, with pagination support (`page`, `limit` params).
- **FR-006**: System MUST enforce company-scoped access: a user can only interact with movements of documents belonging to companies they are members of.
- **FR-007**: System MUST only allow saving movements to documents in `COMPLETED` status. Documents in `PENDING`, `PROCESSING`, or `FAILED` status are rejected.
- **FR-008**: System MUST provide a `POST /api/movements/batch` endpoint to save multiple movements for the same document atomically.
- **FR-009**: System MUST reject batch requests where any movement is invalid, ensuring atomicity (all-or-nothing).
- **FR-010**: System MUST validate that `movementDate` is not a future date (must be today or earlier).

### Key Entities *(include if feature involves data)*

- **Movement**: Represents a single bank transaction extracted from a document. Key attributes:
  - `movementDate` — the date of the bank transaction
  - `description` — the description or reference text of the movement
  - `amount` — the monetary amount (supports decimals for cents)
  - `category` — an optional classification label (e.g., "groceries", "utilities")
  - Relationship: belongs to one Document, which belongs to one Company
  - Inherits access control from Document → Company → CompanyMembership
  - Supports soft-delete via `deletedAt` field; queries exclude soft-deleted records by default

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A user who is a member of a company can successfully save a movement via the API in under 1 second (p95).
- **SC-002**: Unauthorized access attempts (non-members, unauthenticated) are correctly rejected with appropriate HTTP status codes (401/403) in 100% of cases.
- **SC-003**: Batch save of up to 100 movements completes atomically — either all succeed or none are persisted.
- **SC-004**: All API responses include the Movement's ID, timestamps, and relational reference to its parent Document, enabling traceability.

## Clarifications

- **C-001 (Soft-delete)**: Movement supports soft-delete via `deletedAt` field, following the same pattern as Document and CompanyMembership. Records are never physically deleted — queries filter by `deletedAt: null`.
- **C-002 (Negative amounts)**: Negative amounts are allowed. Positive values represent credits/income, negative values represent debits/expenses. The system does not enforce sign-based validation.
- **C-003 (Soft-deleted Document)**: All movement operations (create, list, batch) are rejected when the target document is soft-deleted (`deletedAt != null`). Consistent with current Document lifecycle patterns.
- **C-004 (Pagination)**: Movement listing supports pagination via `page` and `limit` query parameters, following the same pattern as `GET /api/documents`. Default page=1, limit=20, max limit=100.
- **C-005 (Future dates)**: `movementDate` must not be in the future. Only dates <= today are accepted, since movements represent real bank transactions that have already occurred.

## Assumptions

- Users are authenticated via Firebase Authentication (existing `FirebaseAuthGuard`).
- Company-level access control is enforced through the existing `CompanyMembershipGuard` pattern and `CompanyMembership` table.
- The Document entity already exists in the database and is the parent entity for movements.
- The Movement entity will have its own Prisma model and database table.
- Category is an optional free-text field (no predefined list of categories for v1).
- Movements are immutable after creation — no update endpoint in v1. Soft-delete is supported (see C-001) but no explicit delete endpoint in v1 scope.
- The batch save endpoint belongs to the same module/controller as the single save endpoint.
- Existing soft-delete patterns (CompanyMembership filter by `deletedAt: null`) will be reused for membership checks.
