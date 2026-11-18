-- CreateTable
CREATE TABLE "OperationsClient" (
    "id" TEXT NOT NULL,
    "brandId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "doubleClientId" INTEGER,
    "qbCompany" TEXT,
    "startsOn" DATE NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OperationsClient_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OperationsEvidence" (
    "id" TEXT NOT NULL,
    "brandId" TEXT NOT NULL,
    "dutyId" TEXT NOT NULL,
    "operationsClientId" TEXT,
    "period" DATE NOT NULL,
    "status" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "details" JSONB,
    "sourceRef" TEXT,
    "reportedBy" TEXT NOT NULL,
    "sourceEventId" TEXT NOT NULL,
    "occurredAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OperationsEvidence_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "OperationsClient_brandId_active_idx" ON "OperationsClient"("brandId", "active");

-- CreateIndex
CREATE UNIQUE INDEX "OperationsClient_brandId_key_key" ON "OperationsClient"("brandId", "key");

-- CreateIndex
CREATE UNIQUE INDEX "OperationsClient_brandId_doubleClientId_key" ON "OperationsClient"("brandId", "doubleClientId");

-- CreateIndex
CREATE INDEX "OperationsEvidence_brandId_period_idx" ON "OperationsEvidence"("brandId", "period");

-- CreateIndex
CREATE INDEX "OperationsEvidence_operationsClientId_dutyId_period_idx" ON "OperationsEvidence"("operationsClientId", "dutyId", "period");

-- CreateIndex
CREATE UNIQUE INDEX "OperationsEvidence_brandId_sourceEventId_key" ON "OperationsEvidence"("brandId", "sourceEventId");

-- AddForeignKey
ALTER TABLE "OperationsClient" ADD CONSTRAINT "OperationsClient_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "Brand"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OperationsEvidence" ADD CONSTRAINT "OperationsEvidence_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "Brand"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OperationsEvidence" ADD CONSTRAINT "OperationsEvidence_operationsClientId_fkey" FOREIGN KEY ("operationsClientId") REFERENCES "OperationsClient"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Hand-written: values Prisma cannot constrain.
ALTER TABLE "OperationsEvidence" ADD CONSTRAINT "OperationsEvidence_status_check"
  CHECK ("status" IN ('done', 'waiting_client', 'needs_tom', 'failed'));
ALTER TABLE "OperationsEvidence" ADD CONSTRAINT "OperationsEvidence_summary_check"
  CHECK (char_length("summary") BETWEEN 1 AND 1000);
ALTER TABLE "OperationsClient" ADD CONSTRAINT "OperationsClient_key_check"
  CHECK ("key" ~ '^[a-z0-9][a-z0-9-]{0,79}$');
