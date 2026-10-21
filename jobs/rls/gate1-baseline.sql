-- RLS gate-1 replay baseline: stub tables for the consolidated production
-- history that was never committed to this repo (see jobs/rls/gate1-baseline.md).
--
-- Apply ONCE to a fresh empty database, BEFORE migration files 1..41 in sort
-- order, with psql -X -v ON_ERROR_STOP=1:
--
--   psql -X -v ON_ERROR_STOP=1 -f jobs/rls/gate1-baseline.sql
--   for d in prisma/migrations/20*/; do
--     psql -X -v ON_ERROR_STOP=1 -f "$d/migration.sql"
--   done
--
-- Every statement is IF NOT EXISTS / DO-guarded so the file is safe to re-run.
-- Column types and defaults are copied verbatim from
-- `prisma migrate diff --from-empty --to-schema-datamodel prisma/schema.prisma`
-- (offline, no database touched). Columns that later migrations ADD with a
-- plain (non-IF-NOT-EXISTS) ADD COLUMN are deliberately OMITTED here so those
-- migrations still apply cleanly; each omission names the migration that adds it.
-- Enum value lists are the current schema.prisma lists; none of the
-- pre-created enums is altered by any repo migration.
--
-- The stubs carry PRIMARY KEYs and the three UNIQUE constraints that migration
-- #17's ON CONFLICT clauses require, but deliberately NO FOREIGN KEY
-- constraints and NO other schema indexes: the baseline applies before file
-- #1 creates Brand/BrandMembership/etc., so FK targets do not exist yet, and
-- the migrations themselves add every FK and index the replay needs
-- (plain duplicate ADDs would fail the replay, IF NOT EXISTS ones just skip).

