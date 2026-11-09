-- Tag -> pipeline automation coverage (Sol, board GOAL: tags drive funnel
-- placement in both directions).
--
-- Data only: no table or column changes. Idempotent, safe to re-run: every
-- write is ON CONFLICT DO NOTHING (or a keyed UPDATE for kind unification),
-- and tag labels are never overwritten. Apply with
-- `prisma db execute --file`, per docs/deployment/database-migration-state.md.
-- Brand-generic: covers every brand that already has at least one contact tag
-- (provisioned brands). Brands with zero tags are left alone so
-- ensureDefaultContactTags still seeds the full default set on first use.
--
-- Rules enforced here (mirrored in src/lib/contacts/seed.ts for new brands):
--   * Step tags business-owner/lead/talking/reached/proposed are LEAD kind.
--     Rows the pipe tool created as CUSTOM are unified to LEAD.
--   * Every SERVICES tag maps to the `prospects` pipeline at
--     `education-interest` (scope still to be validated).
--   * Step tags map to the `pipe-prospects` funnel:
--       business-owner -> prospect (top of funnel, not yet a lead)
--       lead           -> lead
--       talking        -> talking
--       reached        -> talking (contact made; no dedicated stage exists)
--       proposed       -> proposed
--   * Automation rows are enforced active and pointed at the correct stage
--     (ON CONFLICT DO UPDATE on stageId/isActive only). Nothing else is
--     created, archived, or deleted.
--   * MeetingLead.kind itself is recomputed at tag add/remove time in
--     src/lib/contacts/automation.ts, not here.

BEGIN;

-- Provisioned brands: at least one contact tag exists.
CREATE TEMP TABLE _brands ON COMMIT DROP AS
  SELECT DISTINCT "brandId" AS brand_id FROM "contact_tags";

-- 1. Unify step tags to LEAD kind everywhere. The pipe tool creates unknown
-- tags as CUSTOM, so pre-existing `lead`/`proposed` rows are corrected here.
UPDATE "contact_tags" SET "kind" = 'LEAD', "updatedAt" = NOW()
WHERE "key" IN ('business-owner', 'lead', 'talking', 'reached', 'proposed')
  AND "kind" <> 'LEAD';

-- 2. Ensure the step tag rows exist for every provisioned brand.
INSERT INTO "contact_tags" ("id", "brandId", "key", "label", "kind", "sortOrder", "updatedAt")
SELECT 'tag_' || t.key || '_' || b.brand_id, b.brand_id, t.key, t.label, 'LEAD', t.ord, NOW()
FROM (SELECT brand_id FROM _brands) b
CROSS JOIN (VALUES
  ('business-owner', 'Business owner', 20),
  ('lead',           'Lead',           70),
  ('talking',        'Talking',        80),
  ('reached',        'Reached',        90),
  ('proposed',       'Proposed',      100)
) AS t(key, label, ord)
ON CONFLICT ("brandId", "key") DO NOTHING;

-- 3. Ensure the pipe-prospects funnel pipeline exists (mirrors the ensure
-- block in src/lib/pipe/deals.ts upsertPipeDeal).
INSERT INTO "Pipeline" ("id", "brandId", "key", "name", "description", "type", "updatedAt")
SELECT 'pipe_prospects_' || brand_id, brand_id, 'pipe-prospects', 'Pipe Prospects',
       'Deals worked from the pipe terminal tool, using pipe''s stages.',
       'CUSTOM'::"PipelineType", NOW()
FROM (SELECT brand_id FROM _brands) b
ON CONFLICT ("brandId", "key") DO NOTHING;

