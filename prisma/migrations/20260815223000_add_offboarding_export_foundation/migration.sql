-- CreateEnum
CREATE TYPE "OffboardingPlanStatus" AS ENUM ('PLANNED', 'IN_PROGRESS', 'CANCELLED', 'COMPLETED');

-- CreateEnum
CREATE TYPE "BrandDataExportStatus" AS ENUM ('REQUESTED', 'PROCESSING', 'READY', 'FAILED', 'EXPIRED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "BrandDataExportFormat" AS ENUM ('JSONL_ZIP_V1');

-- CreateEnum
CREATE TYPE "BrandDataExportScope" AS ENUM ('BRAND_CONFIGURATION', 'CRM', 'INTEGRATION_METADATA', 'AUDIT_HISTORY', 'DOCUMENTS', 'WEBSITE_CONTENT');

-- CreateTable
CREATE TABLE "BrandOffboardingPlan" (
    "id" TEXT NOT NULL,
    "brandId" TEXT NOT NULL,
    "status" "OffboardingPlanStatus" NOT NULL DEFAULT 'PLANNED',
    "serviceEndsAt" TIMESTAMP(3) NOT NULL,
    "accessEndsAt" TIMESTAMP(3) NOT NULL,
    "retentionEndsAt" TIMESTAMP(3) NOT NULL,
    "reason" TEXT,
    "initiatedByUserId" TEXT,
    "startedAt" TIMESTAMP(3),
    "cancelledAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BrandOffboardingPlan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BrandDataExport" (
    "id" TEXT NOT NULL,
    "brandId" TEXT NOT NULL,
    "offboardingPlanId" TEXT,
    "requestedByUserId" TEXT,
    "status" "BrandDataExportStatus" NOT NULL DEFAULT 'REQUESTED',
    "format" "BrandDataExportFormat" NOT NULL DEFAULT 'JSONL_ZIP_V1',
    "requestedScopes" "BrandDataExportScope"[] NOT NULL,
    "manifestVersion" INTEGER NOT NULL DEFAULT 1,
    "storageProvider" TEXT,
    "storageKey" TEXT,
    "checksumSha256" TEXT,
    "byteSize" BIGINT,
    "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3),
    "failedAt" TIMESTAMP(3),
    "failureCode" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BrandDataExport_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "BrandOffboardingPlan_brandId_status_idx" ON "BrandOffboardingPlan"("brandId", "status");

-- CreateIndex
CREATE INDEX "BrandOffboardingPlan_status_accessEndsAt_idx" ON "BrandOffboardingPlan"("status", "accessEndsAt");

-- Only one live offboarding plan may exist for a brand.
CREATE UNIQUE INDEX "BrandOffboardingPlan_one_live_per_brand_idx"
ON "BrandOffboardingPlan"("brandId")
WHERE "status" IN ('PLANNED', 'IN_PROGRESS');

-- CreateIndex
CREATE INDEX "BrandDataExport_brandId_status_requestedAt_idx" ON "BrandDataExport"("brandId", "status", "requestedAt");

-- CreateIndex
CREATE INDEX "BrandDataExport_status_requestedAt_idx" ON "BrandDataExport"("status", "requestedAt");

-- CreateIndex
CREATE INDEX "BrandDataExport_offboardingPlanId_idx" ON "BrandDataExport"("offboardingPlanId");

-- Avoid duplicate concurrent exports while permitting historical ready/failed jobs.
CREATE UNIQUE INDEX "BrandDataExport_one_active_per_brand_idx"
ON "BrandDataExport"("brandId")
WHERE "status" IN ('REQUESTED', 'PROCESSING');

-- AddForeignKey
ALTER TABLE "BrandOffboardingPlan" ADD CONSTRAINT "BrandOffboardingPlan_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "Brand"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BrandOffboardingPlan" ADD CONSTRAINT "BrandOffboardingPlan_initiatedByUserId_fkey" FOREIGN KEY ("initiatedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BrandDataExport" ADD CONSTRAINT "BrandDataExport_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "Brand"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BrandDataExport" ADD CONSTRAINT "BrandDataExport_offboardingPlanId_fkey" FOREIGN KEY ("offboardingPlanId") REFERENCES "BrandOffboardingPlan"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BrandDataExport" ADD CONSTRAINT "BrandDataExport_requestedByUserId_fkey" FOREIGN KEY ("requestedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
