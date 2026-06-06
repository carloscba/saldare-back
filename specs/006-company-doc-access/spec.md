# Feature Specification: Control de Acceso a Documentos por Compañía

**Feature Branch**: `006-company-doc-access`

**Created**: 2026-06-06

**Status**: Draft

**Input**: User description: "Necesitamos poder gestionar users por companies. Los usuarios solo pueden subir documentos a empresas con las que estan relacionados. Necesitamos una tabla que nos permita relacionar usuarios con las empresas. Los usuarios solo pueden listar las empresas y los documentos con los que estan relacionadas. Necesitamos un sistema robusto para evitar que usuarios no autorizados accedan a documentos que no tienen asignados."

## Clarifications

### Q1: ¿Quién puede agregar/remover usuarios de una compañía?

**Question**: Para la gestión de usuarios por compañía, ¿quién tiene permisos para agregar o remover usuarios de una compañía?

- **A)** Cualquier miembro existente de la compañía (Recommended)
- **B)** Solo un rol de administrador designado dentro de la compañía
- **C)** Solo mediante invitación aceptada por el usuario (self-service)

**Decision**: La asignación de usuarios a compañías se realiza directamente en la base de datos (inserción manual o seeds). La gestión de miembros (UI/API para altas y bajas) se realizará en otro proyecto. Esta feature solo provee la tabla de membresía y la capa de autorización que la consume.

### Q2: ¿Se necesita un modelo de roles dentro de cada compañía?

**Question**: ¿Los usuarios deben tener roles diferenciados dentro de una compañía (ej. admin, miembro, lector) o todos los miembros tienen los mismos permisos?

- **A)** Sin roles — todos los miembros tienen los mismos permisos (Recommended) ✅
- **B)** Dos roles: admin (gestión de miembros + documentos) y miembro (solo documentos propios)
- **C)** Múltiples roles finos (admin, editor, lector, etc.)

**Decision**: Sin roles. Todos los miembros de una compañía tienen los mismos permisos: pueden subir, listar, ver y eliminar documentos de esa compañía. No se necesita campo de rol en la tabla de membresía.

### Q3: ¿Cómo se gestiona el ciclo de vida de relación usuario-compañía (altas y bajas)?

**Question**: ¿Qué debe pasar con los documentos subidos por un usuario cuando ese usuario es removido de una compañía?

- **A)** Los documentos permanecen en la compañía sin cambios (Recommended) ✅
- **B)** Los documentos del usuario removido se marcan para revisión
- **C)** Los documentos subidos por el usuario se eliminan (soft-delete)

**Decision**: Sin cambios. Los documentos permanecen en la compañía y siguen siendo visibles para los miembros restantes. La propiedad es de la compañía, no del usuario individual.

### Q4: ¿Qué endpoints de Company debe proveer esta feature?

**Question**: Actualmente no existe ningún CompanyController en el código base. ¿Qué endpoints de compañía deben crearse?

- **A)** Solo GET /api/companies — listar compañías del usuario autenticado (Recommended) ✅
- **B)** GET list + GET by id
- **C)** CRUD completo

**Decision**: Solo `GET /api/companies`. Lista las compañías donde el usuario autenticado es miembro. La creación y gestión de compañías se hace directamente en la base de datos o en otro proyecto. No se crean endpoints POST/PUT/DELETE para compañías en esta feature.

### Q5: ¿Cómo resolver la compañía en GET/DELETE /api/documents/:id?

**Question**: Estos endpoints no reciben `companyId` en el request actual. ¿Cómo determinar a qué compañía pertenece el documento para validar membresía?

- **A)** Resolver desde el documento en BD — consultar el documento, obtener su companyId, verificar membresía (Recommended) ✅
- **B)** Exigir companyId como query param en el request

**Decision**: El backend resuelve el `companyId` desde el propio registro del documento en base de datos. El flujo es: buscar documento por ID → obtener su `companyId` → verificar que el usuario es miembro de esa compañía → retornar el documento o 403/404. Transparente para el cliente, sin cambios en el contrato de API.

