-- Link a published offer to the engagement used for agreement signing and deposit payment.
-- Idempotent: safe to re-run.

ALTER TABLE "quotes" ADD COLUMN IF NOT EXISTS "engagementId" TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS "quotes_engagementId_key" ON "quotes"("engagementId");
CREATE INDEX IF NOT EXISTS "quotes_brandId_engagementId_idx" ON "quotes"("brandId", "engagementId");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'quotes_engagementId_fkey'
  ) THEN
    ALTER TABLE "quotes"
      ADD CONSTRAINT "quotes_engagementId_fkey"
      FOREIGN KEY ("engagementId") REFERENCES "Engagement"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