-- 4. Ensure the six pipe-prospects stages (same keys/order as STAGE_ORDER).
INSERT INTO "PipelineStage" ("id", "pipelineId", "key", "name", "sortOrder", "isTerminal", "updatedAt")
SELECT 'stage_pipe-prospects_' || s.key || '_' || p."brandId", p.id, s.key, s.name, s.ord, s.term, NOW()
FROM "Pipeline" p
JOIN (SELECT brand_id FROM _brands) b ON p."brandId" = b.brand_id
JOIN (VALUES
  ('prospect', 'Prospect', 10, false),
  ('lead',     'Lead',     20, false),
  ('talking',  'Talking',  30, false),
  ('proposed', 'Proposed', 40, false),
  ('won',      'Won',      50, true),
  ('lost',     'Lost',     60, true)
) AS s(key, name, ord, term) ON p.key = 'pipe-prospects'
ON CONFLICT ("pipelineId", "key") DO NOTHING;

-- 5. Ensure the prospects pipeline + education-interest stage for SERVICES tags.
INSERT INTO "Pipeline" ("id", "brandId", "key", "name", "description", "type", "updatedAt")
SELECT 'prospects_' || brand_id, brand_id, 'prospects', 'Prospects Pipeline',
       'Qualify and educate prospects, validate scope, and convert to client after Phase 1 payment and signed agreement.',
       'PROSPECTS'::"PipelineType", NOW()
FROM (SELECT brand_id FROM _brands) b
ON CONFLICT ("brandId", "key") DO NOTHING;

INSERT INTO "PipelineStage" ("id", "pipelineId", "key", "name", "sortOrder", "updatedAt")
SELECT 'stage_prospects_education-interest_' || p."brandId", p.id,
       'education-interest', 'Education + Interest Confirmation', 10, NOW()
FROM "Pipeline" p
JOIN (SELECT brand_id FROM _brands) b ON p."brandId" = b.brand_id
WHERE p.key = 'prospects'
ON CONFLICT ("pipelineId", "key") DO NOTHING;

-- 6. Step tags -> pipe-prospects stages. Enforce the mapped stage and active
-- flag; a row an admin pointed elsewhere is corrected, nothing else touched.
INSERT INTO "contact_tag_automations" ("id", "brandId", "tagId", "pipelineId", "stageId", "isActive", "updatedAt")
SELECT 'auto_' || t.key || '_' || t."brandId", t."brandId", t.id, p.id, st.id, true, NOW()
FROM "contact_tags" t
JOIN (SELECT brand_id FROM _brands) b ON t."brandId" = b.brand_id
JOIN "Pipeline" p ON p."brandId" = t."brandId" AND p.key = 'pipe-prospects'
JOIN "PipelineStage" st ON st."pipelineId" = p.id
  AND st.key = CASE t.key
    WHEN 'business-owner' THEN 'prospect'
    WHEN 'lead'           THEN 'lead'
    WHEN 'talking'        THEN 'talking'
    WHEN 'reached'        THEN 'talking'
    WHEN 'proposed'       THEN 'proposed'
  END
WHERE t.key IN ('business-owner', 'lead', 'talking', 'reached', 'proposed')
ON CONFLICT ("tagId", "pipelineId")
DO UPDATE SET "stageId" = EXCLUDED."stageId", "isActive" = true, "updatedAt" = NOW();

-- 7. Every SERVICES tag -> prospects / education-interest. Same enforcement.
INSERT INTO "contact_tag_automations" ("id", "brandId", "tagId", "pipelineId", "stageId", "isActive", "updatedAt")
SELECT 'auto_' || t.key || '_' || t."brandId", t."brandId", t.id, p.id, st.id, true, NOW()
FROM "contact_tags" t
JOIN (SELECT brand_id FROM _brands) b ON t."brandId" = b.brand_id
JOIN "Pipeline" p ON p."brandId" = t."brandId" AND p.key = 'prospects'
JOIN "PipelineStage" st ON st."pipelineId" = p.id AND st.key = 'education-interest'
WHERE t."kind" = 'SERVICES'
ON CONFLICT ("tagId", "pipelineId")
DO UPDATE SET "stageId" = EXCLUDED."stageId", "isActive" = true, "updatedAt" = NOW();

COMMIT;