-- ---------------------------------------------------------------------------
-- Enums referenced by the stub tables below. NOT included: AgreementManagerStatus
-- (created by migration #29 20260903110000 itself, plain CREATE TYPE) and the
-- Integration/Email enums (created by migrations #03/#25/#33 themselves).
-- ---------------------------------------------------------------------------
DO $$ BEGIN
  CREATE TYPE "ContactTagKind" AS ENUM ('CUSTOM', 'PRODUCT_LEAD', 'CLIENT_LEAD', 'INDUSTRY');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "LeadKind" AS ENUM ('LEAD', 'PROSPECT');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "LeadBookkeepingCategory" AS ENUM ('SMALL_BUSINESS', 'REAL_ESTATE_INVESTOR', 'ECOMMERCE', 'PROFESSIONAL_SERVICES', 'OTHER');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "EngagementType" AS ENUM ('MONTHLY_BOOKKEEPING', 'CLEANUP_PROJECT', 'CATCHUP_BOOKKEEPING', 'HOURLY_WORK', 'AUDIT_LENDER_CPA_SUPPORT', 'REAL_ESTATE_CLOSING', 'ADVISORY_CONSULTING', 'OTHER');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "EngagementStatus" AS ENUM ('DRAFT', 'READY_FOR_REVIEW', 'SENT_TO_CLIENT', 'SENT_FOR_SIGNATURE', 'SIGNED', 'INVOICE_SENT', 'DEPOSIT_PAID', 'ONBOARDING_STARTED', 'ACTIVE', 'COMPLETED', 'TERMINATED', 'INTAKE_SENT', 'INTAKE_STARTED', 'INTAKE_SUBMITTED', 'INTAKE_REVIEWED', 'READY_FOR_AGREEMENT', 'AGREEMENT_GENERATED', 'ONBOARDING_PAID', 'DISCOVERY_STARTED', 'VARIATION_PENDING', 'VARIATION_SIGNED', 'IN_PROGRESS', 'QUESTIONS_PENDING', 'REPORTS_IN_REVIEW', 'DELIVERED', 'COMPLETE', 'PAUSED', 'CANCELLED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "EngagementPricingModel" AS ENUM ('FIXED_FEE', 'HOURLY', 'MONTHLY_RECURRING', 'HYBRID');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "ScopingMode" AS ENUM ('AGREEMENT', 'FULLY_SCOPED_FIXED_FEE');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "OnboardingFeeStatus" AS ENUM ('NOT_REQUIRED', 'REQUIRED', 'INVOICED', 'PAID', 'WAIVED', 'INCLUDED_IN_PROJECT_FEE');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "FeeCreditTarget" AS ENUM ('DISCOVERY_DEPOSIT', 'PROJECT_FEE', 'NONE');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "DiscoveryDepositStatus" AS ENUM ('PENDING', 'INVOICED', 'PAID', 'WAIVED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ---------------------------------------------------------------------------
-- 1. catalog_services — canonical table of the CatalogService model (@@map).
-- First unguarded use: #14 20260827200000 (ALTER + CREATE INDEX).
-- OMITTED: "realEstateSpecific" (added plain by #14),
--          "tagId" (added plain by #15 20260827210000).
-- Kept: offer_key/offer_section/default_price/billing_cadence/
-- requires_platform_migration/required_target_platform/applicability_note
-- (added IF NOT EXISTS by #17), default_package_keys (IF NOT EXISTS by #18),
-- product_kind (IF NOT EXISTS by #34).
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "catalog_services" (
    "id" TEXT NOT NULL,
    "brandId" TEXT NOT NULL,
    "code" TEXT,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "card_label" TEXT,
    "client_benefit" TEXT,
    "itemType" TEXT NOT NULL DEFAULT 'cleanup',
    "category" TEXT NOT NULL,
    "priority" INTEGER NOT NULL DEFAULT 500,
    "default_inclusion" TEXT,
    "offer_key" TEXT,
    "offer_section" TEXT NOT NULL DEFAULT 'included-services',
    "default_price" DECIMAL(12,2),
    "billing_cadence" TEXT NOT NULL DEFAULT 'monthly',
    "requires_platform_migration" BOOLEAN NOT NULL DEFAULT false,
    "required_target_platform" TEXT,
    "applicability_note" TEXT,
    "default_package_keys" JSONB,
    "estimatedHours" DECIMAL(6,2),
    "internal_notes" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "product_kind" TEXT NOT NULL DEFAULT 'bookkeeping',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "catalog_services_pkey" PRIMARY KEY ("id")
);

-- ---------------------------------------------------------------------------
-- 2. contact_tags — canonical table of the ContactTag model (@@map).
-- First unguarded use: #15 20260827210000 (FOREIGN KEY target).
-- No migration ADDs columns to it; full schema.prisma column set.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "contact_tags" (
    "id" TEXT NOT NULL,
    "brandId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "kind" "ContactTagKind" NOT NULL DEFAULT 'CUSTOM',
    "color" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 100,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "contact_tags_pkey" PRIMARY KEY ("id"),
    -- Required by migration #17 20260829120000, which does
    -- INSERT INTO "contact_tags" ... ON CONFLICT ("brandId", "key").
    CONSTRAINT "contact_tags_brandId_key_key" UNIQUE ("brandId", "key")
);

-- ---------------------------------------------------------------------------
-- 3. contact_tag_links — canonical table of ContactTagLink (@@map).
-- First unguarded use: #17 20260829120000 (INSERT ... SELECT).
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "contact_tag_links" (
    "id" TEXT NOT NULL,
    "contactId" TEXT NOT NULL,
    "tagId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "contact_tag_links_pkey" PRIMARY KEY ("id"),
    -- Required by migration #17 20260829120000, which does
    -- INSERT INTO "contact_tag_links" ... ON CONFLICT ("contactId", "tagId").
    CONSTRAINT "contact_tag_links_contactId_tagId_key" UNIQUE ("contactId", "tagId")
);

-- ---------------------------------------------------------------------------
-- 4. contact_tag_automations — canonical table of ContactTagAutomation (@@map).
-- First unguarded use: #17 20260829120000 (INSERT ... SELECT).
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "contact_tag_automations" (
    "id" TEXT NOT NULL,
    "brandId" TEXT NOT NULL,
    "tagId" TEXT NOT NULL,
    "pipelineId" TEXT NOT NULL,
    "stageId" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "contact_tag_automations_pkey" PRIMARY KEY ("id"),
    -- Required by migration #17 20260829120000, which does
    -- INSERT INTO "contact_tag_automations" ... ON CONFLICT ("tagId", "pipelineId").
    CONSTRAINT "contact_tag_automations_tagId_pipelineId_key" UNIQUE ("tagId", "pipelineId")
);

-- ---------------------------------------------------------------------------
-- 5. quotes — canonical table of the Quote model (@@map).
-- First unguarded use: #17 20260829120000 (FOREIGN KEY target of
-- quote_revisions); first unguarded ALTER: #21 20260901170000.
-- (Migration #09 20260826000000 is to_regclass-guarded and skips when the
-- table is absent.) OMITTED: "offerCode" (added plain by #31
-- 20260903130000). Kept: publishedSnapshotJson/publicToken/publishedAt
-- (IF NOT EXISTS by #09), firstViewedAt (#21), engagementId (#23),
-- firstSentAt/lastSentAt (#28), lastActivityAt/lastFollowUpAt (#36).
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "quotes" (
    "id" TEXT NOT NULL,
    "brandId" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "kind" TEXT NOT NULL DEFAULT 'bookkeeping',
    "status" TEXT NOT NULL DEFAULT 'draft',
    "packageId" TEXT,
    "totalOneTime" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "totalRecurring" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "onboardingFee" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "snapshotJson" JSONB NOT NULL,
    "publishedSnapshotJson" JSONB,
    "publicToken" TEXT,
    "publishedAt" TIMESTAMP(3),
    "firstViewedAt" TIMESTAMP(3),
    "engagementId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "sentAt" TIMESTAMP(3),
    "firstSentAt" TIMESTAMP(3),
    "lastSentAt" TIMESTAMP(3),
    "lastActivityAt" TIMESTAMP(3),
    "lastFollowUpAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3),

    CONSTRAINT "quotes_pkey" PRIMARY KEY ("id")
);

-- ---------------------------------------------------------------------------
-- 6. BrandMedia — no migration creates it; the lost baseline must have.
-- First unguarded use: #19 20260901160000 (ALTER ADD folderId + index + FK).
-- folderId is added IF NOT EXISTS by #19 itself, so keeping it is safe.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "BrandMedia" (
    "id" TEXT NOT NULL,
    "brandId" TEXT NOT NULL,
    "folderId" TEXT,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BrandMedia_pkey" PRIMARY KEY ("id")
);

-- ---------------------------------------------------------------------------
-- 7. Engagement — no migration creates it; the lost baseline must have.
-- First unguarded use: #23 20260901190000 (FOREIGN KEY target of
-- quotes.engagementId — the DO block only guards on constraint name, not on
-- table existence); first unguarded ALTER: #29 20260903110000.
-- (Migration #12's MeetingLead/Engagement-adjacent UPDATE is
-- to_regclass-guarded.) OMITTED: "agreementManagerStatus" (type created by
-- #29 itself + added plain), "agreementCancellationRequestedAt",
-- "agreementCancellationRequestedByUserId", "agreementCancellationReason"
-- (added plain by #30 20260903120000),
-- "agreementCancellationAcknowledgedAt/AcknowledgedByName/AcknowledgedByEmail"
-- (added plain by #30), "agreementCancellationTokenHash",
-- "agreementCancellationTokenExpiresAt" (added plain by #32 20260903140000).
-- Kept: "productKind" (added IF NOT EXISTS by #34 20260904190000).
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "Engagement" (
    "id" TEXT NOT NULL,
    "brandId" TEXT NOT NULL,
    "clientName" TEXT NOT NULL DEFAULT '',
    "clientLegalName" TEXT NOT NULL DEFAULT '',
    "dba" TEXT,
    "entityType" TEXT,
    "primaryContactName" TEXT,
    "primaryContactEmail" TEXT,
    "primaryContactPhone" TEXT,
    "billingContactName" TEXT,
    "billingContactEmail" TEXT,
    "billingContactPhone" TEXT,
    "businessAddress" TEXT,
    "quickBooksCompanyName" TEXT,
    "relatedEntities" TEXT,
    "clientNotes" TEXT,
    "engagementType" "EngagementType",
    "productKind" TEXT NOT NULL DEFAULT 'bookkeeping',
    "status" "EngagementStatus" NOT NULL DEFAULT 'DRAFT',
    "pricingModel" "EngagementPricingModel",
    "feeAmount" DECIMAL(65,30),
    "hourlyRate" DECIMAL(65,30),
    "depositRequired" BOOLEAN NOT NULL DEFAULT false,
    "depositAmount" DECIMAL(65,30),
    "billingFrequency" TEXT,
    "paymentTerms" TEXT,
    "effectiveDate" TIMESTAMP(3),
    "startDate" TIMESTAMP(3),
    "endDate" TIMESTAMP(3),
    "assignedOwnerMembershipId" TEXT,
    "internalReviewerMembershipId" TEXT,
    "urgencyNotes" TEXT,
    "notes" TEXT,
    "realEstateDetails" JSONB,
    "monthlyScope" JSONB,
    "cleanupScope" JSONB,
    "hourlyScope" JSONB,
    "auditSupportScope" JSONB,
    "exclusions" JSONB,
    "customExclusions" JSONB,
    "intakeTokenHash" TEXT,
    "intakeData" JSONB,
    "onboardingData" JSONB,
    "intakeSubmittedAt" TIMESTAMP(3),
    "intakeExpiresAt" TIMESTAMP(3),
    "salesCallCompleted" BOOLEAN NOT NULL DEFAULT false,
    "salesCallDate" TIMESTAMP(3),
    "salesCallNotes" TEXT,
    "initialClientProblem" TEXT,
    "urgencyOrDeadline" TEXT,
    "initialEstimateDiscussed" TEXT,
    "scopingMode" "ScopingMode" NOT NULL DEFAULT 'AGREEMENT',
    "isExpedited" BOOLEAN NOT NULL DEFAULT false,
    "onboardingFee" DECIMAL(65,30),
    "onboardingFeeWaived" BOOLEAN NOT NULL DEFAULT false,
    "onboardingFeeStatus" "OnboardingFeeStatus" NOT NULL DEFAULT 'REQUIRED',
    "onboardingFeeCreditable" BOOLEAN NOT NULL DEFAULT true,
    "onboardingFeeCreditAppliedTo" "FeeCreditTarget" NOT NULL DEFAULT 'DISCOVERY_DEPOSIT',
    "onboardingFeeCreditAmount" DECIMAL(65,30),
    "estimatedTotalFee" DECIMAL(65,30),
    "discoveryDepositPercent" DECIMAL(65,30) NOT NULL DEFAULT 25,
    "discoveryDepositStatus" "DiscoveryDepositStatus",
    "fullFeeDueUpfront" BOOLEAN NOT NULL DEFAULT false,
    "discoveryRequired" BOOLEAN NOT NULL DEFAULT true,
    "discoveryCompletedAt" TIMESTAMP(3),
    "finalScopeConfirmedAt" TIMESTAMP(3),
    "revisedFeeAmount" DECIMAL(65,30),
    "changeOrderRequired" BOOLEAN NOT NULL DEFAULT false,
    "periodStart" TIMESTAMP(3),
    "periodEnd" TIMESTAMP(3),
    "taxYearsInvolved" TEXT,
    "accountsIncluded" TEXT,
    "creditCardsIncluded" TEXT,
    "loansIncluded" TEXT,
    "payrollInvolved" BOOLEAN NOT NULL DEFAULT false,
    "contractorPaymentsInvolved" BOOLEAN NOT NULL DEFAULT false,
    "missingRecordsKnown" TEXT,
    "knownProblems" TEXT,
    "requiredDocuments" TEXT,
    "deliverables" TEXT,
    "specialReportingPeriodStart" TIMESTAMP(3),
    "specialReportingPeriodEnd" TIMESTAMP(3),
    "specialReportDescription" TEXT,
    "auditPolicyOrLenderSupportRequired" BOOLEAN NOT NULL DEFAULT false,
    "agreementText" TEXT,
    "agreementSentAt" TIMESTAMP(3),
    "agreementTokenHash" TEXT,
    "signerName" TEXT,
    "signerTitle" TEXT,
    "signedAt" TIMESTAMP(3),
    "signerIpAddress" TEXT,
    "signerUserAgent" TEXT,
    "agreementTextHash" TEXT,
    "consentToElectronicSignature" BOOLEAN NOT NULL DEFAULT false,
    "agreementReadAndAgreed" BOOLEAN NOT NULL DEFAULT false,
    "agreementScrolledToEnd" BOOLEAN NOT NULL DEFAULT false,
    "agreementScrolledAt" TIMESTAMP(3),
    "agreementNotes" TEXT,
    "isTestProposal" BOOLEAN NOT NULL DEFAULT false,
    "discoveryTokenHash" TEXT,
    "createdByMembershipId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Engagement_pkey" PRIMARY KEY ("id")
);

-- ---------------------------------------------------------------------------
-- 8. "CatalogService" (PascalCase) — exists NOWHERE: not in schema.prisma
-- (the model maps to catalog_services) and not created by any migration.
-- Migration #38 20260905210000 UPDATEs it (two statements, no guard), so a
-- bare replay fails with: relation "CatalogService" does not exist.
-- This stub exists ONLY to let the historical chain replay; it almost
-- certainly records a casing bug in #38, which on a production database with
-- only catalog_services would fail the same way. Do NOT treat this table as
-- real application state. Minimal columns: exactly what #38 touches, typed
-- per the CatalogService model (name TEXT NOT NULL, description /
-- client_benefit / offer_key nullable TEXT, updatedAt TIMESTAMP NOT NULL).
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "CatalogService" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "client_benefit" TEXT,
    "offer_key" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CatalogService_pkey" PRIMARY KEY ("id")
);

-- ---------------------------------------------------------------------------
-- 9. MeetingLead — no migration creates it; the lost baseline must have.
-- First unguarded use: #40 20261019160000 (nine ADD COLUMN IF NOT EXISTS +
-- unique index + FK DO block); also #41 20261021120000 (leadStep).
-- (Migration #12's MeetingLead reference is to_regclass-guarded.)
-- All later ADDs are IF NOT EXISTS, so the full schema.prisma set is safe.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "MeetingLead" (
    "id" TEXT NOT NULL,
    "brandId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "company" TEXT,
    "email" TEXT,
    "clientId" TEXT,
    "customerAccountId" TEXT,
    "kind" "LeadKind" NOT NULL DEFAULT 'LEAD',
    "bookkeepingCategory" "LeadBookkeepingCategory" NOT NULL DEFAULT 'SMALL_BUSINESS',
    "expectedServices" TEXT,
    "notes" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "pipeId" TEXT,
    "nextAction" TEXT,
    "nextDue" TEXT,
    "amount" DECIMAL(14,2),
    "amountKind" TEXT,
    "invoiceRef" TEXT,
    "invoiceDate" TEXT,
    "yesContactId" TEXT,
    "leadStep" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MeetingLead_pkey" PRIMARY KEY ("id")
);