### Q6: ¿Soft-delete o hard-delete para CompanyMembership?

**Question**: El modelo `Document` usa soft-delete (`deletedAt`). ¿La tabla de membresías debe seguir el mismo patrón?

- **A)** Hard-delete — DELETE físico del registro
- **B)** Soft-delete — campo `deletedAt` para borrado lógico ✅

**Decision**: Soft-delete. La tabla `CompanyMembership` incluye un campo `deletedAt`. Las queries de verificación de membresía excluyen registros con `deletedAt IS NOT NULL`. Consistente con el patrón usado en `Document`.

### Q7: ¿Dónde se registran los logs de denegación (FR-010)?

**Question**: FR-010 exige registrar todos los 403. ¿Cuál es el destino de estos logs?

- **A)** Console / stdout → Cloud Logging (Recommended) ✅
- **B)** Tabla `audit_log` en PostgreSQL
- **C)** Ambos

**Decision**: Logs estructurados (JSON) emitidos a `stdout`. Cloud Run los captura automáticamente y los envía a Cloud Logging. Sin infraestructura adicional. Cada entrada de log incluye: timestamp, userId, companyId solicitado, endpoint, motivo de denegación (no miembro).

### Q8: ¿GET /api/documents sin companyId?

**Question**: ¿Debe permitirse listar documentos sin especificar companyId, devolviendo documentos de todas las compañías del usuario?

- **A)** No — `companyId` sigue siendo obligatorio (Recommended) ✅
- **B)** Sí — `companyId` pasa a ser opcional

**Decision**: `companyId` sigue siendo query param obligatorio en `GET /api/documents`. El cliente siempre debe especificar en qué compañía quiere operar. No se soporta listado cross-company en una sola llamada.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Asegurar que usuarios solo acceden a documentos de sus compañías (Priority: P1)

Un usuario autenticado intenta acceder a los documentos de una compañía. El sistema verifica que el usuario es miembro de esa compañía antes de permitir cualquier operación (listar, subir, ver detalle, eliminar). Si el usuario no pertenece a la compañía, recibe un error 403 Forbidden.

**Why this priority**: Es la base de la seguridad del sistema. Sin esta verificación, cualquier usuario autenticado puede acceder a documentos de cualquier compañía, lo que representa una vulnerabilidad crítica de datos.

**Independent Test**: Se puede probar autenticando dos usuarios distintos, asignando cada uno a una compañía diferente, e intentando acceder a los documentos de la compañía del otro. El sistema debe rechazar el acceso con 403.

**Acceptance Scenarios**:

1. **Given** el usuario U1 es miembro de la compañía C1 y no de C2, **When** U1 solicita listar documentos de C1, **Then** el sistema retorna los documentos de C1 exitosamente.
2. **Given** el usuario U1 es miembro de la compañía C1 y no de C2, **When** U1 solicita listar documentos de C2, **Then** el sistema retorna error 403 Forbidden.
3. **Given** el usuario U1 es miembro de la compañía C1, **When** U1 intenta subir un documento a C2, **Then** el sistema retorna error 403 Forbidden.
4. **Given** el usuario U1 es miembro de la compañía C1, **When** U1 intenta ver el detalle de un documento que pertenece a C2, **Then** el sistema retorna error 404 Not Found (no revela la existencia del documento).
5. **Given** un usuario no autenticado, **When** intenta acceder a cualquier endpoint de documentos, **Then** el sistema retorna error 401 Unauthorized.

---

### User Story 2 - Listar solo las compañías a las que pertenece el usuario (Priority: P1)

Un usuario autenticado consulta el endpoint de compañías. El sistema retorna únicamente las compañías en las que el usuario es miembro. Si el usuario no pertenece a ninguna compañía, recibe una lista vacía.

**Why this priority**: Es la puerta de entrada del usuario al sistema. Sin este filtro, el usuario no sabe en qué compañías puede operar y podría intentar acceder a compañías no autorizadas.

**Independent Test**: Se puede probar creando varias compañías y asignando usuarios a subconjuntos de ellas. Cada usuario solo debe ver sus compañías asignadas al consultar el endpoint.

