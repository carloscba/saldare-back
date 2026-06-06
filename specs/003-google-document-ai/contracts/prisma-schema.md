# Prisma Schema

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

model Company {
  id        UUID       @id @default(uuid()) @db.Uuid
  name      String     @db.VarChar(255)
  documents Document[]
  createdAt DateTime   @default(now())
  updatedAt DateTime   @updatedAt
}

model Document {
  id              String    @id @default(uuid()) @db.Uuid
  companyId       String    @db.Uuid
  company         Company   @relation(fields: [companyId], references: [id])
  filename        String    @db.VarChar(255)
  mimeType        String    @db.VarChar(50)
  fileSize        Int
  status          DocumentStatus @default(PENDING)
  extractedFields Json?
  rawResponse     Json?
  errorMessage    String?   @db.Text
  ttlDays         Int       @default(30)
  createdAt       DateTime  @default(now())
  updatedAt       DateTime  @updatedAt
  deletedAt       DateTime?

  @@index([companyId])
  @@index([status])
  @@index([deletedAt])
}

enum DocumentStatus {
  PENDING
  PROCESSING
  COMPLETED
  FAILED
  DELETED
}
```
