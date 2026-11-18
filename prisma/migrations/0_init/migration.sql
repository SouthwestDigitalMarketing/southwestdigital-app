-- Baseline of the production schema, 2026-11-18.
--
-- Generated with `prisma migrate diff --from-empty --to-schema-datamodel`
-- after prisma/schema.prisma was reconciled with production, then edited by
-- hand for what Prisma cannot express: the partial unique index on
-- ProposalOptionsTemplate and the row-level security at the end. The older
-- migrations that built production are kept in prisma/migrations-archive/.
-- See docs/deployment/database-migrations.md.

-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "PlatformRole" AS ENUM ('NONE', 'ADMIN', 'OWNER');

-- CreateEnum
CREATE TYPE "UserStatus" AS ENUM ('INVITED', 'ACTIVE', 'SUSPENDED', 'FORMER');

-- CreateEnum
CREATE TYPE "BrandStatus" AS ENUM ('DRAFT', 'ACTIVE', 'SUSPENDED', 'OFFBOARDING', 'DELETED');

-- CreateEnum
CREATE TYPE "BrandRole" AS ENUM ('VIEWER', 'MEMBER', 'ADMIN', 'OWNER');

-- CreateEnum
CREATE TYPE "MembershipStatus" AS ENUM ('INVITED', 'ACTIVE', 'SUSPENDED');

-- CreateEnum
CREATE TYPE "DomainPurpose" AS ENUM ('APP', 'WEBSITE');

-- CreateEnum
CREATE TYPE "DomainStatus" AS ENUM ('PENDING', 'VERIFIED', 'DISABLED');

-- CreateEnum
CREATE TYPE "IntegrationProvider" AS ENUM ('GA4', 'GTM', 'META_ADS', 'GOOGLE_SEARCH_CONSOLE', 'GOOGLE_ADS', 'CLOUDFLARE', 'STRIPE', 'PAYPAL', 'YOUTUBE', 'QUO', 'SANITY', 'OTHER');

-- CreateEnum
CREATE TYPE "IntegrationStatus" AS ENUM ('DISCONNECTED', 'PENDING', 'ACTIVE', 'ERROR', 'SUSPENDED');

-- CreateEnum
CREATE TYPE "IntegrationAssetOwner" AS ENUM ('BRAND', 'SOUTHWEST_DIGITAL', 'THIRD_PARTY');

-- CreateEnum
CREATE TYPE "OffboardingPlanStatus" AS ENUM ('PLANNED', 'IN_PROGRESS', 'CANCELLED', 'COMPLETED');

