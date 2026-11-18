ALTER TABLE "CustomerArSnapshot"
  ADD COLUMN IF NOT EXISTS "qboInvoiceId" TEXT,
  ADD COLUMN IF NOT EXISTS "qboCustomerId" TEXT,
  ADD COLUMN IF NOT EXISTS "qboDocNumber" TEXT,
  ADD COLUMN IF NOT EXISTS "txnDate" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "totalAmount" DECIMAL(12,2),
  ADD COLUMN IF NOT EXISTS "status" TEXT,
  ADD COLUMN IF NOT EXISTS "emailStatus" TEXT,
  ADD COLUMN IF NOT EXISTS "paymentHistory" JSONB;

CREATE UNIQUE INDEX IF NOT EXISTS "CustomerArSnapshot_brandId_qbCompany_qboInvoiceId_key"
  ON "CustomerArSnapshot"("brandId", "qbCompany", "qboInvoiceId");

CREATE INDEX IF NOT EXISTS "CustomerArSnapshot_brandId_qboCustomerId_idx"
  ON "CustomerArSnapshot"("brandId", "qboCustomerId");
