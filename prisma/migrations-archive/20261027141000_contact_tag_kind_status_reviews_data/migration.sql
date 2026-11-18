-- Data-only follow-up to 20261027140000_contact_tag_kind_rename. Must run
-- AFTER that migration, in a separate `prisma db execute` call (see its
-- header for why). Idempotent: every write is ON CONFLICT DO NOTHING or
-- keyed to an exact existing row, safe to re-run. Scoped to
-- bookkeeping-conroe, the only brand with these rows today.

BEGIN;

CREATE TEMP TABLE _cfg ON COMMIT DROP AS
  SELECT id AS brand_id FROM "Brand" WHERE slug = 'bookkeeping-conroe';

-- Fail loudly if the brand slug does not exist.
DO $$ BEGIN
  IF (SELECT count(*) FROM _cfg) <> 1 THEN
    RAISE EXCEPTION 'brand slug not found';
  END IF;
END $$;

-- Existing lifecycle markers become STATUS. "paid" covers a one-off hourly
-- job paid in full, as distinct from an ongoing relationship.
UPDATE "contact_tags" SET "kind" = 'STATUS', "updatedAt" = NOW()
WHERE "brandId" IN (SELECT brand_id FROM _cfg)
  AND "key" IN ('active-client', 'former-client', 'paid');

-- The pipeline-stage tag "reviews" (asking a won client for a review) now
-- sits too close to REVIEWS_GIVEN (what they actually gave). Rename the
-- stage tag; its id and existing links/automations are untouched.
UPDATE "contact_tags" SET "key" = 'review-pending', "label" = 'Review pending', "updatedAt" = NOW()
WHERE "brandId" IN (SELECT brand_id FROM _cfg) AND "key" = 'reviews';

-- New STATUS entry: was a paying monthly client, stopped. Distinct from
-- "former-client", which can mean the relationship ended any way at all.
INSERT INTO "contact_tags" ("id", "brandId", "key", "label", "kind", "updatedAt")
SELECT 'tag_churned_' || brand_id, brand_id, 'churned', 'Churned', 'STATUS', NOW() FROM _cfg
ON CONFLICT ("brandId", "key") DO NOTHING;

-- New REVIEWS_GIVEN catalog: what kind of review a client actually left.
INSERT INTO "contact_tags" ("id", "brandId", "key", "label", "kind", "updatedAt")
SELECT 'tag_' || t.key || '_' || brand_id, brand_id, t.key, t.label, 'REVIEWS_GIVEN', NOW()
FROM _cfg, (VALUES
  ('google', 'Google'),
  ('video-testimonial', 'Video testimonial'),
  ('pro-advisor', 'QuickBooks ProAdvisor')
) AS t(key, label)
ON CONFLICT ("brandId", "key") DO NOTHING;

-- New SERVICES entries for the two offers Tom is adding.
INSERT INTO "contact_tags" ("id", "brandId", "key", "label", "kind", "updatedAt")
SELECT 'tag_' || t.key || '_' || brand_id, brand_id, t.key, t.label, 'SERVICES', NOW()
FROM _cfg, (VALUES
  ('training', 'Training'),
  ('consulting', 'Consulting')
) AS t(key, label)
ON CONFLICT ("brandId", "key") DO NOTHING;

COMMIT;