**Acceptance Scenarios**:

1. **Given** el usuario U1 es miembro de las compañías C1 y C2, **When** U1 consulta `GET /api/companies`, **Then** el sistema retorna solo C1 y C2.
2. **Given** el usuario U1 no es miembro de ninguna compañía, **When** U1 consulta `GET /api/companies`, **Then** el sistema retorna una lista vacía (200 OK con array vacío).

---

### User Story 3 - Registrar la relación usuario-compañía (Priority: P2)

Un usuario autorizado establece una relación de pertenencia entre un usuario y una compañía. El sistema registra esta membresía en la base de datos para que los guards de autorización puedan validarla en operaciones posteriores.

**Why this priority**: Es necesario para que los escenarios P1 funcionen, pero puede implementarse inicialmente con inserción directa en base de datos o seeds. El mecanismo de gestión (UI o API) puede refinarse después.

**Independent Test**: Se puede probar insertando un registro de membresía en la base de datos y verificando que el usuario correspondiente puede acceder a los documentos de esa compañía.

**Acceptance Scenarios**:

1. **Given** existe un usuario con Firebase UID "abc123" y una compañía C1, **When** se registra la membresía de "abc123" en C1, **Then** el usuario puede acceder a los documentos de C1.
2. **Given** el usuario U1 ya es miembro de C1, **When** se intenta registrar una membresía duplicada para U1 en C1, **Then** el sistema rechaza la operación con un error indicando que la relación ya existe.
3. **Given** el usuario U1 pertenece a C1, **When** U1 es removido de C1, **Then** U1 ya no puede acceder a los documentos de C1 (recibe 403).

---

### User Story 4 - Documentos heredan visibilidad por compañía (Priority: P2)

Cuando un usuario sube un documento a una compañía, el documento queda asociado a esa compañía y es visible para todos los miembros de la misma. Cualquier miembro de la compañía puede listar y ver el detalle de los documentos subidos por otros miembros.

**Why this priority**: Refleja el modelo de colaboración donde los documentos pertenecen a la compañía, no a usuarios individuales. Esto es fundamental para el flujo de trabajo contable donde múltiples personas procesan documentos de una misma empresa.

**Independent Test**: Dos usuarios miembros de la misma compañía pueden subir documentos y cada uno puede ver los documentos del otro.

**Acceptance Scenarios**:

1. **Given** U1 y U2 son miembros de C1, **When** U1 sube un documento a C1, **Then** U2 puede ver ese documento en el listado de documentos de C1.
2. **Given** U1 es miembro de C1 y U2 es miembro de C2, **When** U1 sube un documento a C1, **Then** U2 NO puede ver ese documento porque pertenece a otra compañía.

---

### Edge Cases

