-- Add reusable, brand-owned templates for the Options step of the proposal
-- builder. Additive + idempotent; does not touch existing quotes or catalogs.

BEGIN;

CREATE TABLE IF NOT EXISTS "ProposalOptionsTemplate" (
  "id" TEXT NOT NULL,
  "brandId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "description" TEXT,
  "productKind" TEXT NOT NULL DEFAULT 'bookkeeping',
  "snapshotJson" JSONB NOT NULL,
  "defaultForProductKind" TEXT,
  "archivedAt" TIMESTAMP(3),
  "createdById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "ProposalOptionsTemplate_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "ProposalOptionsTemplate_brandId_defaultForProductKind_key"
  ON "ProposalOptionsTemplate"("brandId", "defaultForProductKind")
  WHERE "defaultForProductKind" IS NOT NULL;

CREATE INDEX IF NOT EXISTS "ProposalOptionsTemplate_brandId_productKind_archivedAt_idx"
  ON "ProposalOptionsTemplate"("brandId", "productKind", "archivedAt");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'ProposalOptionsTemplate_brandId_fkey'
      AND conrelid = '"ProposalOptionsTemplate"'::regclass
  ) THEN
    ALTER TABLE "ProposalOptionsTemplate"
      ADD CONSTRAINT "ProposalOptionsTemplate_brandId_fkey"
      FOREIGN KEY ("brandId") REFERENCES "Brand"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END
$$;

COMMIT;
