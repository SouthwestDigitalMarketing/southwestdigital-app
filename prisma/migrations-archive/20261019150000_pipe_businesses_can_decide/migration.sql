-- The pipe terminal tool links people to businesses with a role and a
-- can-decide flag (owners and partners decide unless said otherwise).
-- CustomerContact had the role (relationship) but nowhere to keep who can
-- decide, so pipe's links could not round-trip. Additive only: existing
-- rows read as nobody-decides, which matches pipe's default for the
-- plain "contact" role.
--
-- Written idempotently: this production database is no longer managed by
-- `prisma migrate deploy` (its history diverged from this checkout), so
-- the statement must be safe to run by hand and to re-run.

BEGIN;

ALTER TABLE "CustomerContact" ADD COLUMN IF NOT EXISTS "canDecide" BOOLEAN NOT NULL DEFAULT false;

COMMIT;
