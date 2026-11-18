-- Track when a lead first opens a published proposal, and when a catalog
-- discount should appear (immediately vs after they view and wait).

ALTER TABLE "quotes" ADD COLUMN IF NOT EXISTS "firstViewedAt" TIMESTAMP(3);

ALTER TABLE "BrandDiscount" ADD COLUMN IF NOT EXISTS "activationMode" TEXT NOT NULL DEFAULT 'after-view';
ALTER TABLE "BrandDiscount" ADD COLUMN IF NOT EXISTS "activationDelayDays" INTEGER NOT NULL DEFAULT 7;
