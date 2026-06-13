-- CreateTable
CREATE TABLE "Movement" (
    "id" UUID NOT NULL,
    "documentId" UUID NOT NULL,
    "movementDate" DATE NOT NULL,
    "description" VARCHAR(255) NOT NULL,
    "amount" DECIMAL(15,2) NOT NULL,
    "category" VARCHAR(255),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "Movement_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Movement_documentId_idx" ON "Movement"("documentId");

-- CreateIndex
CREATE INDEX "Movement_deletedAt_idx" ON "Movement"("deletedAt");

-- AddForeignKey
ALTER TABLE "Movement" ADD CONSTRAINT "Movement_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "Document"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
