-- Reconcile databases whose consolidated baseline predates BrandIntegration.
-- This migration is intentionally additive and idempotent because the connected
-- database has a migration history that diverges from this repository.

BEGIN;

DO $$
BEGIN
  CREATE TYPE "IntegrationProvider" AS ENUM (
    'GA4',
    'GTM',
    'META_ADS',
    'GOOGLE_SEARCH_CONSOLE',
    'GOOGLE_ADS',
    'CLOUDFLARE',
    'STRIPE',
    'PAYPAL',
    'YOUTUBE',
    'QUO',
    'SANITY',
    'OTHER'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END
$$;

DO $$
BEGIN
  CREATE TYPE "IntegrationStatus" AS ENUM (
    'DISCONNECTED',
    'PENDING',
    'ACTIVE',
    'ERROR',
    'SUSPENDED'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END
$$;

DO $$
BEGIN
  CREATE TYPE "IntegrationAssetOwner" AS ENUM (
    'BRAND',
    'SOUTHWEST_DIGITAL',
    'THIRD_PARTY'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END
$$;

CREATE TABLE IF NOT EXISTS "BrandIntegration" (
  "id" TEXT NOT NULL,
  "brandId" TEXT NOT NULL,
  "key" TEXT NOT NULL,
  "provider" "IntegrationProvider" NOT NULL,
  "status" "IntegrationStatus" NOT NULL DEFAULT 'DISCONNECTED',
  "assetOwner" "IntegrationAssetOwner" NOT NULL DEFAULT 'BRAND',
  "displayName" TEXT,
  "externalAccountId" TEXT,
  "externalPropertyId" TEXT,
  "publicIdentifier" TEXT,
  "notes" TEXT,
  "publicConfig" JSONB,
  "secretCiphertext" TEXT,
  "secretKeyVersion" INTEGER,
  "secretReference" TEXT,
  "lastVerifiedAt" TIMESTAMP(3),
  "lastErrorAt" TIMESTAMP(3),
  "lastErrorCode" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "BrandIntegration_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "BrandIntegration_brandId_key_key"
  ON "BrandIntegration"("brandId", "key");

CREATE INDEX IF NOT EXISTS "BrandIntegration_brandId_provider_status_idx"
  ON "BrandIntegration"("brandId", "provider", "status");

CREATE INDEX IF NOT EXISTS "BrandIntegration_brandId_assetOwner_idx"
  ON "BrandIntegration"("brandId", "assetOwner");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'BrandIntegration_brandId_fkey'
      AND conrelid = '"BrandIntegration"'::regclass
  ) THEN
    ALTER TABLE "BrandIntegration"
      ADD CONSTRAINT "BrandIntegration_brandId_fkey"
      FOREIGN KEY ("brandId") REFERENCES "Brand"("id")
      ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END
$$;

COMMIT;
