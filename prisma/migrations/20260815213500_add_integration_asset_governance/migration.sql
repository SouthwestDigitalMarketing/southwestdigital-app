-- CreateEnum
CREATE TYPE "IntegrationAssetOwner" AS ENUM ('BRAND', 'SOUTHWEST_DIGITAL', 'THIRD_PARTY');

-- AlterTable
ALTER TABLE "BrandIntegration"
ADD COLUMN "assetOwner" "IntegrationAssetOwner" NOT NULL DEFAULT 'BRAND',
ADD COLUMN "externalAccountId" TEXT,
ADD COLUMN "externalPropertyId" TEXT,
ADD COLUMN "publicIdentifier" TEXT,
ADD COLUMN "notes" TEXT;

-- CreateIndex
CREATE INDEX "BrandIntegration_brandId_assetOwner_idx" ON "BrandIntegration"("brandId", "assetOwner");
