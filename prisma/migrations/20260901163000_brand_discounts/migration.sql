-- Additive brand-level discount catalog.
-- Idempotent: safe to re-run.

CREATE TABLE IF NOT EXISTS "BrandDiscount" (
  "id" TEXT NOT NULL,
  "brandId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "kind" TEXT NOT NULL,
  "percent" INTEGER NOT NULL DEFAULT 10,
  "amount" DECIMAL(12, 2) NOT NULL DEFAULT 250,
  "title" TEXT NOT NULL DEFAULT '',
  "details" TEXT NOT NULL DEFAULT '',
  "deadlineMode" TEXT NOT NULL DEFAULT 'relative',
  "durationDays" INTEGER NOT NULL DEFAULT 14,
  "deadlineDate" TIMESTAMP(3),
  "active" BOOLEAN NOT NULL DEFAULT true,
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "BrandDiscount_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "BrandDiscount_brandId_active_sortOrder_idx"
  ON "BrandDiscount"("brandId", "active", "sortOrder");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'BrandDiscount_brandId_fkey'
  ) THEN
    ALTER TABLE "BrandDiscount"
      ADD CONSTRAINT "BrandDiscount_brandId_fkey"
      FOREIGN KEY ("brandId") REFERENCES "Brand"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
