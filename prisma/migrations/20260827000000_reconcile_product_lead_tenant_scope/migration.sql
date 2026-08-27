-- Bring the existing product lead/contact join under the Brand tenant boundary.
-- Existing rows derive their brand from the related MeetingLead before the
-- column becomes required and forced RLS is enabled.

-- The product history added these membership controls before a complete
-- Prisma baseline existed. Add the defaulted columns to disposable platform
-- databases while leaving established product databases unchanged.
ALTER TABLE "BrandMembership"
  ADD COLUMN IF NOT EXISTS "isPayrollManager" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "canAccessTickets" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "canUseFocus" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS "hasSeenFocusOnboarding" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE "BrandTheme"
  ADD COLUMN IF NOT EXISTS "monthlyViewsGoal" INTEGER,
  ADD COLUMN IF NOT EXISTS "monthlyClicksGoal" INTEGER,
  ADD COLUMN IF NOT EXISTS "avgWatchDurationGoal" INTEGER,
  ADD COLUMN IF NOT EXISTS "monthlyKeyEventsGoal" INTEGER,
  ADD COLUMN IF NOT EXISTS "ga4PropertyId" TEXT,
  ADD COLUMN IF NOT EXISTS "ga4HostName" TEXT,
  ADD COLUMN IF NOT EXISTS "youtubeChannelId" TEXT,
  ADD COLUMN IF NOT EXISTS "youtubeHandle" TEXT,
  ADD COLUMN IF NOT EXISTS "youtubeWatchPercentageGoal" DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS "websiteEngagedSessionsGoal" INTEGER,
  ADD COLUMN IF NOT EXISTS "proposalFeaturedVideoUrl" TEXT,
  ADD COLUMN IF NOT EXISTS "proposalFeaturedImageUrl" TEXT;

ALTER TABLE "Contact"
  ADD COLUMN IF NOT EXISTS "name" TEXT,
  ADD COLUMN IF NOT EXISTS "company" TEXT,
  ADD COLUMN IF NOT EXISTS "notes" TEXT,
  ADD COLUMN IF NOT EXISTS "isActive" BOOLEAN NOT NULL DEFAULT true;

UPDATE "Contact" SET "name" = COALESCE("name", "id") WHERE "name" IS NULL;
ALTER TABLE "Contact" ALTER COLUMN "name" SET NOT NULL;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'Contact'
      AND column_name = 'displayName'
  ) THEN
    ALTER TABLE "Contact" ALTER COLUMN "displayName" DROP NOT NULL;
  END IF;
END $$;

ALTER TABLE "LeadContact" ADD COLUMN IF NOT EXISTS "brandId" TEXT;

DO $$
BEGIN
  IF to_regclass('public."MeetingLead"') IS NOT NULL THEN
    EXECUTE $sql$
      UPDATE "LeadContact" AS link
      SET "brandId" = lead."brandId"
      FROM "MeetingLead" AS lead
      WHERE link."leadId" = lead."id"
        AND link."brandId" IS NULL
    $sql$;
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM "LeadContact" WHERE "brandId" IS NULL) THEN
    RAISE EXCEPTION 'LeadContact contains rows whose brand could not be reconciled';
  END IF;
END $$;

ALTER TABLE "LeadContact" ALTER COLUMN "brandId" SET NOT NULL;

CREATE INDEX IF NOT EXISTS "LeadContact_brandId_contactId_createdAt_idx"
  ON "LeadContact"("brandId", "contactId", "createdAt");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'LeadContact_brandId_fkey'
  ) THEN
    ALTER TABLE "LeadContact"
      ADD CONSTRAINT "LeadContact_brandId_fkey"
      FOREIGN KEY ("brandId") REFERENCES "Brand"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

ALTER TABLE "LeadContact" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "LeadContact" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "lead_contact_brand_context" ON "LeadContact";
CREATE POLICY "lead_contact_brand_context" ON "LeadContact"
TO PUBLIC
USING ("brandId" = NULLIF(current_setting('app.current_brand_id', true), ''))
WITH CHECK ("brandId" = NULLIF(current_setting('app.current_brand_id', true), ''));
