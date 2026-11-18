-- Add per-membership email connections so staff can send email to clients
-- from within the app via their connected mailbox (Zoho today; Gmail /
-- Microsoft / SMTP reserved for future providers).
--
-- Additive and idempotent. Every DDL guard is IF NOT EXISTS or wrapped in a
-- DO block so re-running against a database that already contains the schema
-- is safe.

BEGIN;

DO $$ BEGIN
  CREATE TYPE "EmailConnectionProvider" AS ENUM ('ZOHO', 'GMAIL', 'MICROSOFT', 'SMTP');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "EmailConnectionStatus" AS ENUM ('ACTIVE', 'EXPIRED', 'REVOKED', 'ERROR');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS "EmailConnection" (
  "id"                     TEXT NOT NULL,
  "brandId"                TEXT NOT NULL,
  "membershipId"           TEXT NOT NULL,
  "provider"               "EmailConnectionProvider" NOT NULL,
  "region"                 TEXT,
  "emailAddress"           TEXT NOT NULL,
  "displayName"            TEXT,
  "accountIdentifier"      TEXT,
  "accessTokenCiphertext"  TEXT NOT NULL,
  "refreshTokenCiphertext" TEXT NOT NULL,
  "accessTokenExpiresAt"   TIMESTAMP(3),
  "scopes"                 TEXT,
  "status"                 "EmailConnectionStatus" NOT NULL DEFAULT 'ACTIVE',
  "lastError"              TEXT,
  "lastVerifiedAt"         TIMESTAMP(3),
  "createdAt"              TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"              TIMESTAMP(3) NOT NULL,

  CONSTRAINT "EmailConnection_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "EmailConnection_membershipId_key"
  ON "EmailConnection"("membershipId");

CREATE INDEX IF NOT EXISTS "EmailConnection_brandId_idx"
  ON "EmailConnection"("brandId");

CREATE INDEX IF NOT EXISTS "EmailConnection_brandId_status_provider_idx"
  ON "EmailConnection"("brandId", "status", "provider");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'EmailConnection_brandId_fkey'
      AND conrelid = '"EmailConnection"'::regclass
  ) THEN
    ALTER TABLE "EmailConnection"
      ADD CONSTRAINT "EmailConnection_brandId_fkey"
      FOREIGN KEY ("brandId") REFERENCES "Brand"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'EmailConnection_membershipId_fkey'
      AND conrelid = '"EmailConnection"'::regclass
  ) THEN
    ALTER TABLE "EmailConnection"
      ADD CONSTRAINT "EmailConnection_membershipId_fkey"
      FOREIGN KEY ("membershipId") REFERENCES "BrandMembership"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END
$$;

COMMIT;
