-- The legacy product tables were imported before Prisma migration history was
-- established. Disposable platform databases intentionally do not contain
-- that legacy baseline, so apply this incremental change only where it exists.
DO $$
BEGIN
  IF to_regclass('public.quotes') IS NOT NULL THEN
    ALTER TABLE "quotes"
      ADD COLUMN IF NOT EXISTS "publishedSnapshotJson" JSONB,
      ADD COLUMN IF NOT EXISTS "publicToken" TEXT,
      ADD COLUMN IF NOT EXISTS "publishedAt" TIMESTAMP(3);

    CREATE UNIQUE INDEX IF NOT EXISTS "quotes_publicToken_key"
      ON "quotes"("publicToken");
    CREATE INDEX IF NOT EXISTS "quotes_brandId_publishedAt_idx"
      ON "quotes"("brandId", "publishedAt");
  END IF;
END $$;