- ¿Qué sucede cuando un usuario autenticado no tiene compañías asignadas? Debe recibir listas vacías en los endpoints de compañías y documentos, nunca errores 500.
- ¿Qué sucede si se elimina una compañía que tiene miembros y documentos asociados? Los documentos y membresías deben manejarse según la estrategia de borrado (soft-delete en cascada o restricción de integridad referencial).
- ¿Qué sucede cuando un usuario es eliminado de Firebase pero aún tiene registros de membresía en la base de datos? El sistema debe tolerar usuarios huérfanos (UIDs que ya no existen en Firebase) sin fallar, tratándolos como no autenticados.
- ¿Qué sucede si se intenta acceder a un documento con un companyId que no existe en la base de datos? Debe retornar 404 Not Found.
- ¿Qué sucede con endpoints públicos como el health check? No deben requerir verificación de membresía (solo los endpoints de documentos y compañías).
- ¿Qué sucede cuando un mismo usuario es miembro de múltiples compañías? Debe poder operar independientemente en cada una sin interferencia, pasando el companyId correspondiente en cada request.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST maintain a membership table linking Firebase user UIDs to Company records, storing at minimum the user identifier and the company identifier.
- **FR-002**: System MUST enforce that document operations are only permitted when the authenticated user is a member of the document's company. For operations that receive `companyId` explicitly (list, upload), validate membership against the provided companyId. For operations that only receive `documentId` (get by id, delete), resolve the document's companyId from the database and validate membership against it.
- **FR-003**: System MUST provide a `GET /api/companies` endpoint that returns only companies where the authenticated user is an active member (membership exists and `deletedAt` is null). No other company endpoints (POST, PUT, DELETE) are in scope.
- **FR-004**: System MUST return HTTP 403 Forbidden when an authenticated user attempts to access documents of a company they are not a member of.
- **FR-005**: System MUST NOT reveal the existence of documents or companies the user does not have access to (return 404 instead of 403 for individual resource lookups where appropriate).
- **FR-006**: System MUST apply membership checks consistently across all document endpoints (list, upload, get, delete) and company endpoints.
- **FR-007**: The membership table schema MUST support direct database insertion (seeds or manual queries) as the primary mechanism for adding and removing memberships. Membership management API is out of scope for this feature.
- **FR-008**: System MUST handle the case where an authenticated user has zero company memberships gracefully (empty lists, no errors).
- **FR-009**: System MUST validate that the companyId provided in document operations corresponds to an existing company before performing membership checks.
- **FR-010**: System MUST log all authorization denials (403 responses) as structured JSON to stdout, including timestamp, authenticated user UID, requested companyId, endpoint path, and denial reason. Logs are captured by Cloud Run and forwarded to Cloud Logging.

### Key Entities

- **CompanyMembership**: Relates a Firebase-authenticated user (identified by UID) to a Company. Represents active membership when `deletedAt` is null. Key attributes: user identifier (Firebase UID), company identifier, membership creation timestamp, soft-delete timestamp (`deletedAt`). No role field needed — all members have equal permissions within a company. Unique constraint on (userId, companyId) to prevent duplicate active memberships.
- **Company** *(existing)*: Represents a business entity whose documents are processed. Already has id, name, and a one-to-many relationship with Document. This feature adds a one-to-many relationship with CompanyMembership.
- **Document** *(existing)*: Represents an uploaded financial document (invoice, receipt, etc.) that belongs to a Company. This feature adds no new fields to Document; the access control is enforced at the service/guard layer using the membership data.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 100% of document access attempts by users not belonging to the document's company are rejected with appropriate HTTP error codes (403/404).
- **SC-002**: Users can retrieve their authorized company list in under 500ms for up to 50 company memberships.
- **SC-003**: Document listing with membership filtering performs within 10% of the current unfiltered query time for the same result set size.
- **SC-004**: Zero data leaks: a user who is a member only of company A can never retrieve, by any API call, documents or metadata belonging to company B.
- **SC-005**: The membership check adds no more than 1 additional database query per secured request compared to the current implementation.

## Assumptions

- Firebase Authentication remains the sole identity provider. User UIDs from verified Firebase JWTs are the trusted source of user identity. No local user table is created; the membership table references Firebase UIDs directly.
- The existing `FirebaseAuthGuard` continues to handle token validation and extraction of user identity. The new membership guard runs after authentication and before the controller handler.
- Companies are created and managed directly in the database or by external tooling. This feature provides only the `GET /api/companies` read endpoint. No company CRUD endpoints are built here.
- Document ownership remains at the company level, not at the user level. All members of a company can see all documents of that company.
- The system does not need to support cross-company document sharing in v1.
- The health check endpoint (`/health`) remains publicly accessible without authentication.
- NestJS guard pattern is used to enforce membership checks, following the same architectural patterns as the existing `FirebaseAuthGuard`.
- Authorization denial logs are emitted as structured JSON to stdout and rely on Cloud Run's built-in Cloud Logging integration. No separate logging infrastructure is required.
- The existing Prisma ORM with PostgreSQL is used for the new membership table with appropriate indexes on user identifier and company identifier for query performance.
- Membership management (adding/removing users from companies) is performed directly in the database or via external tooling. No membership CRUD API endpoints are built in this feature. The membership table is read by the authorization layer but written externally.
