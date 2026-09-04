-- Add lifecycle tracking to quotes so we can drive follow-up automation:
--   lastActivityAt — most recent event on the offer (publish, send, view,
--     sign, pay, or follow-up nudge). Powers the "is this stale?" check.
--   lastFollowUpAt — set only when staff sends a follow-up nudge. Powers
--     the "don't nag" throttle so we can space nudges without extra state.
--
-- Backfill derives lastActivityAt from the newest known event on each row
-- so existing offers land in the correct staleness state on day 1.
--
-- Additive and idempotent.

BEGIN;

ALTER TABLE "quotes"
  ADD COLUMN IF NOT EXISTS "lastActivityAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "lastFollowUpAt" TIMESTAMP(3);

UPDATE "quotes"
SET "lastActivityAt" = GREATEST(
  COALESCE("publishedAt",    'epoch'::timestamp),
  COALESCE("firstSentAt",    'epoch'::timestamp),
  COALESCE("lastSentAt",     'epoch'::timestamp),
  COALESCE("sentAt",         'epoch'::timestamp),
  COALESCE("firstViewedAt",  'epoch'::timestamp),
  COALESCE("updatedAt",      'epoch'::timestamp),
  COALESCE("createdAt",      'epoch'::timestamp)
)
WHERE "lastActivityAt" IS NULL;

CREATE INDEX IF NOT EXISTS "quotes_brandId_status_lastActivityAt_idx"
  ON "quotes"("brandId", "status", "lastActivityAt");

COMMIT;
