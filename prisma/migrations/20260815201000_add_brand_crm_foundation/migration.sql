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

-- CreateTable
CREATE TABLE "CustomerAccount" (
    "id" TEXT NOT NULL,
    "brandId" TEXT NOT NULL,
    "code" TEXT,
    "name" TEXT NOT NULL,
    "legalName" TEXT,
    "status" "CustomerStatus" NOT NULL DEFAULT 'PROSPECT',
    "websiteUrl" TEXT,
    "entityType" TEXT,
    "principalAddressLine1" TEXT,
    "principalAddressLine2" TEXT,
    "principalAddressCity" TEXT,
    "principalAddressRegion" TEXT,
    "principalAddressPostalCode" TEXT,
    "principalAddressCountryCode" TEXT,
    "primaryPhone" TEXT,
    "communicationEmail" TEXT,
    "noticesEmail" TEXT,
    "invoicingEmail" TEXT,
    "customFields" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CustomerAccount_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Contact" (
    "id" TEXT NOT NULL,
    "brandId" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "firstName" TEXT,
    "lastName" TEXT,
    "email" TEXT,
    "normalizedEmail" TEXT,
    "secondaryEmail" TEXT,
    "businessEmail" TEXT,
    "personalEmail" TEXT,
    "phoneE164" TEXT,
    "phoneNumber" TEXT,
    "roleTitle" TEXT,
    "status" "ContactStatus" NOT NULL DEFAULT 'ACTIVE',
    "marketingConsent" "MarketingConsentStatus" NOT NULL DEFAULT 'UNKNOWN',
    "marketingConsentAt" TIMESTAMP(3),
    "marketingConsentSource" TEXT,
    "customFields" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Contact_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CustomerContact" (
    "id" TEXT NOT NULL,
    "brandId" TEXT NOT NULL,
    "customerAccountId" TEXT NOT NULL,
    "contactId" TEXT NOT NULL,
    "relationship" TEXT,
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,
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
    "lostReason" TEXT,
    "convertedAt" TIMESTAMP(3),
    "customFields" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Lead_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LeadContact" (
    "id" TEXT NOT NULL,
    "brandId" TEXT NOT NULL,
    "leadId" TEXT NOT NULL,
    "contactId" TEXT NOT NULL,
    "role" TEXT,
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LeadContact_pkey" PRIMARY KEY ("id")
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
    "referrerUrl" TEXT,
    "gclid" TEXT,
    "gbraid" TEXT,
    "wbraid" TEXT,
    "fbclid" TEXT,
    "msclkid" TEXT,
    "metaCampaignId" TEXT,
    "metaAdSetId" TEXT,
    "metaAdId" TEXT,
    "metadata" JSONB,
    "capturedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LeadAttributionTouch_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CustomerAccount_brandId_status_name_idx" ON "CustomerAccount"("brandId", "status", "name");

-- CreateIndex
CREATE INDEX "CustomerAccount_brandId_createdAt_idx" ON "CustomerAccount"("brandId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "CustomerAccount_brandId_id_key" ON "CustomerAccount"("brandId", "id");

-- CreateIndex
CREATE UNIQUE INDEX "CustomerAccount_brandId_code_key" ON "CustomerAccount"("brandId", "code");

-- CreateIndex
CREATE INDEX "Contact_brandId_status_displayName_idx" ON "Contact"("brandId", "status", "displayName");

-- CreateIndex
CREATE INDEX "Contact_brandId_normalizedEmail_idx" ON "Contact"("brandId", "normalizedEmail");

-- CreateIndex
CREATE INDEX "Contact_brandId_createdAt_idx" ON "Contact"("brandId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Contact_brandId_id_key" ON "Contact"("brandId", "id");

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
CREATE INDEX "Lead_brandId_source_createdAt_idx" ON "Lead"("brandId", "source", "createdAt");

-- CreateIndex
CREATE INDEX "Lead_brandId_convertedCustomerId_idx" ON "Lead"("brandId", "convertedCustomerId");

-- CreateIndex
CREATE UNIQUE INDEX "Lead_brandId_id_key" ON "Lead"("brandId", "id");

-- CreateIndex
CREATE INDEX "LeadContact_brandId_contactId_idx" ON "LeadContact"("brandId", "contactId");

-- CreateIndex
CREATE INDEX "LeadContact_brandId_leadId_isPrimary_idx" ON "LeadContact"("brandId", "leadId", "isPrimary");

-- CreateIndex
CREATE UNIQUE INDEX "LeadContact_brandId_leadId_contactId_key" ON "LeadContact"("brandId", "leadId", "contactId");

-- CreateIndex
CREATE INDEX "LeadAttributionTouch_brandId_leadId_capturedAt_idx" ON "LeadAttributionTouch"("brandId", "leadId", "capturedAt");

-- CreateIndex
CREATE INDEX "LeadAttributionTouch_brandId_source_medium_capturedAt_idx" ON "LeadAttributionTouch"("brandId", "source", "medium", "capturedAt");

-- CreateIndex
CREATE INDEX "LeadAttributionTouch_brandId_campaign_capturedAt_idx" ON "LeadAttributionTouch"("brandId", "campaign", "capturedAt");

-- CreateIndex
CREATE INDEX "LeadAttributionTouch_brandId_fbclid_idx" ON "LeadAttributionTouch"("brandId", "fbclid");

-- CreateIndex
CREATE INDEX "LeadAttributionTouch_brandId_gclid_idx" ON "LeadAttributionTouch"("brandId", "gclid");

-- AddForeignKey
ALTER TABLE "CustomerAccount" ADD CONSTRAINT "CustomerAccount_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "Brand"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Contact" ADD CONSTRAINT "Contact_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "Brand"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

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
ALTER TABLE "LeadContact" ADD CONSTRAINT "LeadContact_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "Brand"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LeadContact" ADD CONSTRAINT "LeadContact_brandId_leadId_fkey" FOREIGN KEY ("brandId", "leadId") REFERENCES "Lead"("brandId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LeadContact" ADD CONSTRAINT "LeadContact_brandId_contactId_fkey" FOREIGN KEY ("brandId", "contactId") REFERENCES "Contact"("brandId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LeadAttributionTouch" ADD CONSTRAINT "LeadAttributionTouch_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "Brand"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LeadAttributionTouch" ADD CONSTRAINT "LeadAttributionTouch_brandId_leadId_fkey" FOREIGN KEY ("brandId", "leadId") REFERENCES "Lead"("brandId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Enforce case-insensitive customer codes within a brand when a code is present.
CREATE UNIQUE INDEX "CustomerAccount_brandId_code_normalized_key" ON "CustomerAccount" ("brandId", lower("code")) WHERE "code" IS NOT NULL;

-- A customer and a lead may each have at most one primary contact.
CREATE UNIQUE INDEX "CustomerContact_one_primary_key" ON "CustomerContact" ("brandId", "customerAccountId") WHERE "isPrimary" = true;
CREATE UNIQUE INDEX "LeadContact_one_primary_key" ON "LeadContact" ("brandId", "leadId") WHERE "isPrimary" = true;

