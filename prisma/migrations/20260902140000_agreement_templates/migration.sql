-- Add reusable, brand-owned agreement templates without changing existing
-- engagement agreements or published proposal snapshots.

BEGIN;

CREATE TABLE IF NOT EXISTS "AgreementTemplate" (
  "id" TEXT NOT NULL,
  "brandId" TEXT NOT NULL,
  "key" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "description" TEXT,
  "content" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'active',
  "isDefault" BOOLEAN NOT NULL DEFAULT false,
  "archivedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "AgreementTemplate_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "AgreementTemplate_brandId_key_key"
  ON "AgreementTemplate"("brandId", "key");

CREATE INDEX IF NOT EXISTS "AgreementTemplate_brandId_status_name_idx"
  ON "AgreementTemplate"("brandId", "status", "name");

CREATE INDEX IF NOT EXISTS "AgreementTemplate_brandId_isDefault_status_idx"
  ON "AgreementTemplate"("brandId", "isDefault", "status");

CREATE UNIQUE INDEX IF NOT EXISTS "AgreementTemplate_one_active_default_per_brand_key"
  ON "AgreementTemplate"("brandId")
  WHERE "isDefault" = true AND "status" = 'active';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'AgreementTemplate_brandId_fkey'
      AND conrelid = '"AgreementTemplate"'::regclass
  ) THEN
    ALTER TABLE "AgreementTemplate"
      ADD CONSTRAINT "AgreementTemplate_brandId_fkey"
      FOREIGN KEY ("brandId") REFERENCES "Brand"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END
$$;

COMMIT;
