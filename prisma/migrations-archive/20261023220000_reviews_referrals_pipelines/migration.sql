-- Reviews and Referrals pipelines, their tags, and the tag -> pipeline
-- automations (Sol, board c5b6dcec6a2d / b848668bedc5).
--
-- Data only: no table or column changes. Idempotent, safe to re-run: every
-- insert is ON CONFLICT DO NOTHING on the existing unique keys. Apply with
-- `prisma db execute --file`, per docs/deployment/database-migration-state.md.
--
-- BRAND: change the one slug below to run it for another brand.
--
-- The automation code (src/lib/contacts/automation.ts) maps ONE stage per
-- tag and pipeline, with no condition on other tags. So tag `reviews` lands
-- at Welcome. Onsite/training clients, who skip Welcome..First close, are
-- moved to Check-in by hand or by pipe until a rule exists.

BEGIN;

CREATE TEMP TABLE _cfg ON COMMIT DROP AS
  SELECT id AS brand_id FROM "Brand" WHERE slug = 'bookkeeping-conroe';

-- Fail loudly if the brand slug does not exist.
DO $$ BEGIN
  IF (SELECT count(*) FROM _cfg) <> 1 THEN
    RAISE EXCEPTION 'brand slug not found';
  END IF;
END $$;

INSERT INTO "Pipeline" ("id", "brandId", "key", "name", "description", "updatedAt")
SELECT 'pipe_reviews_' || brand_id, brand_id, 'reviews', 'Reviews',
       'Won clients: onboarding, then the review ask.', NOW() FROM _cfg
UNION ALL
SELECT 'pipe_referrals_' || brand_id, brand_id, 'referrals', 'Referrals',
       'Clients asked for referrals after reviews.', NOW() FROM _cfg
ON CONFLICT ("brandId", "key") DO NOTHING;

INSERT INTO "PipelineStage" ("id", "pipelineId", "key", "name", "sortOrder", "isTerminal", "updatedAt")
SELECT 'stage_' || p.key || '_' || s.key || '_' || p."brandId", p.id, s.key, s.name, s.ord, s.term, NOW()
FROM "Pipeline" p
JOIN _cfg ON p."brandId" = _cfg.brand_id
JOIN (VALUES
  ('reviews', 'welcome',            'Welcome',             10, false),
  ('reviews', 'portal-accepted',    'Portal accepted',     20, false),
  ('reviews', 'statements-requested','Statements requested',30, false),
  ('reviews', 'statements-received','Statements received', 40, false),
  ('reviews', 'filed',              'Filed',               50, false),
  ('reviews', 'first-close',        'First close',         60, false),
  ('reviews', 'check-in',           'Check-in',            70, false),
  ('reviews', 'ask',                'Ask',                 80, false),
  ('reviews', 'fix-first',          'Fix first',           90, false),
  ('reviews', 'done',               'Done',               100, true),
  ('referrals', 'ask',              'Ask',                 10, false),
  ('referrals', 'asked',            'Asked',               20, false),
  ('referrals', 'done',             'Done',                30, true)
) AS s(pkey, key, name, ord, term) ON s.pkey = p.key
ON CONFLICT ("pipelineId", "key") DO NOTHING;

INSERT INTO "contact_tags" ("id", "brandId", "key", "label", "updatedAt")
SELECT 'tag_' || t.key || '_' || brand_id, brand_id, t.key, t.label, NOW()
FROM _cfg, (VALUES ('reviews', 'Reviews'), ('referrals', 'Referrals')) AS t(key, label)
ON CONFLICT ("brandId", "key") DO NOTHING;

INSERT INTO "contact_tag_automations" ("id", "brandId", "tagId", "pipelineId", "stageId", "updatedAt")
SELECT 'auto_' || t.key || '_' || brand_id, brand_id, t.id, p.id, st.id, NOW()
FROM _cfg
JOIN "contact_tags" t ON t."brandId" = brand_id AND t.key IN ('reviews', 'referrals')
JOIN "Pipeline" p ON p."brandId" = brand_id AND p.key = t.key
JOIN "PipelineStage" st ON st."pipelineId" = p.id
  AND st.key = CASE t.key WHEN 'reviews' THEN 'welcome' ELSE 'ask' END
ON CONFLICT ("tagId", "pipelineId") DO NOTHING;

COMMIT;
