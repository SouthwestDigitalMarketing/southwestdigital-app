-- Working fields for deals synced from the pipe terminal tool. All
-- nullable and additive: existing prospect rows are untouched, and the
-- unique key only constrains rows that carry a pipe id (NULL pipe ids
-- stay distinct from each other, so nothing old can collide).
--
-- Written idempotently: this production database is no longer managed by
-- `prisma migrate deploy` (its history diverged from this checkout), so
-- the statement must be safe to run by hand and to re-run.

BEGIN;

ALTER TABLE "MeetingLead" ADD COLUMN IF NOT EXISTS "customerAccountId" TEXT;
ALTER TABLE "MeetingLead" ADD COLUMN IF NOT EXISTS "pipeId" TEXT;
ALTER TABLE "MeetingLead" ADD COLUMN IF NOT EXISTS "nextAction" TEXT;
ALTER TABLE "MeetingLead" ADD COLUMN IF NOT EXISTS "nextDue" TEXT;
ALTER TABLE "MeetingLead" ADD COLUMN IF NOT EXISTS "amount" DECIMAL(14,2);
ALTER TABLE "MeetingLead" ADD COLUMN IF NOT EXISTS "amountKind" TEXT;
ALTER TABLE "MeetingLead" ADD COLUMN IF NOT EXISTS "invoiceRef" TEXT;
ALTER TABLE "MeetingLead" ADD COLUMN IF NOT EXISTS "invoiceDate" TEXT;
ALTER TABLE "MeetingLead" ADD COLUMN IF NOT EXISTS "yesContactId" TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS "MeetingLead_brandId_pipeId_key" ON "MeetingLead"("brandId", "pipeId");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'MeetingLead_customerAccountId_fkey'
  ) THEN
    ALTER TABLE "MeetingLead" ADD CONSTRAINT "MeetingLead_customerAccountId_fkey"
      FOREIGN KEY ("customerAccountId") REFERENCES "CustomerAccount"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

COMMIT;
