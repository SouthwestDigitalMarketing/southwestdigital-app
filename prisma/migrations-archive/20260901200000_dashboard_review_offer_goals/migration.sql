-- Dashboard goals for review and offer cards.
ALTER TABLE "BrandTheme" ADD COLUMN IF NOT EXISTS "monthlyReviewRequestsGoal" INTEGER;
ALTER TABLE "BrandTheme" ADD COLUMN IF NOT EXISTS "reviewOpenRateGoal" INTEGER;
ALTER TABLE "BrandTheme" ADD COLUMN IF NOT EXISTS "reviewFiveStarRateGoal" INTEGER;
ALTER TABLE "BrandTheme" ADD COLUMN IF NOT EXISTS "monthlyOffersSentGoal" INTEGER;
ALTER TABLE "BrandTheme" ADD COLUMN IF NOT EXISTS "monthlyOffersAcceptedGoal" INTEGER;