-- CreateEnum
CREATE TYPE "BrandDataExportStatus" AS ENUM ('REQUESTED', 'PROCESSING', 'READY', 'FAILED', 'EXPIRED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "BrandDataExportFormat" AS ENUM ('JSONL_ZIP_V1');

-- CreateEnum
CREATE TYPE "BrandDataExportScope" AS ENUM ('BRAND_CONFIGURATION', 'CRM', 'INTEGRATION_METADATA', 'AUDIT_HISTORY', 'DOCUMENTS', 'WEBSITE_CONTENT');

-- CreateEnum
CREATE TYPE "AuditActorType" AS ENUM ('USER', 'SYSTEM');

-- CreateEnum
CREATE TYPE "CustomerStatus" AS ENUM ('PROSPECT', 'ACTIVE', 'INACTIVE', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "ContactStatus" AS ENUM ('ACTIVE', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "MarketingConsentStatus" AS ENUM ('UNKNOWN', 'GRANTED', 'DENIED');

-- CreateEnum
CREATE TYPE "LeadStatus" AS ENUM ('NEW', 'CONTACTED', 'QUALIFIED', 'PROPOSAL', 'WON', 'LOST', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "AttributionTouchType" AS ENUM ('FIRST_TOUCH', 'LAST_TOUCH', 'CONVERSION', 'OTHER');

-- CreateEnum
CREATE TYPE "AccountType" AS ENUM ('CONTRACTOR', 'INTERN', 'ADMIN', 'STAFF');

-- CreateEnum
CREATE TYPE "InvoiceStatus" AS ENUM ('DRAFT', 'SUBMITTED', 'APPROVED', 'PAID');

-- CreateEnum
CREATE TYPE "OnboardingFlowAudience" AS ENUM ('OWNER', 'ADMIN', 'MEMBER', 'VIEWER');

-- CreateEnum
CREATE TYPE "OnboardingQuestionStatus" AS ENUM ('OPEN', 'ANSWERED', 'RESOLVED');

-- CreateEnum
CREATE TYPE "OnboardingStepType" AS ENUM ('VIDEO', 'FORM', 'ACK', 'LINK', 'FILE_UPLOAD');

-- CreateEnum
CREATE TYPE "CredentialIcon" AS ENUM ('AWARD', 'CERTIFICATE', 'BOOK', 'STAR', 'CHECK', 'GRAD_CAP');

-- CreateEnum
CREATE TYPE "TicketStatus" AS ENUM ('NOT_STARTED', 'IN_PROGRESS', 'BLOCKED', 'AWAITING_CLIENT_RESPONSE', 'CANCELLED', 'CLOSED');

-- CreateEnum
CREATE TYPE "TicketUrgency" AS ENUM ('LOW', 'MEDIUM', 'HIGH');

-- CreateEnum
CREATE TYPE "TicketType" AS ENUM ('MONTHLY_BOOKKEEPING', 'CLEANUP_CATCH_UP_WORK', 'CLIENT_COORDINATION', 'SYSTEM_TROUBLESHOOTING_SUPPORT');

-- CreateEnum
CREATE TYPE "TicketRoleNeeded" AS ENUM ('BOOKKEEPER', 'CEO');

-- CreateEnum
CREATE TYPE "TicketCoordinationLevel" AS ENUM ('NONE', 'ONE_EMAIL_REPLY', 'ONE_EMAIL_IN_PERSON', 'ONE_EMAIL_VIRTUAL', 'TWO_TO_FIVE_EMAILS', 'TWO_TO_FIVE_EMAILS_IN_PERSON', 'TWO_TO_FIVE_EMAILS_MULTI_VIRTUAL');

-- CreateEnum
CREATE TYPE "PipelineType" AS ENUM ('PROSPECTS', 'LEADS', 'CUSTOM');

-- CreateEnum
CREATE TYPE "LeadKind" AS ENUM ('LEAD', 'PROSPECT');

-- CreateEnum
CREATE TYPE "ContactTagKind" AS ENUM ('CUSTOM', 'SERVICES', 'LEAD', 'INDUSTRY', 'STATUS', 'REVIEWS_GIVEN');

-- CreateEnum
CREATE TYPE "LeadBookkeepingCategory" AS ENUM ('SMALL_BUSINESS', 'REAL_ESTATE_INVESTOR', 'ECOMMERCE', 'PROFESSIONAL_SERVICES', 'OTHER');

-- CreateEnum
CREATE TYPE "ReviewChannel" AS ENUM ('SMS', 'EMAIL', 'BOTH');

-- CreateEnum
CREATE TYPE "ReviewOutcome" AS ENUM ('FIVE_STAR', 'FEEDBACK');

-- CreateEnum
CREATE TYPE "ContentCalendarStatus" AS ENUM ('PLANNED', 'PRODUCED', 'PUBLISHED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "StandardsCheckStatus" AS ENUM ('HITTING', 'NEEDS_WORK', 'NA', 'NOT_REVIEWED');

-- CreateEnum
CREATE TYPE "EngagementType" AS ENUM ('MONTHLY_BOOKKEEPING', 'CLEANUP_PROJECT', 'CATCHUP_BOOKKEEPING', 'HOURLY_WORK', 'AUDIT_LENDER_CPA_SUPPORT', 'REAL_ESTATE_CLOSING', 'ADVISORY_CONSULTING', 'OTHER');

-- CreateEnum
CREATE TYPE "EngagementStatus" AS ENUM ('DRAFT', 'READY_FOR_REVIEW', 'SENT_TO_CLIENT', 'SENT_FOR_SIGNATURE', 'SIGNED', 'INVOICE_SENT', 'DEPOSIT_PAID', 'ONBOARDING_STARTED', 'ACTIVE', 'COMPLETED', 'TERMINATED', 'INTAKE_SENT', 'INTAKE_STARTED', 'INTAKE_SUBMITTED', 'INTAKE_REVIEWED', 'READY_FOR_AGREEMENT', 'AGREEMENT_GENERATED', 'ONBOARDING_PAID', 'DISCOVERY_STARTED', 'VARIATION_PENDING', 'VARIATION_SIGNED', 'IN_PROGRESS', 'QUESTIONS_PENDING', 'REPORTS_IN_REVIEW', 'DELIVERED', 'COMPLETE', 'PAUSED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "AgreementManagerStatus" AS ENUM ('ACTIVE', 'VOIDED', 'ARCHIVED', 'VOIDED_BEFORE_SIGNATURE', 'CANCELLATION_REQUESTED', 'TERMINATED_AFTER_SIGNATURE');

-- CreateEnum
CREATE TYPE "EngagementPricingModel" AS ENUM ('FIXED_FEE', 'HOURLY', 'MONTHLY_RECURRING', 'HYBRID');

-- CreateEnum
CREATE TYPE "ScopingMode" AS ENUM ('AGREEMENT', 'FULLY_SCOPED_FIXED_FEE');

-- CreateEnum
CREATE TYPE "OnboardingFeeStatus" AS ENUM ('NOT_REQUIRED', 'REQUIRED', 'INVOICED', 'PAID', 'WAIVED', 'INCLUDED_IN_PROJECT_FEE');

-- CreateEnum
CREATE TYPE "FeeCreditTarget" AS ENUM ('DISCOVERY_DEPOSIT', 'PROJECT_FEE', 'NONE');

-- CreateEnum
CREATE TYPE "DiscoveryDepositStatus" AS ENUM ('PENDING', 'INVOICED', 'PAID', 'WAIVED');

-- CreateEnum
CREATE TYPE "ProposalCatalogScenario" AS ENUM ('MONTHLY_BOOKKEEPING', 'HISTORICAL_CLEANUP', 'HOURLY_WORK');

-- CreateEnum
CREATE TYPE "ProposalPackagePriceMode" AS ENUM ('BASE_MULTIPLIER', 'FIXED');

-- CreateEnum
CREATE TYPE "ProposalFeatureKind" AS ENUM ('INCLUDED', 'UPGRADE', 'SUPPORT', 'TECH_REQUIREMENT');

-- CreateEnum
CREATE TYPE "MemberEngagementType" AS ENUM ('W2_US', 'CONTRACTOR_US_1099', 'CONTRACTOR_INTL');

-- CreateEnum
CREATE TYPE "MemberRoleProfile" AS ENUM ('BOOKKEEPER_INTERN', 'BOOKKEEPER_EMPLOYEE', 'ADMIN', 'MEDIA', 'OTHER');

-- CreateEnum
CREATE TYPE "MemberRiskLevel" AS ENUM ('LOW', 'MEDIUM', 'HIGH');

-- CreateEnum
CREATE TYPE "MemberI9Status" AS ENUM ('NOT_STARTED', 'PENDING_REVIEW', 'VERIFIED', 'REJECTED');

-- CreateEnum
CREATE TYPE "MemberTaxStatus" AS ENUM ('NOT_REQUIRED', 'NOT_STARTED', 'SUBMITTED', 'APPROVED');

-- CreateEnum
CREATE TYPE "MemberTinType" AS ENUM ('SSN', 'EIN');

-- CreateEnum
CREATE TYPE "MemberPaymentMethod" AS ENUM ('WISE', 'ACH', 'CHECK', 'PAYPAL', 'OTHER');

-- CreateEnum
CREATE TYPE "MemberPayCadence" AS ENUM ('WEEKLY', 'BIWEEKLY', 'MONTHLY', 'ADHOC');

-- CreateEnum
CREATE TYPE "MemberBackgroundCheckStatus" AS ENUM ('NOT_REQUIRED', 'NOT_STARTED', 'CONSENTED', 'IN_PROGRESS', 'PASSED', 'FAILED', 'NEEDS_REVIEW');

-- CreateEnum
CREATE TYPE "MemberOnboardingStatus" AS ENUM ('INCOMPLETE', 'PENDING_DOCS', 'READY_TO_ACTIVATE', 'ACTIVE', 'INACTIVE');

-- CreateEnum
CREATE TYPE "MemberDocumentType" AS ENUM ('I9_IDENTITY', 'I9_WORK_AUTH', 'W4', 'W9', 'CONTRACT', 'NDA', 'BACKGROUND_AUTH', 'RESUME', 'OTHER');

-- CreateEnum
CREATE TYPE "OnboardingTrack" AS ENUM ('INTERN', 'EMPLOYEE', 'CONTRACTOR');

-- CreateEnum
CREATE TYPE "EmailConnectionProvider" AS ENUM ('ZOHO', 'GMAIL', 'MICROSOFT', 'SMTP');

-- CreateEnum
CREATE TYPE "EmailConnectionStatus" AS ENUM ('ACTIVE', 'EXPIRED', 'REVOKED', 'ERROR');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "name" TEXT,
    "email" TEXT NOT NULL,
    "emailVerified" TIMESTAMP(3),
    "image" TEXT,
    "status" "UserStatus" NOT NULL DEFAULT 'INVITED',
    "platformRole" "PlatformRole" NOT NULL DEFAULT 'NONE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Account" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "providerAccountId" TEXT NOT NULL,
    "refresh_token" TEXT,
    "access_token" TEXT,
    "expires_at" INTEGER,
    "token_type" TEXT,
    "scope" TEXT,
    "id_token" TEXT,
    "session_state" TEXT,

    CONSTRAINT "Account_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Session" (
    "id" TEXT NOT NULL,
    "sessionToken" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "expires" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VerificationToken" (
    "identifier" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "expires" TIMESTAMP(3) NOT NULL
);

-- CreateTable
CREATE TABLE "Brand" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "legalName" TEXT,
    "status" "BrandStatus" NOT NULL DEFAULT 'DRAFT',
    "subscriptionStartedAt" TIMESTAMP(3),
    "subscriptionEndedAt" TIMESTAMP(3),
    "accessEndsAt" TIMESTAMP(3),
    "dataExportedAt" TIMESTAMP(3),
    "retentionEndsAt" TIMESTAMP(3),
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Brand_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BrandDomain" (
    "id" TEXT NOT NULL,
    "brandId" TEXT NOT NULL,
    "hostname" TEXT NOT NULL,
    "purpose" "DomainPurpose" NOT NULL DEFAULT 'APP',
    "status" "DomainStatus" NOT NULL DEFAULT 'PENDING',
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,
    "verifiedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BrandDomain_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LocalSeoConfig" (
    "id" TEXT NOT NULL,
    "brandId" TEXT NOT NULL,
    "gridSize" INTEGER NOT NULL DEFAULT 7,
    "spacingMiles" DOUBLE PRECISION NOT NULL DEFAULT 1,
    "keywords" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LocalSeoConfig_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LocalSeoScan" (
    "id" TEXT NOT NULL,
    "brandId" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "scheduleKey" TEXT,
    "status" TEXT NOT NULL DEFAULT 'queued',
    "gridSize" INTEGER NOT NULL,
    "spacingMiles" DOUBLE PRECISION NOT NULL,
    "keywords" JSONB NOT NULL,
    "estimatedCostUsd" DOUBLE PRECISION NOT NULL,
    "actualCostUsd" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "error" TEXT,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "LocalSeoScan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LocalSeoGridCell" (
    "id" TEXT NOT NULL,
    "scanId" TEXT NOT NULL,
    "keyword" TEXT NOT NULL,
    "row" INTEGER NOT NULL,
    "column" INTEGER NOT NULL,
    "latitude" DOUBLE PRECISION NOT NULL,
    "longitude" DOUBLE PRECISION NOT NULL,
    "providerTaskId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'queued',
    "rank" INTEGER,
    "competitors" JSONB NOT NULL DEFAULT '[]',
    "error" TEXT,

    CONSTRAINT "LocalSeoGridCell_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BrandMembership" (
    "id" TEXT NOT NULL,
    "brandId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" "BrandRole" NOT NULL DEFAULT 'MEMBER',
    "status" "MembershipStatus" NOT NULL DEFAULT 'INVITED',
    "accountType" "AccountType",
    "employeeNumber" INTEGER,
    "isPayrollManager" BOOLEAN NOT NULL DEFAULT false,
    "canAccessTickets" BOOLEAN NOT NULL DEFAULT false,
    "canUseFocus" BOOLEAN NOT NULL DEFAULT true,
    "hasSeenFocusOnboarding" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BrandMembership_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BrandTheme" (
    "id" TEXT NOT NULL,
    "brandId" TEXT NOT NULL,
    "logoUrl" TEXT,
    "logoMarkUrl" TEXT,
    "logoDarkUrl" TEXT,
    "logoMarkDarkUrl" TEXT,
    "sidebarLogoType" TEXT NOT NULL DEFAULT 'mark',
    "logoAlt" TEXT,
    "mode" TEXT NOT NULL DEFAULT 'system',
    "themePreset" TEXT NOT NULL DEFAULT 'brand-colors',
    "primaryColor" TEXT NOT NULL DEFAULT '#17324d',
    "darkColor" TEXT,
    "accentColor" TEXT NOT NULL DEFAULT '#d79b3b',
    "backgroundColor" TEXT NOT NULL DEFAULT '#f7f8fa',
    "foregroundColor" TEXT NOT NULL DEFAULT '#17202a',
    "supportEmail" TEXT,
    "monthlyMrrGoal" INTEGER,
    "leadMrrGoal" INTEGER,
    "monthlyViewsGoal" INTEGER,
    "monthlyClicksGoal" INTEGER,
    "avgWatchDurationGoal" INTEGER,
    "monthlyKeyEventsGoal" INTEGER,
    "ga4PropertyId" TEXT,
    "ga4HostName" TEXT,
    "youtubeChannelId" TEXT,
    "youtubeHandle" TEXT,
    "youtubeWatchPercentageGoal" DOUBLE PRECISION,
    "websiteEngagedSessionsGoal" INTEGER,
    "monthlyReviewRequestsGoal" INTEGER,
    "reviewOpenRateGoal" INTEGER,
    "reviewFiveStarRateGoal" INTEGER,
    "monthlyOffersSentGoal" INTEGER,
    "monthlyOffersAcceptedGoal" INTEGER,
    "proposalFeaturedVideoUrl" TEXT,
    "proposalFeaturedImageUrl" TEXT,
    "proposalPrimaryColor" TEXT,
    "proposalAccentColor" TEXT,
    "accentForegroundColor" TEXT NOT NULL DEFAULT '#ffffff',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BrandTheme_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BrandToolLink" (
    "id" TEXT NOT NULL,
    "brandId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BrandToolLink_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BrandMediaFolder" (
    "id" TEXT NOT NULL,
    "brandId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BrandMediaFolder_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BrandMedia" (
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

-- CreateTable
CREATE TABLE "BrandDiscount" (
    "id" TEXT NOT NULL,
    "brandId" TEXT NOT NULL,
    "contactId" TEXT,
    "name" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "percent" INTEGER NOT NULL DEFAULT 10,
    "amount" DECIMAL(12,2) NOT NULL DEFAULT 250,
    "title" TEXT NOT NULL DEFAULT '',
    "details" TEXT NOT NULL DEFAULT '',
    "activationMode" TEXT NOT NULL DEFAULT 'held',
    "activationDelayDays" INTEGER NOT NULL DEFAULT 0,
    "presentedAt" TIMESTAMP(3),
    "deadlineMode" TEXT NOT NULL DEFAULT 'relative',
    "durationDays" INTEGER NOT NULL DEFAULT 14,
    "deadlineDate" TIMESTAMP(3),
    "active" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BrandDiscount_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "brand_discount_quotes" (
    "brandId" TEXT NOT NULL,
    "discountId" TEXT NOT NULL,
    "quoteId" TEXT NOT NULL,
    "assignedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "brand_discount_quotes_pkey" PRIMARY KEY ("discountId","quoteId")
);

-- CreateTable
CREATE TABLE "InternProfile" (
    "id" TEXT NOT NULL,
    "membershipId" TEXT NOT NULL,
    "displayTitle" TEXT,
    "primaryEmail" TEXT,
    "timezone" TEXT,
    "startDate" TIMESTAMP(3),
    "payRateUsd" DECIMAL(10,2),
    "weeklyHoursCap" DECIMAL(6,2),
    "nextRoleTitle" TEXT,
    "nextReviewDate" TIMESTAMP(3),
    "nextLevelRateUsd" DECIMAL(10,2),
    "availability" TEXT,
    "workDays" TEXT,
    "workStartTime" TEXT,
    "workEndTime" TEXT,
    "telegramHandle" TEXT,
    "headshotUrl" TEXT,
    "shortBio" TEXT,
    "cohortLabel" TEXT,
    "deviceInfo" TEXT,
    "experienceNotes" TEXT,
    "goals" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InternProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "member_onboarding_profiles" (
    "id" TEXT NOT NULL,
    "membershipId" TEXT NOT NULL,
    "legalFirstName" TEXT NOT NULL,
    "legalLastName" TEXT NOT NULL,
    "preferredName" TEXT,
    "dateOfBirth" TIMESTAMP(3),
    "companyEmail" TEXT,
    "personalEmail" TEXT,
    "personalPhone" TEXT,
    "emergencyContactName" TEXT,
    "emergencyContactPhone" TEXT,
    "addressLine1" TEXT,
    "addressLine2" TEXT,
    "city" TEXT,
    "region" TEXT,
    "postalCode" TEXT,
    "countryCode" TEXT,
    "engagementType" "MemberEngagementType",
    "memberRole" "MemberRoleProfile",
    "riskLevel" "MemberRiskLevel",
    "i9Required" BOOLEAN NOT NULL DEFAULT false,
    "i9Status" "MemberI9Status" NOT NULL DEFAULT 'NOT_STARTED',
    "i9DocumentTypes" JSONB,
    "i9VerifiedAt" TIMESTAMP(3),
    "w4Status" "MemberTaxStatus" NOT NULL DEFAULT 'NOT_REQUIRED',
    "w9Status" "MemberTaxStatus" NOT NULL DEFAULT 'NOT_REQUIRED',
    "tinLast4" TEXT,
    "tinType" "MemberTinType",
    "paymentMethod" "MemberPaymentMethod",
    "paymentEmailOrHandle" TEXT,
    "bankAccountToken" TEXT,
    "payCurrency" TEXT NOT NULL DEFAULT 'USD',
    "payRate" DOUBLE PRECISION,
    "payCadence" "MemberPayCadence",
    "ndaAccepted" BOOLEAN NOT NULL DEFAULT false,
    "ndaAcceptedAt" TIMESTAMP(3),
    "handbookAccepted" BOOLEAN NOT NULL DEFAULT false,
    "handbookAcceptedAt" TIMESTAMP(3),
    "dataSecurityAccepted" BOOLEAN NOT NULL DEFAULT false,
    "dataSecurityAcceptedAt" TIMESTAMP(3),
    "contractAccepted" BOOLEAN NOT NULL DEFAULT false,
    "contractAcceptedAt" TIMESTAMP(3),
    "relationshipType" TEXT,
    "contractorType" TEXT,
    "w9QBAck" BOOLEAN NOT NULL DEFAULT false,
    "w9QBStatus" TEXT NOT NULL DEFAULT 'NOT_SENT',
    "w9QBNotes" TEXT,
    "availableStartDate" TIMESTAMP(3),
    "hoursPerWeek" DOUBLE PRECISION,
    "workingDays" JSONB,
    "typicalHoursStart" TEXT,
    "typicalHoursEnd" TEXT,
    "timezone" TEXT,
    "scheduleConflicts" TEXT,
    "canWorkUrgent" BOOLEAN NOT NULL DEFAULT false,
    "canWorkWeekends" BOOLEAN NOT NULL DEFAULT false,
    "scheduleNotes" TEXT,
    "scheduleAck" BOOLEAN NOT NULL DEFAULT false,
    "paymentAck" BOOLEAN NOT NULL DEFAULT false,
    "paymentArrangement" TEXT,
    "projectNameProposal" TEXT,
    "projectAmountExpected" DOUBLE PRECISION,
    "projectDeadlineExpected" TIMESTAMP(3),
    "projectNotesContractor" TEXT,
    "adminStatus" TEXT NOT NULL DEFAULT 'INVITED',
    "sowRequired" BOOLEAN NOT NULL DEFAULT false,
    "sowSent" BOOLEAN NOT NULL DEFAULT false,
    "sowSigned" BOOLEAN NOT NULL DEFAULT false,
    "approvedForWork" BOOLEAN NOT NULL DEFAULT false,
    "adminNotes" TEXT,
    "backgroundCheckRequired" BOOLEAN NOT NULL DEFAULT false,
    "backgroundCheckConsent" BOOLEAN NOT NULL DEFAULT false,
    "backgroundCheckConsentAt" TIMESTAMP(3),
    "backgroundCheckStatus" "MemberBackgroundCheckStatus" NOT NULL DEFAULT 'NOT_REQUIRED',
    "backgroundCheckProviderRef" TEXT,
    "needsQBOAccess" BOOLEAN NOT NULL DEFAULT false,
    "needsEmailAccount" BOOLEAN NOT NULL DEFAULT false,
    "needsTelegramAccess" BOOLEAN NOT NULL DEFAULT false,
    "onboardingStatus" "MemberOnboardingStatus" NOT NULL DEFAULT 'INCOMPLETE',
    "createdByMembershipId" TEXT,
    "updatedByMembershipId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "member_onboarding_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "member_documents" (
    "id" TEXT NOT NULL,
    "membershipId" TEXT NOT NULL,
    "docType" "MemberDocumentType" NOT NULL,
    "storageKey" TEXT NOT NULL,
    "url" TEXT,
    "checksum" TEXT,
    "uploadedByMembershipId" TEXT,
    "uploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "member_documents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "member_audit_events" (
    "id" TEXT NOT NULL,
    "membershipId" TEXT NOT NULL,
    "eventKey" TEXT NOT NULL,
    "previousValue" TEXT,
    "newValue" TEXT,
    "changedByMembershipId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "member_audit_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OnboardingInvite" (
    "id" TEXT NOT NULL,
    "brandId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "recipientName" TEXT,
    "role" "MemberRoleProfile" NOT NULL,
    "onboardingTrack" "OnboardingTrack" NOT NULL,
    "engagementType" "MemberEngagementType" NOT NULL,
    "countryCode" TEXT NOT NULL,
    "riskLevel" "MemberRiskLevel" NOT NULL,
    "backgroundCheckRequired" BOOLEAN NOT NULL,
    "needsQBOAccess" BOOLEAN NOT NULL DEFAULT false,
    "needsEmailAccount" BOOLEAN NOT NULL DEFAULT false,
    "needsTelegramAccess" BOOLEAN NOT NULL DEFAULT true,
    "uiVariant" TEXT,
    "lockedFields" JSONB,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "openedAt" TIMESTAMP(3),
    "usedAt" TIMESTAMP(3),
    "createdByMembershipId" TEXT,
    "linkedMembershipId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OnboardingInvite_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OnboardingSubmission" (
    "id" TEXT NOT NULL,
    "inviteId" TEXT NOT NULL,
    "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "payloadSnapshotEncrypted" TEXT,

    CONSTRAINT "OnboardingSubmission_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AgreementAcceptance" (
    "id" TEXT NOT NULL,
    "membershipId" TEXT NOT NULL,
    "agreementKey" TEXT NOT NULL,
    "agreementVersion" TEXT NOT NULL,
    "acceptedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AgreementAcceptance_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MemberOnboardingStep" (
    "id" TEXT NOT NULL,
    "membershipId" TEXT NOT NULL,
    "stepKey" TEXT NOT NULL,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "MemberOnboardingStep_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OnboardingStepConfig" (
    "id" TEXT NOT NULL,
    "stepKey" TEXT NOT NULL,
    "titleOverride" TEXT,
    "descriptionOverride" TEXT,
    "streamIdOverride" TEXT,
    "linkHrefOverride" TEXT,
    "linkLabelOverride" TEXT,
    "agreementVersionOverride" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OnboardingStepConfig_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OnboardingFlow" (
    "id" TEXT NOT NULL,
    "brandId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "audience" "OnboardingFlowAudience" NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 100,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "requireSequential" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OnboardingFlow_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OnboardingFlowStepConfig" (
    "id" TEXT NOT NULL,
    "flowId" TEXT NOT NULL,
    "stepKey" TEXT NOT NULL,
    "titleOverride" TEXT,
    "descriptionOverride" TEXT,
    "streamIdOverride" TEXT,
    "linkHrefOverride" TEXT,
    "linkLabelOverride" TEXT,
    "assetHrefOverride" TEXT,
    "assetLabelOverride" TEXT,
    "objectivesOverride" TEXT,
    "agreementVersionOverride" TEXT,
    "requiredOverride" BOOLEAN,
    "blockingOverride" BOOLEAN,
    "isEnabledOverride" BOOLEAN,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OnboardingFlowStepConfig_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OnboardingFlowCustomStep" (
    "id" TEXT NOT NULL,
    "flowId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "type" "OnboardingStepType" NOT NULL,
    "required" BOOLEAN NOT NULL DEFAULT false,
    "blocking" BOOLEAN NOT NULL DEFAULT false,
    "sortOrder" INTEGER NOT NULL DEFAULT 1000,
    "streamId" TEXT,
    "linkHref" TEXT,
    "linkLabel" TEXT,
    "assetHref" TEXT,
    "assetLabel" TEXT,
    "objectives" TEXT,
    "agreementKey" TEXT,
    "agreementVersion" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OnboardingFlowCustomStep_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OnboardingFlowAssignment" (
    "id" TEXT NOT NULL,
    "membershipId" TEXT NOT NULL,
    "flowId" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "reviewModeEnabled" BOOLEAN NOT NULL DEFAULT false,
    "assignedByMembershipId" TEXT,
    "assignedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OnboardingFlowAssignment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OnboardingStepQuestion" (
    "id" TEXT NOT NULL,
    "membershipId" TEXT NOT NULL,
    "flowId" TEXT NOT NULL,
    "stepKey" TEXT NOT NULL,
    "questionText" TEXT NOT NULL,
    "status" "OnboardingQuestionStatus" NOT NULL DEFAULT 'OPEN',
    "adminReplyText" TEXT,
    "askedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "answeredAt" TIMESTAMP(3),
    "resolvedAt" TIMESTAMP(3),
    "answeredByMembershipId" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OnboardingStepQuestion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OnboardingStepUpload" (
    "id" TEXT NOT NULL,
    "membershipId" TEXT NOT NULL,
    "flowId" TEXT NOT NULL,
    "stepKey" TEXT NOT NULL,
    "storageProvider" TEXT NOT NULL DEFAULT 'SUPABASE',
    "bucket" TEXT NOT NULL,
    "storagePath" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "mimeType" TEXT,
    "sizeBytes" INTEGER NOT NULL,
    "publicUrl" TEXT NOT NULL,
    "uploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OnboardingStepUpload_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OnboardingFlowStepOrder" (
    "id" TEXT NOT NULL,
    "flowId" TEXT NOT NULL,
    "stepKey" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OnboardingFlowStepOrder_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TimecardEntry" (
    "id" TEXT NOT NULL,
    "membershipId" TEXT NOT NULL,
    "workDate" TIMESTAMP(3) NOT NULL,
    "hours" DECIMAL(5,2) NOT NULL,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TimecardEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TimecardSession" (
    "id" TEXT NOT NULL,
    "membershipId" TEXT NOT NULL,
    "clockInAt" TIMESTAMP(3) NOT NULL,
    "clockOutAt" TIMESTAMP(3),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TimecardSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ContractorInvoice" (
    "id" TEXT NOT NULL,
    "membershipId" TEXT NOT NULL,
    "invoiceNumber" TEXT NOT NULL,
    "status" "InvoiceStatus" NOT NULL DEFAULT 'DRAFT',
    "billingPeriodStart" TIMESTAMP(3) NOT NULL,
    "billingPeriodEnd" TIMESTAMP(3) NOT NULL,
    "totalHours" DECIMAL(10,2) NOT NULL,
    "billingRateUsd" DECIMAL(10,2) NOT NULL,
    "billableAmountUsd" DECIMAL(12,2) NOT NULL,
    "lineItems" JSONB NOT NULL,
    "pdfData" BYTEA,
    "submittedAt" TIMESTAMP(3),
    "approvedAt" TIMESTAMP(3),
    "paidAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ContractorInvoice_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CareerPathStep" (
    "id" TEXT NOT NULL,
    "membershipId" TEXT NOT NULL,
    "stepOrder" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "billingRateUsd" DECIMAL(10,2) NOT NULL,
    "weeklyHoursCap" DECIMAL(6,2) NOT NULL,
    "monthlyBenefitsUsd" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "notes" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CareerPathStep_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CredentialBadge" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "icon" "CredentialIcon" NOT NULL,
    "ribbonStyle" TEXT NOT NULL DEFAULT 'TRI_STRIPE',
    "colorA" TEXT NOT NULL DEFAULT '#0f172a',
    "colorB" TEXT NOT NULL DEFAULT '#f8d773',
    "colorC" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CredentialBadge_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MemberCredentialBadge" (
    "id" TEXT NOT NULL,
    "membershipId" TEXT NOT NULL,
    "badgeId" TEXT NOT NULL,
    "awardedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3),
    "notes" TEXT,
    "awardedByMembershipId" TEXT,

    CONSTRAINT "MemberCredentialBadge_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AppNotice" (
    "id" TEXT NOT NULL,
    "brandId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "targetRole" "BrandRole",
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AppNotice_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TicketClient" (
    "id" TEXT NOT NULL,
    "brandId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "businessLegalName" TEXT,
    "entityType" TEXT,
    "principalAddressLine1" TEXT,
    "principalAddressLine2" TEXT,
    "principalAddressCity" TEXT,
    "principalAddressState" TEXT,
    "principalAddressPostalCode" TEXT,
    "stateOfFormation" TEXT,
    "principalAddress" TEXT,
    "primaryContactPhone" TEXT,
    "authorizedCommunicationEmail" TEXT,
    "noticesEmail" TEXT,
    "preferredInvoicingEmail" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TicketClient_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ClientIntakeInvite" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "createdByMembershipId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ClientIntakeInvite_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReviewRequest" (
    "id" TEXT NOT NULL,
    "brandId" TEXT NOT NULL,
    "clientId" TEXT,
    "token" TEXT NOT NULL,
    "channel" "ReviewChannel" NOT NULL,
    "recipientPhone" TEXT,
    "recipientEmail" TEXT,
    "recipientName" TEXT,
    "sentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastReminderAt" TIMESTAMP(3),
    "openedAt" TIMESTAMP(3),
    "clickedAt" TIMESTAMP(3),
    "outcome" "ReviewOutcome",
    "feedbackRating" INTEGER,
    "feedbackText" TEXT,
    "sentByMembershipId" TEXT,
    "contactId" TEXT,
    "campaignId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ReviewRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Campaign" (
    "id" TEXT NOT NULL,
    "brandId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Campaign_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CampaignContact" (
    "id" TEXT NOT NULL,
    "campaignId" TEXT NOT NULL,
    "contactId" TEXT NOT NULL,
    "addedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CampaignContact_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Contact" (
    "id" TEXT NOT NULL,
    "brandId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "firstName" TEXT,
    "lastName" TEXT,
    "email" TEXT,
    "secondaryEmail" TEXT,
    "phoneE164" TEXT,
    "businessEmail" TEXT,
    "personalEmail" TEXT,
    "phoneNumber" TEXT,
    "company" TEXT,
    "notes" TEXT,
    "roleTitle" TEXT,
    "mrrUsd" DECIMAL(10,2),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Contact_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "contact_brand_links" (
    "id" TEXT NOT NULL,
    "contactId" TEXT NOT NULL,
    "relatedBrandId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "contact_brand_links_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "contact_tags" (
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

    CONSTRAINT "contact_tags_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "contact_tag_links" (
    "id" TEXT NOT NULL,
    "contactId" TEXT NOT NULL,
    "tagId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "contact_tag_links_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "contact_tag_automations" (
    "id" TEXT NOT NULL,
    "brandId" TEXT NOT NULL,
    "tagId" TEXT NOT NULL,
    "pipelineId" TEXT NOT NULL,
    "stageId" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "contact_tag_automations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ClientContact" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "contactId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ClientContact_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LeadContact" (
    "id" TEXT NOT NULL,
    "brandId" TEXT NOT NULL,
    "leadId" TEXT NOT NULL,
    "contactId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LeadContact_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Ticket" (
    "id" TEXT NOT NULL,
    "brandId" TEXT NOT NULL,
    "ticketNumber" TEXT,
    "clientId" TEXT NOT NULL,
    "urgency" "TicketUrgency" NOT NULL DEFAULT 'MEDIUM',
    "description" TEXT NOT NULL,
    "status" "TicketStatus" NOT NULL DEFAULT 'NOT_STARTED',
    "openedOn" TIMESTAMP(3) NOT NULL,
    "deadline" TIMESTAMP(3) NOT NULL,
    "closedOn" TIMESTAMP(3),
    "assignedMembershipId" TEXT,
    "assignedNameLegacy" TEXT,
    "type" "TicketType" NOT NULL,
    "roleNeeded" "TicketRoleNeeded" NOT NULL,
    "coordinationLevel" "TicketCoordinationLevel" NOT NULL DEFAULT 'NONE',
    "ticketFolderUrl" TEXT,
    "postBriefUrl" TEXT,
    "notes" TEXT,
    "importSource" TEXT,
    "importKey" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Ticket_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TicketComment" (
    "id" TEXT NOT NULL,
    "ticketId" TEXT NOT NULL,
    "authorMembershipId" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TicketComment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TeamMeeting" (
    "id" TEXT NOT NULL,
    "brandId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "meetingUrl" TEXT NOT NULL,
    "meetingDate" TIMESTAMP(3) NOT NULL,
    "provider" TEXT NOT NULL DEFAULT 'FIREFLIES',
    "notes" TEXT,
    "externalId" TEXT,
    "source" TEXT NOT NULL DEFAULT 'manual',
    "createdByMembershipId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TeamMeeting_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TeamMeetingAccess" (
    "id" TEXT NOT NULL,
    "meetingId" TEXT NOT NULL,
    "membershipId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TeamMeetingAccess_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TeamMeetingClient" (
    "id" TEXT NOT NULL,
    "meetingId" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TeamMeetingClient_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MeetingLead" (
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
    "offerType" TEXT,
    "valueBasis" TEXT,
    "firstPaymentReceivedAt" TIMESTAMP(3),
    "serviceAgreementSignedAt" TIMESTAMP(3),
    "invoiceRef" TEXT,
    "invoiceDate" TEXT,
    "yesContactId" TEXT,
    "leadStep" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MeetingLead_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TeamMeetingLead" (
    "id" TEXT NOT NULL,
    "meetingId" TEXT NOT NULL,
    "leadId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TeamMeetingLead_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MeetingTag" (
    "id" TEXT NOT NULL,
    "brandId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MeetingTag_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TeamMeetingTag" (
    "id" TEXT NOT NULL,
    "meetingId" TEXT NOT NULL,
    "tagId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TeamMeetingTag_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TeamMeetingContact" (
    "id" TEXT NOT NULL,
    "meetingId" TEXT NOT NULL,
    "contactId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TeamMeetingContact_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Pipeline" (
    "id" TEXT NOT NULL,
    "brandId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "PipelineType" NOT NULL DEFAULT 'CUSTOM',
    "description" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdByMembershipId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Pipeline_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PipelineStage" (
    "id" TEXT NOT NULL,
    "pipelineId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 100,
    "valueMultiplier" DECIMAL(6,3) NOT NULL DEFAULT 0.01,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "isTerminal" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PipelineStage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PipelineItem" (
    "id" TEXT NOT NULL,
    "pipelineId" TEXT NOT NULL,
    "stageId" TEXT NOT NULL,
    "leadId" TEXT NOT NULL,
    "baseValueUsd" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PipelineItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SalesEvidenceEvent" (
    "id" TEXT NOT NULL,
    "brandId" TEXT NOT NULL,
    "leadId" TEXT,
    "source" TEXT NOT NULL,
    "sourceEventId" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "occurredAt" TIMESTAMP(3) NOT NULL,
    "summary" TEXT NOT NULL,
    "sourceRef" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SalesEvidenceEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AllThingWriteJob" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "lastError" TEXT,
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AllThingWriteJob_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ScanRole" (
    "id" TEXT NOT NULL,
    "brandId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "holderLabel" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ScanRole_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ScanFinding" (
    "id" TEXT NOT NULL,
    "brandId" TEXT NOT NULL,
    "room" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "what" TEXT NOT NULL,
    "severity" TEXT NOT NULL,
    "evidence" TEXT NOT NULL,
    "state" TEXT NOT NULL DEFAULT 'open',
    "fixLevel" INTEGER NOT NULL,
    "roleKey" TEXT NOT NULL,
    "roleId" TEXT,
    "firstSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "closedAt" TIMESTAMP(3),
    "doneNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ScanFinding_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ContentCalendarItem" (
    "id" TEXT NOT NULL,
    "brandId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "notes" TEXT,
    "status" "ContentCalendarStatus" NOT NULL DEFAULT 'PLANNED',
    "plannedPublishDate" TIMESTAMP(3) NOT NULL,
    "producedAt" TIMESTAMP(3),
    "actualPublishDate" TIMESTAMP(3),
    "youtubeVideoId" TEXT,
    "sourceTag" TEXT,
    "vidiqScore" DOUBLE PRECISION,
    "vidiqVolume" INTEGER,
    "vidiqCompetition" DOUBLE PRECISION,
    "vidiqCapturedAt" TIMESTAMP(3),
    "videoDescription" TEXT,
    "videoTags" TEXT,
    "pinnedComment" TEXT,
    "videoScript" TEXT,
    "localFolderPath" TEXT,
    "thumbnailPath" TEXT,
    "thumbnailText" TEXT,
    "createdByMembershipId" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ContentCalendarItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SourceTagClickDaily" (
    "id" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "tag" TEXT NOT NULL,
    "brandId" TEXT NOT NULL,
    "clicks" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SourceTagClickDaily_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ArchivedYouTubeVideo" (
    "videoId" TEXT NOT NULL,
    "brandId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "archivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ArchivedYouTubeVideo_pkey" PRIMARY KEY ("videoId")
);

-- CreateTable
CREATE TABLE "StrategyNote" (
    "id" SERIAL NOT NULL,
    "brandId" TEXT NOT NULL,
    "goalHeading" TEXT,
    "goalSubtitle" TEXT,
    "goalDescription" TEXT,
    "bottleneck" TEXT,
    "strategy" TEXT,
    "dailyAction" TEXT,
    "reward" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StrategyNote_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ShowrunnerVideoStatus" (
    "id" TEXT NOT NULL,
    "brandId" TEXT NOT NULL,
    "batch" TEXT NOT NULL,
    "project" TEXT,
    "state" TEXT NOT NULL,
    "stage" TEXT,
    "steps" JSONB,
    "render" JSONB,
    "url" TEXT,
    "sentAt" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ShowrunnerVideoStatus_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ShowrunnerFeedback" (
    "id" TEXT NOT NULL,
    "brandId" TEXT NOT NULL,
    "seriesSlug" TEXT NOT NULL,
    "episodeIndex" INTEGER,
    "reaction" TEXT NOT NULL,
    "note" TEXT,
    "actorUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ShowrunnerFeedback_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DailyLog" (
    "id" TEXT NOT NULL,
    "membershipId" TEXT NOT NULL,
    "date" TEXT NOT NULL,
    "item1" TEXT NOT NULL DEFAULT '',
    "item2" TEXT NOT NULL DEFAULT '',
    "item3" TEXT NOT NULL DEFAULT '',
    "item1Done" BOOLEAN NOT NULL DEFAULT false,
    "item2Done" BOOLEAN NOT NULL DEFAULT false,
    "item3Done" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DailyLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "log_items" (
    "id" TEXT NOT NULL,
    "membershipId" TEXT NOT NULL,
    "workDate" TEXT NOT NULL,
    "title" TEXT NOT NULL DEFAULT '',
    "notes" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "completedAt" TIMESTAMP(3),
    "archivedAt" TIMESTAMP(3),
    "dailySlot" INTEGER,
    "dailyMarkedDate" TEXT,
    "dailyAssignedDate" TEXT,
    "shurikenSlot" INTEGER,
    "shurikenMarkedDate" TEXT,
    "shurikenAssignedDate" TEXT,
    "subtasks" JSONB NOT NULL DEFAULT '[]',
    "isToday" BOOLEAN NOT NULL DEFAULT false,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "legacyKey" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "log_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "focus_quotes" (
    "id" TEXT NOT NULL,
    "membershipId" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "author" TEXT NOT NULL DEFAULT '',
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "focus_quotes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "focus_quote_settings" (
    "id" TEXT NOT NULL,
    "membershipId" TEXT NOT NULL,
    "rotationMode" TEXT NOT NULL DEFAULT 'random',
    "intervalMinutes" INTEGER NOT NULL DEFAULT 10,
    "pinnedQuoteId" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "focus_quote_settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "standards_checks" (
    "id" TEXT NOT NULL,
    "membershipId" TEXT NOT NULL,
    "standardKey" TEXT NOT NULL,
    "status" "StandardsCheckStatus" NOT NULL DEFAULT 'NOT_REVIEWED',
    "notes" TEXT,
    "reviewedByMembershipId" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "standards_checks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "scorecard_attendance_records" (
    "id" TEXT NOT NULL,
    "membershipId" TEXT NOT NULL,
    "date" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "recordedByMembershipId" TEXT NOT NULL,
    "recordedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "scorecard_attendance_records_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "scorecard_task_records" (
    "id" TEXT NOT NULL,
    "membershipId" TEXT NOT NULL,
    "weekStart" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "recordedByMembershipId" TEXT NOT NULL,
    "recordedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "scorecard_task_records_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "legends" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "earlyImageUrl" TEXT,
    "legendImageUrl" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "legends_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "motivational_quotes" (
    "id" TEXT NOT NULL,
    "legendId" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "source" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "motivational_quotes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Engagement" (
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
    "agreementManagerStatus" "AgreementManagerStatus" NOT NULL DEFAULT 'ACTIVE',
    "agreementSentAt" TIMESTAMP(3),
    "agreementCancellationRequestedAt" TIMESTAMP(3),
    "agreementCancellationRequestedByUserId" TEXT,
    "agreementCancellationReason" TEXT,
    "agreementCancellationTokenHash" TEXT,
    "agreementCancellationTokenExpiresAt" TIMESTAMP(3),
    "agreementCancellationAcknowledgedAt" TIMESTAMP(3),
    "agreementCancellationAcknowledgedByName" TEXT,
    "agreementCancellationAcknowledgedByEmail" TEXT,
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

-- CreateTable
CREATE TABLE "DiscoveryItem" (
    "id" TEXT NOT NULL,
    "engagementId" TEXT NOT NULL,
    "category" TEXT NOT NULL DEFAULT 'General',
    "label" TEXT NOT NULL,
    "instructions" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "clientNote" TEXT,
    "fileUrl" TEXT,
    "adminNote" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DiscoveryItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "proposal_documents" (
    "id" TEXT NOT NULL,
    "brandId" TEXT NOT NULL,
    "engagementId" TEXT,
    "slug" TEXT NOT NULL,
    "companyName" TEXT NOT NULL,
    "preparedFor" TEXT NOT NULL,
    "serviceType" TEXT NOT NULL,
    "cleanupPeriodStart" TIMESTAMP(3),
    "cleanupPeriodEnd" TIMESTAMP(3),
    "projectGoal" TEXT NOT NULL,
    "estimatedTotalFee" DECIMAL(12,2),
    "displayMode" TEXT NOT NULL DEFAULT 'document',
    "status" TEXT NOT NULL DEFAULT 'draft',
    "publicStatus" TEXT NOT NULL DEFAULT 'draft',
    "paymentMethod" TEXT,
    "introPaymentSentence" TEXT,
    "acceptedAt" TIMESTAMP(3),
    "acceptedByName" TEXT,
    "acceptedByEmail" TEXT,
    "acceptanceIp" TEXT,
    "acceptanceUserAgent" TEXT,
    "acceptanceNote" TEXT,
    "acceptedSnapshot" JSONB,
    "agreementPreparedAt" TIMESTAMP(3),
    "agreementSentAt" TIMESTAMP(3),
    "agreementSignedAt" TIMESTAMP(3),
    "phase3InvoiceSentAt" TIMESTAMP(3),
    "phase3PaymentReceivedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "proposal_documents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "proposal_phases" (
    "id" TEXT NOT NULL,
    "proposalId" TEXT NOT NULL,
    "phaseNumber" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "amount" DECIMAL(12,2),
    "amountType" TEXT NOT NULL DEFAULT 'fixed',
    "paymentNote" TEXT,
    "introduction" TEXT,
    "displayOrder" INTEGER NOT NULL DEFAULT 100,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "proposal_phases_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "proposal_phase_items" (
    "id" TEXT NOT NULL,
    "phaseId" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "displayOrder" INTEGER NOT NULL DEFAULT 100,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "proposal_phase_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "proposal_sections" (
    "id" TEXT NOT NULL,
    "proposalId" TEXT NOT NULL,
    "sectionKey" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT,
    "displayOrder" INTEGER NOT NULL DEFAULT 100,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "proposal_sections_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "proposal_section_items" (
    "id" TEXT NOT NULL,
    "sectionId" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "displayOrder" INTEGER NOT NULL DEFAULT 100,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "proposal_section_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProposalPackage" (
    "id" TEXT NOT NULL,
    "brandId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "scenario" "ProposalCatalogScenario" NOT NULL,
    "name" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "descriptionLong" TEXT,
    "supportLabel" TEXT NOT NULL,
    "supportIncludes" TEXT NOT NULL,
    "supportStars" INTEGER NOT NULL DEFAULT 1,
    "highlightLabel" TEXT,
    "tier" INTEGER NOT NULL DEFAULT 1,
    "priceMode" "ProposalPackagePriceMode" NOT NULL DEFAULT 'BASE_MULTIPLIER',
    "priceValue" DECIMAL(65,30),
    "onboardingFee" DECIMAL(12,2),
    "billingType" TEXT NOT NULL DEFAULT 'recurring',
    "whyItMatters" JSONB,
    "displayOrder" INTEGER NOT NULL DEFAULT 100,
    "badge" TEXT,
    "leadIn" TEXT,
    "positioningStatement" TEXT,
    "buttonLabel" TEXT,
    "paymentStage1Label" TEXT,
    "paymentStage1Amount" DECIMAL(12,2),
    "paymentStage2Label" TEXT,
    "paymentStage2Amount" DECIMAL(12,2),
    "paymentStage3Label" TEXT,
    "paymentStage3Amount" DECIMAL(12,2),
    "clientResponsibilities" JSONB,
    "exclusions" JSONB,
    "responseStandard" TEXT,
    "expeditedCommitment" TEXT,
    "workingSessionLimit" INTEGER,
    "receiptLimit" INTEGER,
    "responseCommitmentTitle" TEXT,
    "responseCommitmentBody" TEXT,
    "onboardingSummary" TEXT,
    "onboardingItems" JSONB,
    "executionSummary" TEXT,
    "executionItems" JSONB,
    "expeditedAddOnPrice" DECIMAL(12,2),
    "expeditedAddOnLabel" TEXT,
    "expeditedAddOnDescription" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProposalPackage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProposalPackageFeature" (
    "id" TEXT NOT NULL,
    "packageId" TEXT NOT NULL,
    "kind" "ProposalFeatureKind" NOT NULL DEFAULT 'INCLUDED',
    "shortLabel" TEXT NOT NULL,
    "longDescription" TEXT,
    "displayOrder" INTEGER NOT NULL DEFAULT 100,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProposalPackageFeature_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "catalog_services" (
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
    "realEstateSpecific" BOOLEAN NOT NULL DEFAULT false,
    "product_kind" TEXT NOT NULL DEFAULT 'bookkeeping',
    "tagId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "catalog_services_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "catalog_service_tags" (
    "id" TEXT NOT NULL,
    "brandId" TEXT NOT NULL,
    "serviceId" TEXT NOT NULL,
    "tagId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "catalog_service_tags_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "package_services" (
    "id" TEXT NOT NULL,
    "packageId" TEXT NOT NULL,
    "serviceId" TEXT NOT NULL,
    "inclusionType" TEXT NOT NULL DEFAULT 'included',
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "package_services_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pricing_rules" (
    "id" TEXT NOT NULL,
    "packageId" TEXT NOT NULL,
    "name" TEXT NOT NULL DEFAULT '',
    "description" TEXT,
    "ruleType" TEXT NOT NULL,
    "configJson" JSONB NOT NULL,
    "billingType" TEXT NOT NULL DEFAULT 'recurring',
    "minPrice" DECIMAL(12,2),
    "maxPrice" DECIMAL(12,2),
    "sortOrder" INTEGER NOT NULL DEFAULT 100,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "pricing_rules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "proposal_selections" (
    "id" TEXT NOT NULL,
    "engagementId" TEXT NOT NULL,
    "packageKey" TEXT NOT NULL,
    "packageName" TEXT NOT NULL,
    "selectedPrice" DECIMAL(12,2),
    "clientName" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "expeditedSelected" BOOLEAN NOT NULL DEFAULT false,
    "expeditedAddOnPrice" DECIMAL(12,2),
    "selectedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "proposal_selections_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "quote_clients" (
    "id" TEXT NOT NULL,
    "brandId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "company" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "quote_clients_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "quotes" (
    "id" TEXT NOT NULL,
    "brandId" TEXT NOT NULL,
    "offerCode" TEXT NOT NULL,
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

-- CreateTable
CREATE TABLE "quote_revisions" (
    "id" TEXT NOT NULL,
    "brandId" TEXT NOT NULL,
    "quoteId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "snapshotJson" JSONB NOT NULL,
    "publishedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "supersededAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "quote_revisions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "quote_line_items" (
    "id" TEXT NOT NULL,
    "quoteId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "description" TEXT,
    "amount" DECIMAL(12,2) NOT NULL,
    "billingType" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 100,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "quote_line_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "quote_templates" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "layoutType" TEXT NOT NULL DEFAULT '3-column',
    "sections" JSONB NOT NULL DEFAULT '[]',
    "highlightMiddle" BOOLEAN NOT NULL DEFAULT true,
    "showInclusions" BOOLEAN NOT NULL DEFAULT true,
    "showPriceBreakdown" BOOLEAN NOT NULL DEFAULT true,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "quote_templates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "firm_profile" (
    "id" TEXT NOT NULL,
    "brandId" TEXT NOT NULL,
    "legalName" TEXT NOT NULL DEFAULT '',
    "dba" TEXT,
    "addressLine1" TEXT,
    "addressLine2" TEXT,
    "city" TEXT,
    "state" TEXT,
    "postalCode" TEXT,
    "phone" TEXT,
    "email" TEXT,
    "ein" TEXT,
    "sos_file_number" TEXT,
    "stateOfFormation" TEXT,
    "logoUrl" TEXT,
    "website" TEXT,
    "qbo_firm_id" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "firm_profile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CompanyRevenueMonth" (
    "id" TEXT NOT NULL,
    "brandId" TEXT NOT NULL,
    "monthStart" TIMESTAMP(3) NOT NULL,
    "grossRevenueUsd" DECIMAL(12,2) NOT NULL,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CompanyRevenueMonth_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BrandFeature" (
    "id" TEXT NOT NULL,
    "brandId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "settings" JSONB,
    "enabledAt" TIMESTAMP(3),
    "disabledAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BrandFeature_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CustomerArSnapshot" (
    "id" TEXT NOT NULL,
    "brandId" TEXT NOT NULL,
    "qbCompany" TEXT NOT NULL,
    "qboInvoiceId" TEXT,
    "qboCustomerId" TEXT,
    "customerName" TEXT NOT NULL,
    "invoiceRef" TEXT,
    "qboDocNumber" TEXT,
    "txnDate" TIMESTAMP(3),
    "dueDate" TIMESTAMP(3),
    "totalAmount" DECIMAL(12,2),
    "openBalance" DECIMAL(12,2) NOT NULL,
    "status" TEXT,
    "emailStatus" TEXT,
    "paymentHistory" JSONB,
    "syncedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CustomerArSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BrandIntegration" (
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

-- CreateTable
CREATE TABLE "AgreementTemplate" (
    "id" TEXT NOT NULL,
    "brandId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "content" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'active',
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "defaultForProductKind" TEXT,
    "archivedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AgreementTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProposalOptionsTemplate" (
    "id" TEXT NOT NULL,
    "brandId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "productKind" TEXT NOT NULL DEFAULT 'bookkeeping',
    "snapshotJson" JSONB NOT NULL,
    "defaultForProductKind" TEXT,
    "archivedAt" TIMESTAMP(3),
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProposalOptionsTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditEvent" (
    "id" TEXT NOT NULL,
    "brandId" TEXT,
    "actorUserId" TEXT,
    "actorType" "AuditActorType" NOT NULL,
    "action" TEXT NOT NULL,
    "resourceType" TEXT,
    "resourceId" TEXT,
    "requestId" TEXT,
    "ipHash" TEXT,
    "metadata" JSONB,
    "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CustomerAccount" (
    "id" TEXT NOT NULL,
    "brandId" TEXT NOT NULL,
    "code" TEXT,
    "name" TEXT NOT NULL,
    "legalName" TEXT,
    "status" "CustomerStatus" NOT NULL DEFAULT 'PROSPECT',
    "websiteUrl" TEXT,
    "communicationEmail" TEXT,
    "primaryPhone" TEXT,
    "noticesEmail" TEXT,
    "invoicingEmail" TEXT,
    "customFields" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CustomerAccount_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CustomerContact" (
    "id" TEXT NOT NULL,
    "brandId" TEXT NOT NULL,
    "customerAccountId" TEXT NOT NULL,
    "contactId" TEXT NOT NULL,
    "relationship" TEXT,
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,
    "canDecide" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CustomerContact_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Lead" (
    "id" TEXT NOT NULL,
    "brandId" TEXT NOT NULL,
    "convertedCustomerId" TEXT,
    "name" TEXT NOT NULL,
    "company" TEXT,
    "email" TEXT,
    "normalizedEmail" TEXT,
    "phoneE164" TEXT,
    "status" "LeadStatus" NOT NULL DEFAULT 'NEW',
    "source" TEXT,
    "sourceDetail" TEXT,
    "expectedServices" TEXT,
    "notes" TEXT,
    "estimatedValue" DECIMAL(14,2),
    "valueCurrency" VARCHAR(3),
    "customFields" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Lead_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LeadAttributionTouch" (
    "id" TEXT NOT NULL,
    "brandId" TEXT NOT NULL,
    "leadId" TEXT NOT NULL,
    "touchType" "AttributionTouchType" NOT NULL DEFAULT 'OTHER',
    "source" TEXT,
    "medium" TEXT,
    "campaign" TEXT,
    "term" TEXT,
    "content" TEXT,
    "landingPageUrl" TEXT,
    "capturedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LeadAttributionTouch_pkey" PRIMARY KEY ("id")
);

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
    "requestedScopes" "BrandDataExportScope"[],
    "manifestVersion" INTEGER NOT NULL DEFAULT 1,
    "storageProvider" TEXT,
    "storageKey" TEXT,
    "checksumSha256" TEXT,
    "byteSize" BIGINT,
    "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3),
    "failureCode" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BrandDataExport_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EmailConnection" (
    "id" TEXT NOT NULL,
    "brandId" TEXT NOT NULL,
    "membershipId" TEXT NOT NULL,
    "provider" "EmailConnectionProvider" NOT NULL,
    "region" TEXT,
    "emailAddress" TEXT NOT NULL,
    "displayName" TEXT,
    "accountIdentifier" TEXT,
    "accessTokenCiphertext" TEXT NOT NULL,
    "refreshTokenCiphertext" TEXT NOT NULL,
    "accessTokenExpiresAt" TIMESTAMP(3),
    "scopes" TEXT,
    "status" "EmailConnectionStatus" NOT NULL DEFAULT 'ACTIVE',
    "lastError" TEXT,
    "lastVerifiedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EmailConnection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PipeTask" (
    "id" TEXT NOT NULL,
    "brandId" TEXT NOT NULL,
    "pipeId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "instructions" TEXT,
    "stage" TEXT NOT NULL DEFAULT 'todo',
    "taskBrand" TEXT NOT NULL DEFAULT 'personal',
    "ownerKey" TEXT,
    "ownerName" TEXT,
    "ownerKind" TEXT,
    "nextDue" TEXT,
    "big3Rank" INTEGER,
    "big3On" TEXT,
    "closedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PipeTask_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PipeTaskTag" (
    "id" TEXT NOT NULL,
    "taskId" TEXT NOT NULL,
    "label" TEXT NOT NULL,

    CONSTRAINT "PipeTaskTag_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PipeTaskNote" (
    "id" TEXT NOT NULL,
    "taskId" TEXT NOT NULL,
    "pipeNoteId" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "notedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PipeTaskNote_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "proposal_view_events" (
    "id" TEXT NOT NULL,
    "quoteId" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "step" INTEGER,
    "packageId" TEXT,
    "position" INTEGER,
    "value" INTEGER,
    "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "proposal_view_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "User_status_idx" ON "User"("status");

-- CreateIndex
CREATE INDEX "User_platformRole_idx" ON "User"("platformRole");

-- CreateIndex
CREATE INDEX "Account_userId_idx" ON "Account"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Account_provider_providerAccountId_key" ON "Account"("provider", "providerAccountId");

-- CreateIndex
CREATE UNIQUE INDEX "Session_sessionToken_key" ON "Session"("sessionToken");

-- CreateIndex
CREATE INDEX "Session_userId_idx" ON "Session"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "VerificationToken_identifier_token_key" ON "VerificationToken"("identifier", "token");

-- CreateIndex
CREATE UNIQUE INDEX "Brand_slug_key" ON "Brand"("slug");

-- CreateIndex
CREATE INDEX "Brand_status_idx" ON "Brand"("status");

-- CreateIndex
CREATE UNIQUE INDEX "BrandDomain_hostname_key" ON "BrandDomain"("hostname");

-- CreateIndex
CREATE INDEX "BrandDomain_brandId_purpose_status_idx" ON "BrandDomain"("brandId", "purpose", "status");

-- CreateIndex
CREATE UNIQUE INDEX "LocalSeoConfig_brandId_key" ON "LocalSeoConfig"("brandId");

-- CreateIndex
CREATE UNIQUE INDEX "LocalSeoScan_scheduleKey_key" ON "LocalSeoScan"("scheduleKey");

-- CreateIndex
CREATE INDEX "LocalSeoScan_brandId_startedAt_idx" ON "LocalSeoScan"("brandId", "startedAt");

-- CreateIndex
CREATE INDEX "LocalSeoScan_status_startedAt_idx" ON "LocalSeoScan"("status", "startedAt");

-- CreateIndex
CREATE UNIQUE INDEX "LocalSeoGridCell_providerTaskId_key" ON "LocalSeoGridCell"("providerTaskId");

-- CreateIndex
CREATE INDEX "LocalSeoGridCell_scanId_keyword_idx" ON "LocalSeoGridCell"("scanId", "keyword");

-- CreateIndex
CREATE INDEX "LocalSeoGridCell_status_providerTaskId_idx" ON "LocalSeoGridCell"("status", "providerTaskId");

-- CreateIndex
CREATE UNIQUE INDEX "LocalSeoGridCell_scanId_keyword_row_column_key" ON "LocalSeoGridCell"("scanId", "keyword", "row", "column");

-- CreateIndex
CREATE INDEX "BrandMembership_brandId_status_role_idx" ON "BrandMembership"("brandId", "status", "role");

-- CreateIndex
CREATE INDEX "BrandMembership_userId_status_idx" ON "BrandMembership"("userId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "BrandMembership_brandId_userId_key" ON "BrandMembership"("brandId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "BrandMembership_brandId_employeeNumber_key" ON "BrandMembership"("brandId", "employeeNumber");

-- CreateIndex
CREATE UNIQUE INDEX "BrandTheme_brandId_key" ON "BrandTheme"("brandId");

-- CreateIndex
CREATE INDEX "BrandToolLink_brandId_sortOrder_idx" ON "BrandToolLink"("brandId", "sortOrder");

-- CreateIndex
CREATE UNIQUE INDEX "BrandToolLink_brandId_key_key" ON "BrandToolLink"("brandId", "key");

-- CreateIndex
CREATE INDEX "BrandMediaFolder_brandId_sortOrder_idx" ON "BrandMediaFolder"("brandId", "sortOrder");

-- CreateIndex
CREATE INDEX "BrandMedia_brandId_sortOrder_idx" ON "BrandMedia"("brandId", "sortOrder");

-- CreateIndex
CREATE INDEX "BrandMedia_brandId_folderId_idx" ON "BrandMedia"("brandId", "folderId");

-- CreateIndex
CREATE INDEX "BrandDiscount_brandId_active_sortOrder_idx" ON "BrandDiscount"("brandId", "active", "sortOrder");

-- CreateIndex
CREATE INDEX "BrandDiscount_contactId_idx" ON "BrandDiscount"("contactId");

-- CreateIndex
CREATE INDEX "brand_discount_quotes_brandId_quoteId_idx" ON "brand_discount_quotes"("brandId", "quoteId");

-- CreateIndex
CREATE INDEX "brand_discount_quotes_brandId_discountId_idx" ON "brand_discount_quotes"("brandId", "discountId");

-- CreateIndex
CREATE UNIQUE INDEX "InternProfile_membershipId_key" ON "InternProfile"("membershipId");

-- CreateIndex
CREATE UNIQUE INDEX "member_onboarding_profiles_membershipId_key" ON "member_onboarding_profiles"("membershipId");

-- CreateIndex
CREATE INDEX "member_documents_membershipId_uploadedAt_idx" ON "member_documents"("membershipId", "uploadedAt");

-- CreateIndex
CREATE INDEX "member_audit_events_membershipId_createdAt_idx" ON "member_audit_events"("membershipId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "OnboardingInvite_linkedMembershipId_key" ON "OnboardingInvite"("linkedMembershipId");

-- CreateIndex
CREATE INDEX "OnboardingInvite_brandId_email_createdAt_idx" ON "OnboardingInvite"("brandId", "email", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "AgreementAcceptance_membershipId_agreementKey_agreementVers_key" ON "AgreementAcceptance"("membershipId", "agreementKey", "agreementVersion");

-- CreateIndex
CREATE UNIQUE INDEX "MemberOnboardingStep_membershipId_stepKey_key" ON "MemberOnboardingStep"("membershipId", "stepKey");

-- CreateIndex
CREATE UNIQUE INDEX "OnboardingStepConfig_stepKey_key" ON "OnboardingStepConfig"("stepKey");

-- CreateIndex
CREATE INDEX "OnboardingFlow_brandId_audience_isActive_sortOrder_idx" ON "OnboardingFlow"("brandId", "audience", "isActive", "sortOrder");

-- CreateIndex
CREATE UNIQUE INDEX "OnboardingFlow_brandId_key_key" ON "OnboardingFlow"("brandId", "key");

-- CreateIndex
CREATE INDEX "OnboardingFlowStepConfig_flowId_stepKey_idx" ON "OnboardingFlowStepConfig"("flowId", "stepKey");

-- CreateIndex
CREATE UNIQUE INDEX "OnboardingFlowStepConfig_flowId_stepKey_key" ON "OnboardingFlowStepConfig"("flowId", "stepKey");

-- CreateIndex
CREATE INDEX "OnboardingFlowCustomStep_flowId_sortOrder_createdAt_idx" ON "OnboardingFlowCustomStep"("flowId", "sortOrder", "createdAt");

-- CreateIndex
CREATE INDEX "OnboardingFlowAssignment_flowId_isActive_idx" ON "OnboardingFlowAssignment"("flowId", "isActive");

-- CreateIndex
CREATE INDEX "OnboardingFlowAssignment_membershipId_isActive_idx" ON "OnboardingFlowAssignment"("membershipId", "isActive");

-- CreateIndex
CREATE UNIQUE INDEX "OnboardingFlowAssignment_membershipId_flowId_key" ON "OnboardingFlowAssignment"("membershipId", "flowId");

-- CreateIndex
CREATE INDEX "OnboardingStepQuestion_flowId_status_idx" ON "OnboardingStepQuestion"("flowId", "status");

-- CreateIndex
CREATE INDEX "OnboardingStepQuestion_membershipId_status_idx" ON "OnboardingStepQuestion"("membershipId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "OnboardingStepQuestion_membershipId_flowId_stepKey_key" ON "OnboardingStepQuestion"("membershipId", "flowId", "stepKey");

-- CreateIndex
CREATE INDEX "OnboardingStepUpload_flowId_membershipId_idx" ON "OnboardingStepUpload"("flowId", "membershipId");

-- CreateIndex
CREATE UNIQUE INDEX "OnboardingStepUpload_membershipId_flowId_stepKey_key" ON "OnboardingStepUpload"("membershipId", "flowId", "stepKey");

-- CreateIndex
CREATE INDEX "OnboardingFlowStepOrder_flowId_sortOrder_idx" ON "OnboardingFlowStepOrder"("flowId", "sortOrder");

-- CreateIndex
CREATE UNIQUE INDEX "OnboardingFlowStepOrder_flowId_stepKey_key" ON "OnboardingFlowStepOrder"("flowId", "stepKey");

-- CreateIndex
CREATE INDEX "TimecardEntry_membershipId_workDate_idx" ON "TimecardEntry"("membershipId", "workDate");

-- CreateIndex
CREATE INDEX "TimecardSession_membershipId_clockInAt_idx" ON "TimecardSession"("membershipId", "clockInAt");

-- CreateIndex
CREATE INDEX "TimecardSession_membershipId_clockOutAt_idx" ON "TimecardSession"("membershipId", "clockOutAt");

-- CreateIndex
CREATE UNIQUE INDEX "ContractorInvoice_invoiceNumber_key" ON "ContractorInvoice"("invoiceNumber");

-- CreateIndex
CREATE INDEX "ContractorInvoice_membershipId_status_idx" ON "ContractorInvoice"("membershipId", "status");

-- CreateIndex
CREATE INDEX "ContractorInvoice_membershipId_billingPeriodStart_billingPe_idx" ON "ContractorInvoice"("membershipId", "billingPeriodStart", "billingPeriodEnd");

-- CreateIndex
CREATE INDEX "CareerPathStep_membershipId_isActive_idx" ON "CareerPathStep"("membershipId", "isActive");

-- CreateIndex
CREATE UNIQUE INDEX "CareerPathStep_membershipId_stepOrder_key" ON "CareerPathStep"("membershipId", "stepOrder");

-- CreateIndex
CREATE UNIQUE INDEX "CredentialBadge_key_key" ON "CredentialBadge"("key");

-- CreateIndex
CREATE INDEX "CredentialBadge_isActive_sortOrder_idx" ON "CredentialBadge"("isActive", "sortOrder");

-- CreateIndex
CREATE INDEX "MemberCredentialBadge_membershipId_idx" ON "MemberCredentialBadge"("membershipId");

-- CreateIndex
CREATE INDEX "MemberCredentialBadge_badgeId_idx" ON "MemberCredentialBadge"("badgeId");

-- CreateIndex
CREATE UNIQUE INDEX "MemberCredentialBadge_membershipId_badgeId_key" ON "MemberCredentialBadge"("membershipId", "badgeId");

-- CreateIndex
CREATE INDEX "AppNotice_brandId_isActive_targetRole_idx" ON "AppNotice"("brandId", "isActive", "targetRole");

-- CreateIndex
CREATE INDEX "TicketClient_brandId_isActive_idx" ON "TicketClient"("brandId", "isActive");

-- CreateIndex
CREATE UNIQUE INDEX "TicketClient_brandId_code_key" ON "TicketClient"("brandId", "code");

-- CreateIndex
CREATE INDEX "ClientIntakeInvite_clientId_createdAt_idx" ON "ClientIntakeInvite"("clientId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "ReviewRequest_token_key" ON "ReviewRequest"("token");

-- CreateIndex
CREATE INDEX "ReviewRequest_brandId_createdAt_idx" ON "ReviewRequest"("brandId", "createdAt");

-- CreateIndex
CREATE INDEX "ReviewRequest_clientId_createdAt_idx" ON "ReviewRequest"("clientId", "createdAt");

-- CreateIndex
CREATE INDEX "ReviewRequest_token_idx" ON "ReviewRequest"("token");

-- CreateIndex
CREATE INDEX "ReviewRequest_campaignId_idx" ON "ReviewRequest"("campaignId");

-- CreateIndex
CREATE INDEX "ReviewRequest_contactId_idx" ON "ReviewRequest"("contactId");

-- CreateIndex
CREATE INDEX "Campaign_brandId_idx" ON "Campaign"("brandId");

-- CreateIndex
CREATE INDEX "CampaignContact_campaignId_idx" ON "CampaignContact"("campaignId");

-- CreateIndex
CREATE UNIQUE INDEX "CampaignContact_campaignId_contactId_key" ON "CampaignContact"("campaignId", "contactId");

-- CreateIndex
CREATE INDEX "Contact_brandId_isActive_name_idx" ON "Contact"("brandId", "isActive", "name");

-- CreateIndex
CREATE INDEX "Contact_brandId_email_idx" ON "Contact"("brandId", "email");

-- CreateIndex
CREATE INDEX "Contact_brandId_company_idx" ON "Contact"("brandId", "company");

-- CreateIndex
CREATE UNIQUE INDEX "Contact_brandId_id_key" ON "Contact"("brandId", "id");

-- CreateIndex
CREATE INDEX "contact_brand_links_relatedBrandId_idx" ON "contact_brand_links"("relatedBrandId");

-- CreateIndex
CREATE UNIQUE INDEX "contact_brand_links_contactId_relatedBrandId_key" ON "contact_brand_links"("contactId", "relatedBrandId");

-- CreateIndex
CREATE INDEX "contact_tags_brandId_isActive_sortOrder_idx" ON "contact_tags"("brandId", "isActive", "sortOrder");

-- CreateIndex
CREATE UNIQUE INDEX "contact_tags_brandId_key_key" ON "contact_tags"("brandId", "key");

-- CreateIndex
CREATE INDEX "contact_tag_links_tagId_createdAt_idx" ON "contact_tag_links"("tagId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "contact_tag_links_contactId_tagId_key" ON "contact_tag_links"("contactId", "tagId");

-- CreateIndex
CREATE INDEX "contact_tag_automations_brandId_isActive_idx" ON "contact_tag_automations"("brandId", "isActive");

-- CreateIndex
CREATE UNIQUE INDEX "contact_tag_automations_tagId_pipelineId_key" ON "contact_tag_automations"("tagId", "pipelineId");

-- CreateIndex
CREATE INDEX "ClientContact_contactId_createdAt_idx" ON "ClientContact"("contactId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "ClientContact_clientId_contactId_key" ON "ClientContact"("clientId", "contactId");

-- CreateIndex
CREATE INDEX "LeadContact_brandId_contactId_createdAt_idx" ON "LeadContact"("brandId", "contactId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "LeadContact_leadId_contactId_key" ON "LeadContact"("leadId", "contactId");

-- CreateIndex
CREATE UNIQUE INDEX "Ticket_importKey_key" ON "Ticket"("importKey");

-- CreateIndex
CREATE INDEX "Ticket_brandId_status_clientId_idx" ON "Ticket"("brandId", "status", "clientId");

-- CreateIndex
CREATE INDEX "Ticket_assignedMembershipId_status_idx" ON "Ticket"("assignedMembershipId", "status");

-- CreateIndex
CREATE INDEX "Ticket_deadline_idx" ON "Ticket"("deadline");

-- CreateIndex
CREATE INDEX "TicketComment_ticketId_createdAt_idx" ON "TicketComment"("ticketId", "createdAt");

-- CreateIndex
CREATE INDEX "TicketComment_authorMembershipId_createdAt_idx" ON "TicketComment"("authorMembershipId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "TeamMeeting_externalId_key" ON "TeamMeeting"("externalId");

-- CreateIndex
CREATE INDEX "TeamMeeting_brandId_meetingDate_idx" ON "TeamMeeting"("brandId", "meetingDate");

-- CreateIndex
CREATE INDEX "TeamMeeting_createdByMembershipId_idx" ON "TeamMeeting"("createdByMembershipId");

-- CreateIndex
CREATE INDEX "TeamMeetingAccess_membershipId_createdAt_idx" ON "TeamMeetingAccess"("membershipId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "TeamMeetingAccess_meetingId_membershipId_key" ON "TeamMeetingAccess"("meetingId", "membershipId");

-- CreateIndex
CREATE INDEX "TeamMeetingClient_clientId_createdAt_idx" ON "TeamMeetingClient"("clientId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "TeamMeetingClient_meetingId_clientId_key" ON "TeamMeetingClient"("meetingId", "clientId");

-- CreateIndex
CREATE INDEX "MeetingLead_brandId_clientId_createdAt_idx" ON "MeetingLead"("brandId", "clientId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "MeetingLead_brandId_pipeId_key" ON "MeetingLead"("brandId", "pipeId");

-- CreateIndex
CREATE INDEX "TeamMeetingLead_leadId_createdAt_idx" ON "TeamMeetingLead"("leadId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "TeamMeetingLead_meetingId_leadId_key" ON "TeamMeetingLead"("meetingId", "leadId");

-- CreateIndex
CREATE INDEX "MeetingTag_brandId_isActive_sortOrder_idx" ON "MeetingTag"("brandId", "isActive", "sortOrder");

-- CreateIndex
CREATE UNIQUE INDEX "MeetingTag_brandId_key_key" ON "MeetingTag"("brandId", "key");

-- CreateIndex
CREATE INDEX "TeamMeetingTag_tagId_createdAt_idx" ON "TeamMeetingTag"("tagId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "TeamMeetingTag_meetingId_tagId_key" ON "TeamMeetingTag"("meetingId", "tagId");

-- CreateIndex
CREATE INDEX "TeamMeetingContact_contactId_createdAt_idx" ON "TeamMeetingContact"("contactId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "TeamMeetingContact_meetingId_contactId_key" ON "TeamMeetingContact"("meetingId", "contactId");

-- CreateIndex
CREATE INDEX "Pipeline_brandId_type_isActive_idx" ON "Pipeline"("brandId", "type", "isActive");

-- CreateIndex
CREATE UNIQUE INDEX "Pipeline_brandId_key_key" ON "Pipeline"("brandId", "key");

-- CreateIndex
CREATE INDEX "PipelineStage_pipelineId_sortOrder_isActive_idx" ON "PipelineStage"("pipelineId", "sortOrder", "isActive");

-- CreateIndex
CREATE UNIQUE INDEX "PipelineStage_pipelineId_key_key" ON "PipelineStage"("pipelineId", "key");

-- CreateIndex
CREATE INDEX "PipelineItem_stageId_isActive_idx" ON "PipelineItem"("stageId", "isActive");

-- CreateIndex
CREATE INDEX "PipelineItem_pipelineId_isActive_idx" ON "PipelineItem"("pipelineId", "isActive");

-- CreateIndex
CREATE UNIQUE INDEX "PipelineItem_pipelineId_leadId_key" ON "PipelineItem"("pipelineId", "leadId");

-- CreateIndex
CREATE INDEX "SalesEvidenceEvent_brandId_leadId_occurredAt_idx" ON "SalesEvidenceEvent"("brandId", "leadId", "occurredAt");

-- CreateIndex
CREATE UNIQUE INDEX "SalesEvidenceEvent_brandId_source_sourceEventId_key" ON "SalesEvidenceEvent"("brandId", "source", "sourceEventId");

-- CreateIndex
CREATE UNIQUE INDEX "AllThingWriteJob_eventId_key" ON "AllThingWriteJob"("eventId");

-- CreateIndex
CREATE INDEX "AllThingWriteJob_status_createdAt_idx" ON "AllThingWriteJob"("status", "createdAt");

-- CreateIndex
CREATE INDEX "ScanRole_brandId_idx" ON "ScanRole"("brandId");

-- CreateIndex
ALTER TABLE "ScanRole" ADD CONSTRAINT "ScanRole_brandId_key_key" UNIQUE ("brandId", "key");

-- CreateIndex
CREATE INDEX "ScanFinding_brandId_state_lastSeenAt_idx" ON "ScanFinding"("brandId", "state", "lastSeenAt");

-- CreateIndex
CREATE INDEX "ScanFinding_brandId_room_idx" ON "ScanFinding"("brandId", "room");

-- CreateIndex
CREATE INDEX "ScanFinding_roleId_idx" ON "ScanFinding"("roleId");

-- CreateIndex
ALTER TABLE "ScanFinding" ADD CONSTRAINT "ScanFinding_brandId_room_key_key" UNIQUE ("brandId", "room", "key");

-- CreateIndex
CREATE UNIQUE INDEX "ContentCalendarItem_youtubeVideoId_key" ON "ContentCalendarItem"("youtubeVideoId");

-- CreateIndex
CREATE UNIQUE INDEX "ContentCalendarItem_sourceTag_key" ON "ContentCalendarItem"("sourceTag");

-- CreateIndex
CREATE INDEX "ContentCalendarItem_brandId_status_plannedPublishDate_idx" ON "ContentCalendarItem"("brandId", "status", "plannedPublishDate");

-- CreateIndex
CREATE INDEX "ContentCalendarItem_plannedPublishDate_idx" ON "ContentCalendarItem"("plannedPublishDate");

-- CreateIndex
CREATE INDEX "SourceTagClickDaily_tag_idx" ON "SourceTagClickDaily"("tag");

-- CreateIndex
CREATE INDEX "SourceTagClickDaily_brandId_idx" ON "SourceTagClickDaily"("brandId");

-- CreateIndex
CREATE UNIQUE INDEX "SourceTagClickDaily_date_tag_brandId_key" ON "SourceTagClickDaily"("date", "tag", "brandId");

-- CreateIndex
CREATE INDEX "ArchivedYouTubeVideo_brandId_idx" ON "ArchivedYouTubeVideo"("brandId");

-- CreateIndex
CREATE UNIQUE INDEX "StrategyNote_brandId_key" ON "StrategyNote"("brandId");

-- CreateIndex
CREATE INDEX "ShowrunnerVideoStatus_brandId_updatedAt_idx" ON "ShowrunnerVideoStatus"("brandId", "updatedAt");

-- CreateIndex
CREATE UNIQUE INDEX "ShowrunnerVideoStatus_brandId_batch_key" ON "ShowrunnerVideoStatus"("brandId", "batch");

-- CreateIndex
CREATE INDEX "ShowrunnerFeedback_brandId_seriesSlug_createdAt_idx" ON "ShowrunnerFeedback"("brandId", "seriesSlug", "createdAt");

-- CreateIndex
CREATE INDEX "DailyLog_membershipId_date_idx" ON "DailyLog"("membershipId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "DailyLog_membershipId_date_key" ON "DailyLog"("membershipId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "log_items_legacyKey_key" ON "log_items"("legacyKey");

-- CreateIndex
CREATE INDEX "log_items_membershipId_isToday_status_workDate_idx" ON "log_items"("membershipId", "isToday", "status", "workDate");

-- CreateIndex
CREATE INDEX "log_items_membershipId_sortOrder_idx" ON "log_items"("membershipId", "sortOrder");

-- CreateIndex
CREATE INDEX "focus_quotes_membershipId_sortOrder_idx" ON "focus_quotes"("membershipId", "sortOrder");

-- CreateIndex
CREATE UNIQUE INDEX "focus_quote_settings_membershipId_key" ON "focus_quote_settings"("membershipId");

-- CreateIndex
CREATE INDEX "standards_checks_membershipId_idx" ON "standards_checks"("membershipId");

-- CreateIndex
CREATE UNIQUE INDEX "standards_checks_membershipId_standardKey_key" ON "standards_checks"("membershipId", "standardKey");

-- CreateIndex
CREATE UNIQUE INDEX "scorecard_attendance_records_membershipId_date_key" ON "scorecard_attendance_records"("membershipId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "scorecard_task_records_membershipId_weekStart_key" ON "scorecard_task_records"("membershipId", "weekStart");

-- CreateIndex
CREATE UNIQUE INDEX "legends_name_key" ON "legends"("name");

-- CreateIndex
CREATE UNIQUE INDEX "legends_slug_key" ON "legends"("slug");

-- CreateIndex
CREATE INDEX "legends_active_sortOrder_idx" ON "legends"("active", "sortOrder");

-- CreateIndex
CREATE INDEX "motivational_quotes_active_sortOrder_idx" ON "motivational_quotes"("active", "sortOrder");

-- CreateIndex
CREATE INDEX "motivational_quotes_legendId_active_sortOrder_idx" ON "motivational_quotes"("legendId", "active", "sortOrder");

-- CreateIndex
CREATE UNIQUE INDEX "Engagement_agreementCancellationTokenHash_key" ON "Engagement"("agreementCancellationTokenHash");

-- CreateIndex
CREATE INDEX "Engagement_brandId_status_engagementType_idx" ON "Engagement"("brandId", "status", "engagementType");

-- CreateIndex
CREATE INDEX "Engagement_assignedOwnerMembershipId_idx" ON "Engagement"("assignedOwnerMembershipId");

-- CreateIndex
CREATE INDEX "Engagement_createdAt_idx" ON "Engagement"("createdAt");

-- CreateIndex
CREATE INDEX "DiscoveryItem_engagementId_idx" ON "DiscoveryItem"("engagementId");

-- CreateIndex
CREATE UNIQUE INDEX "proposal_documents_engagementId_key" ON "proposal_documents"("engagementId");

-- CreateIndex
CREATE UNIQUE INDEX "proposal_documents_slug_key" ON "proposal_documents"("slug");

-- CreateIndex
CREATE INDEX "proposal_documents_brandId_displayMode_status_idx" ON "proposal_documents"("brandId", "displayMode", "status");

-- CreateIndex
CREATE INDEX "proposal_documents_publicStatus_slug_idx" ON "proposal_documents"("publicStatus", "slug");

-- CreateIndex
CREATE INDEX "proposal_phases_proposalId_displayOrder_idx" ON "proposal_phases"("proposalId", "displayOrder");

-- CreateIndex
CREATE INDEX "proposal_phase_items_phaseId_displayOrder_idx" ON "proposal_phase_items"("phaseId", "displayOrder");

-- CreateIndex
CREATE INDEX "proposal_sections_proposalId_displayOrder_idx" ON "proposal_sections"("proposalId", "displayOrder");

-- CreateIndex
CREATE INDEX "proposal_section_items_sectionId_displayOrder_idx" ON "proposal_section_items"("sectionId", "displayOrder");

-- CreateIndex
CREATE INDEX "ProposalPackage_brandId_scenario_isActive_displayOrder_idx" ON "ProposalPackage"("brandId", "scenario", "isActive", "displayOrder");

-- CreateIndex
CREATE UNIQUE INDEX "ProposalPackage_brandId_key_key" ON "ProposalPackage"("brandId", "key");

-- CreateIndex
CREATE INDEX "ProposalPackageFeature_packageId_displayOrder_idx" ON "ProposalPackageFeature"("packageId", "displayOrder");

-- CreateIndex
CREATE INDEX "catalog_services_brandId_active_category_idx" ON "catalog_services"("brandId", "active", "category");

-- CreateIndex
CREATE INDEX "catalog_services_brandId_offer_section_active_priority_idx" ON "catalog_services"("brandId", "offer_section", "active", "priority");

-- CreateIndex
CREATE INDEX "catalog_services_brandId_realEstateSpecific_idx" ON "catalog_services"("brandId", "realEstateSpecific");

-- CreateIndex
CREATE INDEX "catalog_services_brandId_product_kind_active_idx" ON "catalog_services"("brandId", "product_kind", "active");

-- CreateIndex
CREATE INDEX "catalog_services_brandId_tagId_idx" ON "catalog_services"("brandId", "tagId");

-- CreateIndex
CREATE UNIQUE INDEX "catalog_services_brandId_code_key" ON "catalog_services"("brandId", "code");

-- CreateIndex
CREATE UNIQUE INDEX "catalog_services_brandId_offer_key_key" ON "catalog_services"("brandId", "offer_key");

-- CreateIndex
CREATE INDEX "catalog_service_tags_brandId_tagId_idx" ON "catalog_service_tags"("brandId", "tagId");

-- CreateIndex
CREATE UNIQUE INDEX "catalog_service_tags_serviceId_tagId_key" ON "catalog_service_tags"("serviceId", "tagId");

-- CreateIndex
CREATE INDEX "package_services_packageId_idx" ON "package_services"("packageId");

-- CreateIndex
CREATE INDEX "package_services_serviceId_idx" ON "package_services"("serviceId");

-- CreateIndex
CREATE UNIQUE INDEX "package_services_packageId_serviceId_key" ON "package_services"("packageId", "serviceId");

-- CreateIndex
CREATE INDEX "pricing_rules_packageId_sortOrder_idx" ON "pricing_rules"("packageId", "sortOrder");

-- CreateIndex
CREATE INDEX "proposal_selections_engagementId_idx" ON "proposal_selections"("engagementId");

-- CreateIndex
CREATE INDEX "quote_clients_brandId_email_idx" ON "quote_clients"("brandId", "email");

-- CreateIndex
CREATE UNIQUE INDEX "quotes_offerCode_key" ON "quotes"("offerCode");

-- CreateIndex
CREATE UNIQUE INDEX "quotes_slug_key" ON "quotes"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "quotes_publicToken_key" ON "quotes"("publicToken");

-- CreateIndex
CREATE UNIQUE INDEX "quotes_engagementId_key" ON "quotes"("engagementId");

-- CreateIndex
CREATE INDEX "quotes_brandId_clientId_status_idx" ON "quotes"("brandId", "clientId", "status");

-- CreateIndex
CREATE INDEX "quotes_brandId_publishedAt_idx" ON "quotes"("brandId", "publishedAt");

-- CreateIndex
CREATE INDEX "quotes_status_createdAt_idx" ON "quotes"("status", "createdAt");

-- CreateIndex
CREATE INDEX "quotes_brandId_engagementId_idx" ON "quotes"("brandId", "engagementId");

-- CreateIndex
CREATE INDEX "quotes_brandId_status_lastActivityAt_idx" ON "quotes"("brandId", "status", "lastActivityAt");

-- CreateIndex
CREATE INDEX "quote_revisions_brandId_quoteId_version_idx" ON "quote_revisions"("brandId", "quoteId", "version");

-- CreateIndex
CREATE INDEX "quote_revisions_brandId_publishedAt_idx" ON "quote_revisions"("brandId", "publishedAt");

-- CreateIndex
CREATE UNIQUE INDEX "quote_revisions_quoteId_version_key" ON "quote_revisions"("quoteId", "version");

-- CreateIndex
CREATE INDEX "quote_line_items_quoteId_sortOrder_idx" ON "quote_line_items"("quoteId", "sortOrder");

-- CreateIndex
CREATE UNIQUE INDEX "quote_templates_slug_key" ON "quote_templates"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "firm_profile_brandId_key" ON "firm_profile"("brandId");

-- CreateIndex
CREATE INDEX "CompanyRevenueMonth_brandId_idx" ON "CompanyRevenueMonth"("brandId");

-- CreateIndex
CREATE UNIQUE INDEX "CompanyRevenueMonth_brandId_monthStart_key" ON "CompanyRevenueMonth"("brandId", "monthStart");

-- CreateIndex
CREATE INDEX "BrandFeature_brandId_enabled_idx" ON "BrandFeature"("brandId", "enabled");

-- CreateIndex
CREATE UNIQUE INDEX "BrandFeature_brandId_key_key" ON "BrandFeature"("brandId", "key");

-- CreateIndex
CREATE INDEX "CustomerArSnapshot_brandId_customerName_idx" ON "CustomerArSnapshot"("brandId", "customerName");

-- CreateIndex
CREATE INDEX "CustomerArSnapshot_brandId_qboCustomerId_idx" ON "CustomerArSnapshot"("brandId", "qboCustomerId");

-- CreateIndex
CREATE UNIQUE INDEX "CustomerArSnapshot_brandId_qbCompany_customerName_invoiceRef_ke" ON "CustomerArSnapshot"("brandId", "qbCompany", "customerName", "invoiceRef");

-- CreateIndex
CREATE UNIQUE INDEX "CustomerArSnapshot_brandId_qbCompany_qboInvoiceId_key" ON "CustomerArSnapshot"("brandId", "qbCompany", "qboInvoiceId");

-- CreateIndex
CREATE INDEX "BrandIntegration_brandId_provider_status_idx" ON "BrandIntegration"("brandId", "provider", "status");

-- CreateIndex
CREATE INDEX "BrandIntegration_brandId_assetOwner_idx" ON "BrandIntegration"("brandId", "assetOwner");

-- CreateIndex
CREATE UNIQUE INDEX "BrandIntegration_brandId_key_key" ON "BrandIntegration"("brandId", "key");

-- CreateIndex
CREATE INDEX "AgreementTemplate_brandId_status_name_idx" ON "AgreementTemplate"("brandId", "status", "name");

-- CreateIndex
CREATE INDEX "AgreementTemplate_brandId_isDefault_status_idx" ON "AgreementTemplate"("brandId", "isDefault", "status");

-- CreateIndex
CREATE INDEX "AgreementTemplate_brandId_defaultForProductKind_status_idx" ON "AgreementTemplate"("brandId", "defaultForProductKind", "status");

-- CreateIndex
CREATE UNIQUE INDEX "AgreementTemplate_brandId_key_key" ON "AgreementTemplate"("brandId", "key");

-- CreateIndex
CREATE INDEX "ProposalOptionsTemplate_brandId_productKind_archivedAt_idx" ON "ProposalOptionsTemplate"("brandId", "productKind", "archivedAt");

-- CreateIndex
CREATE UNIQUE INDEX "ProposalOptionsTemplate_brandId_defaultForProductKind_key" ON "ProposalOptionsTemplate"("brandId", "defaultForProductKind") WHERE "defaultForProductKind" IS NOT NULL;

-- CreateIndex
CREATE INDEX "AuditEvent_brandId_occurredAt_idx" ON "AuditEvent"("brandId", "occurredAt");

-- CreateIndex
CREATE INDEX "AuditEvent_actorUserId_occurredAt_idx" ON "AuditEvent"("actorUserId", "occurredAt");

-- CreateIndex
CREATE INDEX "AuditEvent_resourceType_resourceId_occurredAt_idx" ON "AuditEvent"("resourceType", "resourceId", "occurredAt");

-- CreateIndex
CREATE INDEX "CustomerAccount_brandId_status_name_idx" ON "CustomerAccount"("brandId", "status", "name");

-- CreateIndex
CREATE INDEX "CustomerAccount_brandId_createdAt_idx" ON "CustomerAccount"("brandId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "CustomerAccount_brandId_id_key" ON "CustomerAccount"("brandId", "id");

-- CreateIndex
CREATE UNIQUE INDEX "CustomerAccount_brandId_code_key" ON "CustomerAccount"("brandId", "code");

-- CreateIndex
CREATE INDEX "CustomerContact_brandId_contactId_idx" ON "CustomerContact"("brandId", "contactId");

-- CreateIndex
CREATE INDEX "CustomerContact_brandId_customerAccountId_isPrimary_idx" ON "CustomerContact"("brandId", "customerAccountId", "isPrimary");

-- CreateIndex
CREATE UNIQUE INDEX "CustomerContact_brandId_customerAccountId_contactId_key" ON "CustomerContact"("brandId", "customerAccountId", "contactId");

-- CreateIndex
CREATE INDEX "Lead_brandId_status_createdAt_idx" ON "Lead"("brandId", "status", "createdAt");

-- CreateIndex
CREATE INDEX "Lead_brandId_normalizedEmail_idx" ON "Lead"("brandId", "normalizedEmail");

-- CreateIndex
CREATE UNIQUE INDEX "Lead_brandId_id_key" ON "Lead"("brandId", "id");

-- CreateIndex
CREATE INDEX "LeadAttributionTouch_brandId_leadId_capturedAt_idx" ON "LeadAttributionTouch"("brandId", "leadId", "capturedAt");

-- CreateIndex
CREATE INDEX "BrandOffboardingPlan_brandId_status_idx" ON "BrandOffboardingPlan"("brandId", "status");

-- CreateIndex
CREATE INDEX "BrandDataExport_brandId_status_requestedAt_idx" ON "BrandDataExport"("brandId", "status", "requestedAt");

-- CreateIndex
CREATE UNIQUE INDEX "EmailConnection_membershipId_key" ON "EmailConnection"("membershipId");

-- CreateIndex
CREATE INDEX "EmailConnection_brandId_idx" ON "EmailConnection"("brandId");

-- CreateIndex
CREATE INDEX "EmailConnection_brandId_status_provider_idx" ON "EmailConnection"("brandId", "status", "provider");

-- CreateIndex
CREATE UNIQUE INDEX "PipeTask_pipeId_key" ON "PipeTask"("pipeId");

-- CreateIndex
CREATE INDEX "PipeTask_brandId_stage_idx" ON "PipeTask"("brandId", "stage");

-- CreateIndex
CREATE INDEX "PipeTask_ownerKey_idx" ON "PipeTask"("ownerKey");

-- CreateIndex
CREATE INDEX "PipeTaskTag_label_idx" ON "PipeTaskTag"("label");

-- CreateIndex
CREATE UNIQUE INDEX "PipeTaskTag_taskId_label_key" ON "PipeTaskTag"("taskId", "label");

-- CreateIndex
CREATE UNIQUE INDEX "PipeTaskNote_taskId_pipeNoteId_key" ON "PipeTaskNote"("taskId", "pipeNoteId");

-- CreateIndex
CREATE INDEX "proposal_view_events_quoteId_occurredAt_idx" ON "proposal_view_events"("quoteId", "occurredAt");

-- CreateIndex
CREATE INDEX "proposal_view_events_quoteId_sessionId_idx" ON "proposal_view_events"("quoteId", "sessionId");

-- AddForeignKey
ALTER TABLE "Account" ADD CONSTRAINT "Account_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BrandDomain" ADD CONSTRAINT "BrandDomain_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "Brand"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LocalSeoConfig" ADD CONSTRAINT "LocalSeoConfig_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "Brand"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LocalSeoScan" ADD CONSTRAINT "LocalSeoScan_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "Brand"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LocalSeoGridCell" ADD CONSTRAINT "LocalSeoGridCell_scanId_fkey" FOREIGN KEY ("scanId") REFERENCES "LocalSeoScan"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BrandMembership" ADD CONSTRAINT "BrandMembership_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "Brand"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BrandMembership" ADD CONSTRAINT "BrandMembership_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BrandTheme" ADD CONSTRAINT "BrandTheme_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "Brand"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BrandToolLink" ADD CONSTRAINT "BrandToolLink_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "Brand"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BrandMediaFolder" ADD CONSTRAINT "BrandMediaFolder_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "Brand"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BrandMedia" ADD CONSTRAINT "BrandMedia_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "Brand"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BrandMedia" ADD CONSTRAINT "BrandMedia_folderId_fkey" FOREIGN KEY ("folderId") REFERENCES "BrandMediaFolder"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BrandDiscount" ADD CONSTRAINT "BrandDiscount_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "Brand"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BrandDiscount" ADD CONSTRAINT "BrandDiscount_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "Contact"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "brand_discount_quotes" ADD CONSTRAINT "brand_discount_quotes_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "Brand"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "brand_discount_quotes" ADD CONSTRAINT "brand_discount_quotes_discountId_fkey" FOREIGN KEY ("discountId") REFERENCES "BrandDiscount"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "brand_discount_quotes" ADD CONSTRAINT "brand_discount_quotes_quoteId_fkey" FOREIGN KEY ("quoteId") REFERENCES "quotes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InternProfile" ADD CONSTRAINT "InternProfile_membershipId_fkey" FOREIGN KEY ("membershipId") REFERENCES "BrandMembership"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "member_onboarding_profiles" ADD CONSTRAINT "member_onboarding_profiles_membershipId_fkey" FOREIGN KEY ("membershipId") REFERENCES "BrandMembership"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "member_onboarding_profiles" ADD CONSTRAINT "member_onboarding_profiles_createdByMembershipId_fkey" FOREIGN KEY ("createdByMembershipId") REFERENCES "BrandMembership"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "member_onboarding_profiles" ADD CONSTRAINT "member_onboarding_profiles_updatedByMembershipId_fkey" FOREIGN KEY ("updatedByMembershipId") REFERENCES "BrandMembership"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "member_documents" ADD CONSTRAINT "member_documents_membershipId_fkey" FOREIGN KEY ("membershipId") REFERENCES "BrandMembership"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "member_documents" ADD CONSTRAINT "member_documents_uploadedByMembershipId_fkey" FOREIGN KEY ("uploadedByMembershipId") REFERENCES "BrandMembership"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "member_audit_events" ADD CONSTRAINT "member_audit_events_membershipId_fkey" FOREIGN KEY ("membershipId") REFERENCES "BrandMembership"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "member_audit_events" ADD CONSTRAINT "member_audit_events_changedByMembershipId_fkey" FOREIGN KEY ("changedByMembershipId") REFERENCES "BrandMembership"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OnboardingInvite" ADD CONSTRAINT "OnboardingInvite_createdByMembershipId_fkey" FOREIGN KEY ("createdByMembershipId") REFERENCES "BrandMembership"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OnboardingInvite" ADD CONSTRAINT "OnboardingInvite_linkedMembershipId_fkey" FOREIGN KEY ("linkedMembershipId") REFERENCES "BrandMembership"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OnboardingSubmission" ADD CONSTRAINT "OnboardingSubmission_inviteId_fkey" FOREIGN KEY ("inviteId") REFERENCES "OnboardingInvite"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AgreementAcceptance" ADD CONSTRAINT "AgreementAcceptance_membershipId_fkey" FOREIGN KEY ("membershipId") REFERENCES "BrandMembership"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MemberOnboardingStep" ADD CONSTRAINT "MemberOnboardingStep_membershipId_fkey" FOREIGN KEY ("membershipId") REFERENCES "BrandMembership"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OnboardingFlowStepConfig" ADD CONSTRAINT "OnboardingFlowStepConfig_flowId_fkey" FOREIGN KEY ("flowId") REFERENCES "OnboardingFlow"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OnboardingFlowCustomStep" ADD CONSTRAINT "OnboardingFlowCustomStep_flowId_fkey" FOREIGN KEY ("flowId") REFERENCES "OnboardingFlow"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OnboardingFlowAssignment" ADD CONSTRAINT "OnboardingFlowAssignment_membershipId_fkey" FOREIGN KEY ("membershipId") REFERENCES "BrandMembership"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OnboardingFlowAssignment" ADD CONSTRAINT "OnboardingFlowAssignment_flowId_fkey" FOREIGN KEY ("flowId") REFERENCES "OnboardingFlow"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OnboardingStepQuestion" ADD CONSTRAINT "OnboardingStepQuestion_membershipId_fkey" FOREIGN KEY ("membershipId") REFERENCES "BrandMembership"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OnboardingStepQuestion" ADD CONSTRAINT "OnboardingStepQuestion_flowId_fkey" FOREIGN KEY ("flowId") REFERENCES "OnboardingFlow"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OnboardingStepUpload" ADD CONSTRAINT "OnboardingStepUpload_membershipId_fkey" FOREIGN KEY ("membershipId") REFERENCES "BrandMembership"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OnboardingStepUpload" ADD CONSTRAINT "OnboardingStepUpload_flowId_fkey" FOREIGN KEY ("flowId") REFERENCES "OnboardingFlow"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OnboardingFlowStepOrder" ADD CONSTRAINT "OnboardingFlowStepOrder_flowId_fkey" FOREIGN KEY ("flowId") REFERENCES "OnboardingFlow"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TimecardEntry" ADD CONSTRAINT "TimecardEntry_membershipId_fkey" FOREIGN KEY ("membershipId") REFERENCES "BrandMembership"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TimecardSession" ADD CONSTRAINT "TimecardSession_membershipId_fkey" FOREIGN KEY ("membershipId") REFERENCES "BrandMembership"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContractorInvoice" ADD CONSTRAINT "ContractorInvoice_membershipId_fkey" FOREIGN KEY ("membershipId") REFERENCES "BrandMembership"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CareerPathStep" ADD CONSTRAINT "CareerPathStep_membershipId_fkey" FOREIGN KEY ("membershipId") REFERENCES "BrandMembership"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MemberCredentialBadge" ADD CONSTRAINT "MemberCredentialBadge_membershipId_fkey" FOREIGN KEY ("membershipId") REFERENCES "BrandMembership"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MemberCredentialBadge" ADD CONSTRAINT "MemberCredentialBadge_badgeId_fkey" FOREIGN KEY ("badgeId") REFERENCES "CredentialBadge"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClientIntakeInvite" ADD CONSTRAINT "ClientIntakeInvite_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "TicketClient"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClientIntakeInvite" ADD CONSTRAINT "ClientIntakeInvite_createdByMembershipId_fkey" FOREIGN KEY ("createdByMembershipId") REFERENCES "BrandMembership"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReviewRequest" ADD CONSTRAINT "ReviewRequest_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "TicketClient"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReviewRequest" ADD CONSTRAINT "ReviewRequest_sentByMembershipId_fkey" FOREIGN KEY ("sentByMembershipId") REFERENCES "BrandMembership"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReviewRequest" ADD CONSTRAINT "ReviewRequest_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "Contact"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReviewRequest" ADD CONSTRAINT "ReviewRequest_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "Campaign"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CampaignContact" ADD CONSTRAINT "CampaignContact_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "Campaign"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CampaignContact" ADD CONSTRAINT "CampaignContact_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "Contact"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Contact" ADD CONSTRAINT "Contact_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "Brand"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contact_brand_links" ADD CONSTRAINT "contact_brand_links_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "Contact"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contact_brand_links" ADD CONSTRAINT "contact_brand_links_relatedBrandId_fkey" FOREIGN KEY ("relatedBrandId") REFERENCES "Brand"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contact_tags" ADD CONSTRAINT "contact_tags_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "Brand"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contact_tag_links" ADD CONSTRAINT "contact_tag_links_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "Contact"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contact_tag_links" ADD CONSTRAINT "contact_tag_links_tagId_fkey" FOREIGN KEY ("tagId") REFERENCES "contact_tags"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contact_tag_automations" ADD CONSTRAINT "contact_tag_automations_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "Brand"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contact_tag_automations" ADD CONSTRAINT "contact_tag_automations_tagId_fkey" FOREIGN KEY ("tagId") REFERENCES "contact_tags"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contact_tag_automations" ADD CONSTRAINT "contact_tag_automations_pipelineId_fkey" FOREIGN KEY ("pipelineId") REFERENCES "Pipeline"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contact_tag_automations" ADD CONSTRAINT "contact_tag_automations_stageId_fkey" FOREIGN KEY ("stageId") REFERENCES "PipelineStage"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClientContact" ADD CONSTRAINT "ClientContact_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "TicketClient"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClientContact" ADD CONSTRAINT "ClientContact_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "Contact"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LeadContact" ADD CONSTRAINT "LeadContact_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "Brand"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LeadContact" ADD CONSTRAINT "LeadContact_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "MeetingLead"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LeadContact" ADD CONSTRAINT "LeadContact_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "Contact"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Ticket" ADD CONSTRAINT "Ticket_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "TicketClient"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Ticket" ADD CONSTRAINT "Ticket_assignedMembershipId_fkey" FOREIGN KEY ("assignedMembershipId") REFERENCES "BrandMembership"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TicketComment" ADD CONSTRAINT "TicketComment_ticketId_fkey" FOREIGN KEY ("ticketId") REFERENCES "Ticket"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TicketComment" ADD CONSTRAINT "TicketComment_authorMembershipId_fkey" FOREIGN KEY ("authorMembershipId") REFERENCES "BrandMembership"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeamMeeting" ADD CONSTRAINT "TeamMeeting_createdByMembershipId_fkey" FOREIGN KEY ("createdByMembershipId") REFERENCES "BrandMembership"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeamMeetingAccess" ADD CONSTRAINT "TeamMeetingAccess_meetingId_fkey" FOREIGN KEY ("meetingId") REFERENCES "TeamMeeting"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeamMeetingAccess" ADD CONSTRAINT "TeamMeetingAccess_membershipId_fkey" FOREIGN KEY ("membershipId") REFERENCES "BrandMembership"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeamMeetingClient" ADD CONSTRAINT "TeamMeetingClient_meetingId_fkey" FOREIGN KEY ("meetingId") REFERENCES "TeamMeeting"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeamMeetingClient" ADD CONSTRAINT "TeamMeetingClient_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "TicketClient"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MeetingLead" ADD CONSTRAINT "MeetingLead_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "TicketClient"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MeetingLead" ADD CONSTRAINT "MeetingLead_customerAccountId_fkey" FOREIGN KEY ("customerAccountId") REFERENCES "CustomerAccount"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeamMeetingLead" ADD CONSTRAINT "TeamMeetingLead_meetingId_fkey" FOREIGN KEY ("meetingId") REFERENCES "TeamMeeting"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeamMeetingLead" ADD CONSTRAINT "TeamMeetingLead_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "MeetingLead"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeamMeetingTag" ADD CONSTRAINT "TeamMeetingTag_meetingId_fkey" FOREIGN KEY ("meetingId") REFERENCES "TeamMeeting"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeamMeetingTag" ADD CONSTRAINT "TeamMeetingTag_tagId_fkey" FOREIGN KEY ("tagId") REFERENCES "MeetingTag"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeamMeetingContact" ADD CONSTRAINT "TeamMeetingContact_meetingId_fkey" FOREIGN KEY ("meetingId") REFERENCES "TeamMeeting"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeamMeetingContact" ADD CONSTRAINT "TeamMeetingContact_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "Contact"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Pipeline" ADD CONSTRAINT "Pipeline_createdByMembershipId_fkey" FOREIGN KEY ("createdByMembershipId") REFERENCES "BrandMembership"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PipelineStage" ADD CONSTRAINT "PipelineStage_pipelineId_fkey" FOREIGN KEY ("pipelineId") REFERENCES "Pipeline"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PipelineItem" ADD CONSTRAINT "PipelineItem_pipelineId_fkey" FOREIGN KEY ("pipelineId") REFERENCES "Pipeline"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PipelineItem" ADD CONSTRAINT "PipelineItem_stageId_fkey" FOREIGN KEY ("stageId") REFERENCES "PipelineStage"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PipelineItem" ADD CONSTRAINT "PipelineItem_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "MeetingLead"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AllThingWriteJob" ADD CONSTRAINT "AllThingWriteJob_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "SalesEvidenceEvent"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScanRole" ADD CONSTRAINT "ScanRole_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "Brand"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScanFinding" ADD CONSTRAINT "ScanFinding_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "Brand"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScanFinding" ADD CONSTRAINT "ScanFinding_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "ScanRole"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContentCalendarItem" ADD CONSTRAINT "ContentCalendarItem_createdByMembershipId_fkey" FOREIGN KEY ("createdByMembershipId") REFERENCES "BrandMembership"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShowrunnerVideoStatus" ADD CONSTRAINT "ShowrunnerVideoStatus_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "Brand"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShowrunnerFeedback" ADD CONSTRAINT "ShowrunnerFeedback_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "Brand"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DailyLog" ADD CONSTRAINT "DailyLog_membershipId_fkey" FOREIGN KEY ("membershipId") REFERENCES "BrandMembership"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "log_items" ADD CONSTRAINT "log_items_membershipId_fkey" FOREIGN KEY ("membershipId") REFERENCES "BrandMembership"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "focus_quotes" ADD CONSTRAINT "focus_quotes_membershipId_fkey" FOREIGN KEY ("membershipId") REFERENCES "BrandMembership"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "focus_quote_settings" ADD CONSTRAINT "focus_quote_settings_membershipId_fkey" FOREIGN KEY ("membershipId") REFERENCES "BrandMembership"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "focus_quote_settings" ADD CONSTRAINT "focus_quote_settings_pinnedQuoteId_fkey" FOREIGN KEY ("pinnedQuoteId") REFERENCES "focus_quotes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "standards_checks" ADD CONSTRAINT "standards_checks_membershipId_fkey" FOREIGN KEY ("membershipId") REFERENCES "BrandMembership"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "standards_checks" ADD CONSTRAINT "standards_checks_reviewedByMembershipId_fkey" FOREIGN KEY ("reviewedByMembershipId") REFERENCES "BrandMembership"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scorecard_attendance_records" ADD CONSTRAINT "scorecard_attendance_records_membershipId_fkey" FOREIGN KEY ("membershipId") REFERENCES "BrandMembership"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scorecard_task_records" ADD CONSTRAINT "scorecard_task_records_membershipId_fkey" FOREIGN KEY ("membershipId") REFERENCES "BrandMembership"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "motivational_quotes" ADD CONSTRAINT "motivational_quotes_legendId_fkey" FOREIGN KEY ("legendId") REFERENCES "legends"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Engagement" ADD CONSTRAINT "Engagement_assignedOwnerMembershipId_fkey" FOREIGN KEY ("assignedOwnerMembershipId") REFERENCES "BrandMembership"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Engagement" ADD CONSTRAINT "Engagement_internalReviewerMembershipId_fkey" FOREIGN KEY ("internalReviewerMembershipId") REFERENCES "BrandMembership"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Engagement" ADD CONSTRAINT "Engagement_createdByMembershipId_fkey" FOREIGN KEY ("createdByMembershipId") REFERENCES "BrandMembership"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DiscoveryItem" ADD CONSTRAINT "DiscoveryItem_engagementId_fkey" FOREIGN KEY ("engagementId") REFERENCES "Engagement"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "proposal_documents" ADD CONSTRAINT "proposal_documents_engagementId_fkey" FOREIGN KEY ("engagementId") REFERENCES "Engagement"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "proposal_phases" ADD CONSTRAINT "proposal_phases_proposalId_fkey" FOREIGN KEY ("proposalId") REFERENCES "proposal_documents"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "proposal_phase_items" ADD CONSTRAINT "proposal_phase_items_phaseId_fkey" FOREIGN KEY ("phaseId") REFERENCES "proposal_phases"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "proposal_sections" ADD CONSTRAINT "proposal_sections_proposalId_fkey" FOREIGN KEY ("proposalId") REFERENCES "proposal_documents"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "proposal_section_items" ADD CONSTRAINT "proposal_section_items_sectionId_fkey" FOREIGN KEY ("sectionId") REFERENCES "proposal_sections"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProposalPackageFeature" ADD CONSTRAINT "ProposalPackageFeature_packageId_fkey" FOREIGN KEY ("packageId") REFERENCES "ProposalPackage"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "catalog_services" ADD CONSTRAINT "catalog_services_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "Brand"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "catalog_services" ADD CONSTRAINT "catalog_services_tagId_fkey" FOREIGN KEY ("tagId") REFERENCES "contact_tags"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "catalog_service_tags" ADD CONSTRAINT "catalog_service_tags_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "Brand"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "catalog_service_tags" ADD CONSTRAINT "catalog_service_tags_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "catalog_services"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "catalog_service_tags" ADD CONSTRAINT "catalog_service_tags_tagId_fkey" FOREIGN KEY ("tagId") REFERENCES "contact_tags"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "package_services" ADD CONSTRAINT "package_services_packageId_fkey" FOREIGN KEY ("packageId") REFERENCES "ProposalPackage"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "package_services" ADD CONSTRAINT "package_services_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "catalog_services"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pricing_rules" ADD CONSTRAINT "pricing_rules_packageId_fkey" FOREIGN KEY ("packageId") REFERENCES "ProposalPackage"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quotes" ADD CONSTRAINT "quotes_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "quote_clients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quotes" ADD CONSTRAINT "quotes_engagementId_fkey" FOREIGN KEY ("engagementId") REFERENCES "Engagement"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quote_revisions" ADD CONSTRAINT "quote_revisions_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "Brand"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quote_revisions" ADD CONSTRAINT "quote_revisions_quoteId_fkey" FOREIGN KEY ("quoteId") REFERENCES "quotes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quote_line_items" ADD CONSTRAINT "quote_line_items_quoteId_fkey" FOREIGN KEY ("quoteId") REFERENCES "quotes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BrandFeature" ADD CONSTRAINT "BrandFeature_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "Brand"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BrandIntegration" ADD CONSTRAINT "BrandIntegration_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "Brand"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AgreementTemplate" ADD CONSTRAINT "AgreementTemplate_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "Brand"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProposalOptionsTemplate" ADD CONSTRAINT "ProposalOptionsTemplate_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "Brand"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditEvent" ADD CONSTRAINT "AuditEvent_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "Brand"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditEvent" ADD CONSTRAINT "AuditEvent_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomerAccount" ADD CONSTRAINT "CustomerAccount_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "Brand"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomerContact" ADD CONSTRAINT "CustomerContact_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "Brand"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomerContact" ADD CONSTRAINT "CustomerContact_brandId_customerAccountId_fkey" FOREIGN KEY ("brandId", "customerAccountId") REFERENCES "CustomerAccount"("brandId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomerContact" ADD CONSTRAINT "CustomerContact_brandId_contactId_fkey" FOREIGN KEY ("brandId", "contactId") REFERENCES "Contact"("brandId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Lead" ADD CONSTRAINT "Lead_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "Brand"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Lead" ADD CONSTRAINT "Lead_brandId_convertedCustomerId_fkey" FOREIGN KEY ("brandId", "convertedCustomerId") REFERENCES "CustomerAccount"("brandId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LeadAttributionTouch" ADD CONSTRAINT "LeadAttributionTouch_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "Brand"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LeadAttributionTouch" ADD CONSTRAINT "LeadAttributionTouch_brandId_leadId_fkey" FOREIGN KEY ("brandId", "leadId") REFERENCES "Lead"("brandId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BrandOffboardingPlan" ADD CONSTRAINT "BrandOffboardingPlan_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "Brand"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BrandOffboardingPlan" ADD CONSTRAINT "BrandOffboardingPlan_initiatedByUserId_fkey" FOREIGN KEY ("initiatedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BrandDataExport" ADD CONSTRAINT "BrandDataExport_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "Brand"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BrandDataExport" ADD CONSTRAINT "BrandDataExport_offboardingPlanId_fkey" FOREIGN KEY ("offboardingPlanId") REFERENCES "BrandOffboardingPlan"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BrandDataExport" ADD CONSTRAINT "BrandDataExport_requestedByUserId_fkey" FOREIGN KEY ("requestedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmailConnection" ADD CONSTRAINT "EmailConnection_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "Brand"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmailConnection" ADD CONSTRAINT "EmailConnection_membershipId_fkey" FOREIGN KEY ("membershipId") REFERENCES "BrandMembership"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PipeTask" ADD CONSTRAINT "PipeTask_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "Brand"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PipeTaskTag" ADD CONSTRAINT "PipeTaskTag_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "PipeTask"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PipeTaskNote" ADD CONSTRAINT "PipeTaskNote_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "PipeTask"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "proposal_view_events" ADD CONSTRAINT "proposal_view_events_quoteId_fkey" FOREIGN KEY ("quoteId") REFERENCES "quotes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Check constraints and partial indexes (not modelled by Prisma).
ALTER TABLE "ScanFinding" ADD CONSTRAINT "ScanFinding_fixLevel_check" CHECK (("fixLevel" = ANY (ARRAY[1, 2, 3])));
ALTER TABLE "ScanFinding" ADD CONSTRAINT "ScanFinding_key_check" CHECK (((char_length(key) >= 1) AND (char_length(key) <= 200)));
ALTER TABLE "ScanFinding" ADD CONSTRAINT "ScanFinding_roleKey_check" CHECK (("roleKey" = ANY (ARRAY['mail-desk'::text, 'sales-pipeline'::text, 'client-delivery'::text, 'systems'::text])));
ALTER TABLE "ScanFinding" ADD CONSTRAINT "ScanFinding_room_check" CHECK ((room = ANY (ARRAY['phone'::text, 'inbox'::text, 'payments'::text, 'contracts'::text, 'non-inbox'::text])));
ALTER TABLE "ScanFinding" ADD CONSTRAINT "ScanFinding_severity_check" CHECK ((severity = ANY (ARRAY['urgent'::text, 'normal'::text])));
ALTER TABLE "ScanFinding" ADD CONSTRAINT "ScanFinding_state_check" CHECK ((state = ANY (ARRAY['open'::text, 'closed'::text])));
ALTER TABLE "ScanFinding" ADD CONSTRAINT "ScanFinding_what_check" CHECK (((char_length(what) >= 1) AND (char_length(what) <= 500)));
ALTER TABLE "ScanRole" ADD CONSTRAINT "ScanRole_key_check" CHECK ((key = ANY (ARRAY['mail-desk'::text, 'sales-pipeline'::text, 'client-delivery'::text, 'systems'::text])));
ALTER TABLE "ShowrunnerFeedback" ADD CONSTRAINT "ShowrunnerFeedback_episode_check" CHECK ((("episodeIndex" IS NULL) OR (("episodeIndex" >= 0) AND ("episodeIndex" <= 99))));
ALTER TABLE "ShowrunnerFeedback" ADD CONSTRAINT "ShowrunnerFeedback_note_check" CHECK (((note IS NULL) OR (char_length(note) <= 2000)));
ALTER TABLE "ShowrunnerFeedback" ADD CONSTRAINT "ShowrunnerFeedback_reaction_check" CHECK ((reaction = ANY (ARRAY['like'::text, 'drop'::text, 'change'::text])));
ALTER TABLE "ShowrunnerFeedback" ADD CONSTRAINT "ShowrunnerFeedback_slug_check" CHECK (((char_length("seriesSlug") >= 1) AND (char_length("seriesSlug") <= 100)));
ALTER TABLE "ShowrunnerVideoStatus" ADD CONSTRAINT "ShowrunnerVideoStatus_batch_check" CHECK (((char_length(batch) >= 1) AND (char_length(batch) <= 60)));
CREATE UNIQUE INDEX "AgreementTemplate_one_active_default_per_brand_key" ON "AgreementTemplate" USING btree ("brandId") WHERE (("isDefault" = true) AND (status = 'active'::text));

-- Row-level security (not modelled by Prisma). Policies scope rows to the
-- brand set in app.current_brand_id for the transaction.

ALTER TABLE "ScanFinding" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ScanFinding" FORCE ROW LEVEL SECURITY;
CREATE POLICY scan_finding_brand_context ON "ScanFinding"
  USING ("brandId" = NULLIF(current_setting('app.current_brand_id', true), ''))
  WITH CHECK ("brandId" = NULLIF(current_setting('app.current_brand_id', true), ''));

ALTER TABLE "ScanRole" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ScanRole" FORCE ROW LEVEL SECURITY;
CREATE POLICY scan_role_brand_context ON "ScanRole"
  USING ("brandId" = NULLIF(current_setting('app.current_brand_id', true), ''))
  WITH CHECK ("brandId" = NULLIF(current_setting('app.current_brand_id', true), ''));

ALTER TABLE "ShowrunnerFeedback" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ShowrunnerFeedback" FORCE ROW LEVEL SECURITY;
CREATE POLICY showrunner_feedback_brand_context ON "ShowrunnerFeedback"
  USING ("brandId" = NULLIF(current_setting('app.current_brand_id', true), ''))
  WITH CHECK ("brandId" = NULLIF(current_setting('app.current_brand_id', true), ''));

ALTER TABLE "ShowrunnerVideoStatus" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ShowrunnerVideoStatus" FORCE ROW LEVEL SECURITY;
CREATE POLICY showrunner_video_status_brand_context ON "ShowrunnerVideoStatus"
  USING ("brandId" = NULLIF(current_setting('app.current_brand_id', true), ''))
  WITH CHECK ("brandId" = NULLIF(current_setting('app.current_brand_id', true), ''));
