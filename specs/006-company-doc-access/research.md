# Research Document: Control de Acceso a Documentos por Compañía

**Feature**: `006-company-doc-access`
**Date**: 2026-06-06

## Research Decisions

### RD-001: Prisma Model for CompanyMembership

**Decision**: Create a `CompanyMembership` model in `prisma/schema.prisma` with fields `id`, `userId`, `companyId`, `createdAt`, `updatedAt`, `deletedAt`, a `@@unique([userId, companyId])` constraint, and indexes on `userId` and `companyId`.

**Rationale**:
- Follows existing soft-delete pattern used by `Document` model (`deletedAt`).
- Composite unique constraint on `(userId, companyId)` prevents duplicate active memberships. Reactivation of a removed membership is done by setting `deletedAt = null` on the existing row rather than inserting a new one.
- Separate indexes on `userId` and `companyId` optimize the two primary query patterns: "find all companies for a user" and "find all users for a company."
- No role field required per Q2 clarification (all members have equal permissions).

**Alternatives Considered**:
- *Hard-delete with simple unique constraint*: Rejected per Q6 — loses audit trail of membership lifecycle.
- *Partial unique index `WHERE deletedAt IS NULL`*: Rejected. Prisma does not support partial indexes in the schema. Simpler to use full unique constraint and reactivate rows via UPDATE.
- *Separate audit log table*: Rejected as over-engineering for MVP.

---

### RD-002: Authorization Guard Pattern

**Decision**: Implement a new `CompanyMembershipGuard` as a separate NestJS guard class. Compose it with the existing `FirebaseAuthGuard` on controllers using `@UseGuards(FirebaseAuthGuard, CompanyMembershipGuard)`. NestJS executes guards in declaration order — authentication always runs before authorization.

**Rationale**:
- Separation of concerns: authentication (who you are) vs authorization (what you can access).
- Follows existing NestJS guard pattern established by `FirebaseAuthGuard`.
- Independently testable: each guard can be unit-tested in isolation.
- Company endpoints only need membership guard (the FirebaseAuthGuard is not yet applied to a Company controller, so it's added fresh).

**Alternatives Considered**:
- *Merge into FirebaseAuthGuard*: Rejected — violates Single Responsibility Principle. Authentication and authorization are distinct concerns.
- *NestJS middleware*: Rejected — guards are the idiomatic NestJS pattern for route protection and have access to the execution context with dependency injection.
- *Single composite guard*: Rejected — harder to test independently, less compositional.

---

### RD-003: Membership Resolution for Single-Document Endpoints

**Decision**: For `GET /api/documents/:id` and `DELETE /api/documents/:id`, the service method first fetches the document by ID, extracts its `companyId`, then queries the membership table to verify the authenticated user is an active member. If not a member, throw `ForbiddenException` (403) or `NotFoundException` (404) as appropriate.

**Rationale**:
- Transparent to the client — no API contract change required.
- Consistent with Q5 clarification.
- The extra DB query (fetch document → get companyId → check membership) is within the SC-005 performance budget of 1 additional query. The document fetch is already performed; the membership check is the single additional query.
- For 404 cases (document doesn't exist or is soft-deleted), the membership check is skipped entirely, preserving the opaque 404 response that doesn't leak document existence.

**Alternatives Considered**:
- *Require companyId as query param on these endpoints*: Rejected per Q5 — changes API contract unnecessarily.
- *Resolve membership in the guard*: Rejected — guards run before route handlers and would need to duplicate the document-fetch logic or use a different approach (e.g., decorator + interceptor pattern), adding complexity.

---

### RD-004: Company List Endpoint Architecture

**Decision**: Create a new `CompaniesModule` with `CompaniesController` and `CompaniesService`. The controller exposes a single `GET /api/companies` endpoint protected by `FirebaseAuthGuard`. The service queries the `CompanyMembership` table to find all active (non-deleted) memberships for the authenticated user, joins with `Company`, and returns the company list.

**Rationale**:
- Clean NestJS module separation following project conventions.
- The `DocumentsModule` is already focused on document CRUD; adding company logic there would mix concerns.
- A dedicated `CompaniesModule` is extensible for future company management features (currently out of scope).
- Follows the pattern established by `HealthModule` and `DocumentsModule`.

**Alternatives Considered**:
- *Add to DocumentsModule*: Rejected — mixes document and company concerns in one module.
- *Single endpoint in AppController*: Rejected — not scalable; violates NestJS module conventions.

---

### RD-005: Audit Logging Strategy for Authorization Denials

**Decision**: Use NestJS built-in `Logger` at `warn` level with structured JSON format. Each denial log entry includes: `timestamp`, `userId`, `requestedCompanyId`, `endpoint`, `reason`. Cloud Run automatically captures stdout and forwards to Cloud Logging.

**Rationale**:
- Zero additional infrastructure — leverages existing Cloud Run → Cloud Logging integration.
- NestJS `Logger` is already used throughout the codebase (e.g., `DocumentsService`).
- Structured JSON format enables log-based metrics and alerting in Cloud Logging.
- `warn` level distinguishes authorization denials from operational `log` messages.

**Alternatives Considered**:
- *Database audit log table*: Rejected — adds write latency to every denied request, increases storage costs, requires additional schema and cleanup logic.
- *External logging service (e.g., Sentry, Datadog)*: Rejected — over-engineering for MVP scope.
- *NestJS interceptor for 403 logging*: Considered as a potential alternative. A `LoggingInterceptor` could be cleaner than inline logging, but for a single log point, inline is simpler. If more logging needs arise, an interceptor should be refactored in.

---

### RD-006: Guard Composition & Request Flow

**Decision**: The request flow for secured endpoints is:

```
Client Request
  → FirebaseAuthGuard (validate JWT, set request.user)
    → CompanyMembershipGuard (check membership table for userId + companyId)
      → Controller handler
        → Service method
```

For company endpoints (`GET /api/companies`), the `CompanyMembershipGuard` is not needed — the service filters by membership directly.

For document endpoints with explicit `companyId` (list, upload), the guard extracts `companyId` from the request (query param or body) and validates membership before the controller is reached.

For document endpoints with only `documentId` (get by id, delete), membership validation happens in the service layer (RD-003).

**Rationale**:
- Guards reject unauthorized requests early (before any business logic runs), reducing wasted work.
- Service-layer validation for `/api/documents/:id` is necessary because the `companyId` is not available in the request — it must be resolved from the database.
- This hybrid approach (guard for explicit companyId, service for resolved companyId) is the simplest correct solution for the existing API contract.

**Alternatives Considered**:
- *All validation in guards*: Rejected — guards can't resolve companyId from document ID without duplicating DB queries the service will also make.
- *All validation in services*: Rejected — loses early rejection benefit; business logic would run before authorization check.
