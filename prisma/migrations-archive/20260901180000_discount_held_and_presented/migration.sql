-- Discounts are either shown on first open, or held until staff turns them on.
-- presentedAt is set when a held discount is turned on later.

ALTER TABLE "BrandDiscount" ADD COLUMN IF NOT EXISTS "presentedAt" TIMESTAMP(3);
ALTER TABLE "BrandDiscount" ALTER COLUMN "activationMode" SET DEFAULT 'held';
ALTER TABLE "BrandDiscount" ALTER COLUMN "activationDelayDays" SET DEFAULT 0;
