# Quickstart Guide: Company Document Access Control

**Feature**: `006-company-doc-access`
**Date**: 2026-06-06

## Overview

This guide walks through setting up and verifying the company-based document access control feature. It covers database migration, seeding test data, and testing the authorization flow.

## Prerequisites

- Running PostgreSQL database (local via `docker-compose up db` or Cloud SQL)
- Firebase project with Authentication enabled
- `.env` configured with `DATABASE_URL` and `FIREBASE_PROJECT_ID`
- Node.js and npm installed

## Step 1: Database Migration

Apply the new `CompanyMembership` table:

```bash
npx prisma migrate dev --name add_company_membership
```

Verify the table exists:

```bash
npx prisma studio
# Navigate to CompanyMembership table — should be empty
```

## Step 2: Seed Test Data

Create companies and memberships directly in the database:

```sql
-- Create test companies
INSERT INTO "Company" ("id", "name") VALUES
  ('a0000000-0000-0000-0000-000000000001', 'Acme Corp'),
  ('a0000000-0000-0000-0000-000000000002', 'Globex Inc');

-- Add memberships (replace USER_UID with your Firebase UID)
INSERT INTO "CompanyMembership" ("id", "userId", "companyId") VALUES
  (gen_random_uuid(), 'YOUR_FIREBASE_UID_HERE', 'a0000000-0000-0000-0000-000000000001'),
  (gen_random_uuid(), 'YOUR_FIREBASE_UID_HERE', 'a0000000-0000-0000-0000-000000000002');
```

Alternatively, use the dev bypass token for quick local testing:

```bash
# Set in .env
AUTH_BYPASS_TOKEN=dev-test-token
```

With bypass mode, the system uses `uid: 'dev-user'` — seed memberships for that UID:

```sql
INSERT INTO "CompanyMembership" ("id", "userId", "companyId") VALUES
  (gen_random_uuid(), 'dev-user', 'a0000000-0000-0000-0000-000000000001');
```

## Step 3: Start the Server

```bash
npm run start:dev
```

## Step 4: Test the Authorization Flow

### 4.1 List User's Companies

```bash
curl -H "Authorization: Bearer dev-test-token" \
  http://localhost:3000/api/companies
```

**Expected**: Returns only companies where `dev-user` has an active membership.

### 4.2 List Documents (Authorized Company)

```bash
curl -H "Authorization: Bearer dev-test-token" \
  "http://localhost:3000/api/documents?companyId=a0000000-0000-0000-0000-000000000001"
```

**Expected**: 200 OK with document list (may be empty if no documents uploaded yet).

### 4.3 Access Documents of Unauthorized Company

First, create a company the user is NOT a member of:

```sql
INSERT INTO "Company" ("id", "name") VALUES
  ('a0000000-0000-0000-0000-000000000003', 'Unauthorized Inc');
```

Then try to access it:

```bash
curl -H "Authorization: Bearer dev-test-token" \
  "http://localhost:3000/api/documents?companyId=a0000000-0000-0000-0000-000000000003"
```

**Expected**: 403 Forbidden — "You do not have access to this company's documents"

### 4.4 Upload Document to Unauthorized Company

```bash
curl -X POST \
  -H "Authorization: Bearer dev-test-token" \
  -F "file=@test-file.pdf" \
  -F "companyId=a0000000-0000-0000-0000-000000000003" \
  http://localhost:3000/api/documents/upload
```

**Expected**: 403 Forbidden.

### 4.5 Access Document by ID (Cross-Company)

Upload a document to an authorized company (step 4.2 must succeed), then get its ID. As a different user (or without that company membership), try:

```bash
# User is member of company 001, document belongs to company 002
curl -H "Authorization: Bearer dev-test-token" \
  http://localhost:3000/api/documents/<document-id-from-other-company>
```

**Expected**: 404 Not Found (hides document existence).

### 4.6 Remove User from Company

```sql
UPDATE "CompanyMembership"
SET "deletedAt" = NOW()
WHERE "userId" = 'dev-user'
  AND "companyId" = 'a0000000-0000-0000-0000-000000000001';
```

Now try accessing company 001's documents again:

```bash
curl -H "Authorization: Bearer dev-test-token" \
  "http://localhost:3000/api/documents?companyId=a0000000-0000-0000-0000-000000000001"
```

**Expected**: 403 Forbidden.

### 4.7 Reactivate Membership

```sql
UPDATE "CompanyMembership"
SET "deletedAt" = NULL
WHERE "userId" = 'dev-user'
  AND "companyId" = 'a0000000-0000-0000-0000-000000000001';
```

**Expected**: User can access company 001's documents again.

## Step 5: Verify Audit Logs

Authorization denials are logged to stdout. Check the server console output:

```
[CompanyMembershipGuard] warn: {"timestamp":"2026-06-06T12:00:00.000Z","userId":"dev-user","requestedCompanyId":"a0000000-0000-0000-0000-000000000003","endpoint":"GET /api/documents","reason":"not_member"}
```

## Step 6: Run Tests

```bash
# Unit tests
npm test

# E2E tests
npm run test:e2e
```

## Rollback

To remove the feature:

```bash
# Rollback migration
npx prisma migrate diff --from-schema-datamodel prisma/schema.prisma --to-schema-datasource prisma/schema.prisma --script > rollback.sql
# Or manually:
DROP TABLE "CompanyMembership";
```
