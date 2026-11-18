-- Showrunner feedback: Tom's reaction (like, drop, change) and note on a suggested series or one of its episodes.
-- Additive only. Idempotent. Brand-scoped like the Scanner tables.
-- Apply with prisma db execute against DIRECT_DATABASE_URL (port 5432).
-- Do not use migrate dev or migrate deploy. Do not use the transaction pooler (port 6543).

CREATE TABLE IF NOT EXISTS "ShowrunnerFeedback" (
  "id" TEXT NOT NULL,
  "brandId" TEXT NOT NULL,
  "seriesSlug" TEXT NOT NULL,
  "episodeIndex" INTEGER,
  "reaction" TEXT NOT NULL,
  "note" TEXT,
  "actorUserId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ShowrunnerFeedback_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ShowrunnerFeedback_reaction_check" CHECK ("reaction" IN ('like', 'drop', 'change')),
  CONSTRAINT "ShowrunnerFeedback_slug_check" CHECK (char_length("seriesSlug") BETWEEN 1 AND 100),
  CONSTRAINT "ShowrunnerFeedback_episode_check" CHECK ("episodeIndex" IS NULL OR "episodeIndex" BETWEEN 0 AND 99),
  CONSTRAINT "ShowrunnerFeedback_note_check" CHECK ("note" IS NULL OR char_length("note") <= 2000),
  CONSTRAINT "ShowrunnerFeedback_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "Brand"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX IF NOT EXISTS "ShowrunnerFeedback_brandId_seriesSlug_createdAt_idx" ON "ShowrunnerFeedback"("brandId", "seriesSlug", "createdAt");

ALTER TABLE "ShowrunnerFeedback" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ShowrunnerFeedback" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "showrunner_feedback_brand_context" ON "ShowrunnerFeedback";
CREATE POLICY "showrunner_feedback_brand_context" ON "ShowrunnerFeedback"
TO PUBLIC
USING ("brandId" = NULLIF(current_setting('app.current_brand_id', true), ''))
WITH CHECK ("brandId" = NULLIF(current_setting('app.current_brand_id', true), ''));
