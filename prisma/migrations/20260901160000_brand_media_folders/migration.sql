-- Additive folder support for brand media libraries.
-- Idempotent: safe to re-run against a database that already has these objects.

CREATE TABLE IF NOT EXISTS "BrandMediaFolder" (
  "id" TEXT NOT NULL,
  "brandId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "BrandMediaFolder_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "BrandMediaFolder_brandId_sortOrder_idx"
  ON "BrandMediaFolder"("brandId", "sortOrder");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'BrandMediaFolder_brandId_fkey'
  ) THEN
    ALTER TABLE "BrandMediaFolder"
      ADD CONSTRAINT "BrandMediaFolder_brandId_fkey"
      FOREIGN KEY ("brandId") REFERENCES "Brand"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

ALTER TABLE "BrandMedia" ADD COLUMN IF NOT EXISTS "folderId" TEXT;

CREATE INDEX IF NOT EXISTS "BrandMedia_brandId_folderId_idx"
  ON "BrandMedia"("brandId", "folderId");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'BrandMedia_folderId_fkey'
  ) THEN
    ALTER TABLE "BrandMedia"
      ADD CONSTRAINT "BrandMedia_folderId_fkey"
      FOREIGN KEY ("folderId") REFERENCES "BrandMediaFolder"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
