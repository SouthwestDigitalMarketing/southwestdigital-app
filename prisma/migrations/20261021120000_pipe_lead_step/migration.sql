-- Store pipe's optional six-step Leads-board value on its SWapp deal.
-- Existing rows remain unset; safe to apply repeatedly on scratch databases.

BEGIN;

ALTER TABLE "MeetingLead" ADD COLUMN IF NOT EXISTS "leadStep" TEXT;

COMMIT;
