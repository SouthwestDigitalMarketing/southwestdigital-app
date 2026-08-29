-- This migration is additive and retains legacy publication columns for rollback.
-- Before production deployment: take a database backup, rehearse on a restored copy,
-- compare the reconciliation queries at the bottom, and confirm the rollback plan.

ALTER TABLE "catalog_services"
  ADD COLUMN IF NOT EXISTS "offer_key" TEXT,
  ADD COLUMN IF NOT EXISTS "offer_section" TEXT NOT NULL DEFAULT 'included-services',
  ADD COLUMN IF NOT EXISTS "default_price" DECIMAL(12, 2),
  ADD COLUMN IF NOT EXISTS "billing_cadence" TEXT NOT NULL DEFAULT 'monthly',
  ADD COLUMN IF NOT EXISTS "requires_platform_migration" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "required_target_platform" TEXT,
  ADD COLUMN IF NOT EXISTS "applicability_note" TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS "catalog_services_brandId_offer_key_key"
  ON "catalog_services"("brandId", "offer_key");
CREATE INDEX IF NOT EXISTS "catalog_services_brandId_offer_section_active_priority_idx"
  ON "catalog_services"("brandId", "offer_section", "active", "priority");

-- Every brand receives the proposal items that were previously embedded in client code.
-- ON CONFLICT deliberately preserves any catalog copy that a brand has already customized.
INSERT INTO "catalog_services" (
  "id", "brandId", "code", "name", "description", "card_label", "client_benefit",
  "itemType", "category", "priority", "default_inclusion", "offer_key", "offer_section",
  "default_price", "billing_cadence", "requires_platform_migration",
  "required_target_platform", "applicability_note", "active", "realEstateSpecific",
  "createdAt", "updatedAt"
)
SELECT
  'offer_' || md5(brand."id" || ':' || item.offer_key),
  brand."id",
  item.code,
  item.name,
  item.description,
  item.name,
  item.description,
  item.item_type,
  'proposal options',
  item.priority,
  item.default_inclusion,
  item.offer_key,
  'options',
  item.default_price,
  item.billing_cadence,
  item.requires_platform_migration,
  item.required_target_platform,
  item.applicability_note,
  true,
  item.real_estate_specific,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM "Brand" AS brand
CROSS JOIN (
  VALUES
    ('advanced-receipt-management', 'OFFER-ARM', 'Advanced Receipt Management', 'Enhanced receipt collection, organization, and matching support.', 'proposal-option', 100, 'optional', 180.00, 'monthly', false, NULL, 'Available as an enhanced recurring receipt-management service.', false),
    ('project-tracking', 'OFFER-PROJECT', 'Project Tracking', 'Income, cost, and profitability tracking for Improve and Grow.', 'proposal-option', 110, 'optional', 150.00, 'monthly', false, NULL, 'Available when the client needs project-level profitability reporting.', false),
    ('budget-reporting', 'OFFER-BUDGET', 'Budget Setup & Budget vs. Actuals Reporting', 'Build the client''s budget and provide recurring budget-versus-actuals reporting.', 'proposal-option', 120, 'optional', 150.00, 'monthly', false, NULL, 'Available when recurring budget reporting is useful.', false),
    ('sales-tax-filing', 'OFFER-SALES-TAX', 'Sales Tax Filing & Remittance', 'Calculate, file, and remit the client''s sales tax payments.', 'proposal-option', 130, 'optional', 650.00, 'monthly', false, NULL, 'Available when the client has sales-tax filing obligations.', false),
    ('tax-preparer-coordination', 'OFFER-TAX-COORD', 'Tax Preparer Coordination', 'Coordinate with the client''s tax preparer and provide organized bookkeeping records.', 'proposal-option', 140, 'optional', 0.00, 'monthly', false, NULL, 'Available as an optional coordination service.', false),
    ('registered-agent-service', 'OFFER-REGISTERED-AGENT', 'Registered Agent Service', 'Forward official state correspondence to the designated contact.', 'proposal-option', 150, 'optional', 0.00, 'monthly', false, NULL, 'Available when registered-agent support is offered by the brand.', false),
    ('stessa-migration', 'OFFER-STESSA-MIGRATION', 'QuickBooks to Stessa Migration', 'We will move the client''s books to Stessa for free when they buy the cleanup and monthly bookkeeping in this offer.', 'proposal-extra', 200, 'included', 0.00, 'one-time', true, 'stessa', 'Shown because this offer moves the books from QuickBooks to Stessa.', true),
    ('property-reporting-setup', 'OFFER-PROPERTY-REPORTING', 'Reports by Property', 'We will set up the books so the client can see income and costs for each property.', 'proposal-extra', 210, 'included', 0.00, 'one-time', false, NULL, 'Available for real-estate book sets.', true),
    ('document-organization', 'OFFER-DOCUMENT-ORGANIZATION', 'Organized, Audit-Ready Records', 'We replace paper files and loose digital files with one clear system. The client uploads records to the portal. We organize them and link them to the right items in the books.', 'proposal-extra', 220, 'included', 0.00, 'one-time', false, NULL, 'Available as an included onboarding benefit.', false),
    ('quarterly-review', 'OFFER-QUARTERLY-REVIEW', 'First Quarterly Review', 'After the first full quarter, we will meet with the client to review reports, answer questions, and plan the next steps.', 'proposal-extra', 230, 'included', 0.00, 'one-time', false, NULL, 'Available as an included advisory benefit.', false),
    ('doublehq-client-portal', 'OFFER-DOUBLEHQ', 'DoubleHQ Client Portal', 'The client gets one online place to talk with our team, send files, view requests, and check the work in progress.', 'proposal-extra', 240, 'included', 0.00, 'one-time', false, NULL, 'Available as an included client-experience benefit.', false),
    ('real-estate-chart-of-accounts', 'OFFER-RE-COA', 'Real Estate Chart of Accounts', 'We will add our real estate Chart of Accounts to the client''s current QuickBooks file. This makes reports easier to read and keeps the books consistent.', 'proposal-extra', 250, 'included', 0.00, 'one-time', false, NULL, 'Available for real-estate book sets using an existing QuickBooks file.', true),
    ('new-quickbooks-file', 'OFFER-NEW-QBO', 'New QuickBooks Setup', 'If a fresh start is best, we will build a new QuickBooks file for monthly bookkeeping. It will include our Real Estate Chart of Accounts.', 'proposal-extra', 260, 'included', 0.00, 'one-time', false, 'qbo', 'Available for real-estate book sets whose ongoing platform is QuickBooks.', true)
) AS item(
  offer_key, code, name, description, item_type, priority, default_inclusion,
  default_price, billing_cadence, requires_platform_migration,
  required_target_platform, applicability_note, real_estate_specific
)
ON CONFLICT ("brandId", "offer_key") DO NOTHING;

-- Ensure one canonical Real estate tag exists per brand before reconciling common
-- duplicate spellings. Duplicate tag records are retained but archived for rollback.
INSERT INTO "contact_tags" (
  "id", "brandId", "key", "label", "kind", "isActive", "sortOrder", "createdAt", "updatedAt"
)
SELECT
  'tag_' || md5(brand."id" || ':real-estate'),
  brand."id",
  'real-estate',
  'Real estate',
  'INDUSTRY',
  true,
  60,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM "Brand" AS brand
ON CONFLICT ("brandId", "key") DO NOTHING;

-- A previously archived canonical row must remain usable before duplicate rows
-- are archived below.
UPDATE "contact_tags"
SET "isActive" = true, "updatedAt" = CURRENT_TIMESTAMP
WHERE "key" = 'real-estate';

INSERT INTO "catalog_service_tags" ("id", "brandId", "serviceId", "tagId", "createdAt")
SELECT
  'cst_' || md5(link."serviceId" || ':' || canonical."id"),
  link."brandId",
  link."serviceId",
  canonical."id",
  CURRENT_TIMESTAMP
FROM "catalog_service_tags" AS link
JOIN "contact_tags" AS duplicate ON duplicate."id" = link."tagId"
JOIN "contact_tags" AS canonical
  ON canonical."brandId" = duplicate."brandId" AND canonical."key" = 'real-estate'
WHERE duplicate."key" IN ('real-estate-bookeeper', 'real-estate-bookkeeper')
ON CONFLICT ("serviceId", "tagId") DO NOTHING;

INSERT INTO "contact_tag_links" ("id", "contactId", "tagId", "createdAt")
SELECT
  'ctl_' || md5(link."contactId" || ':' || canonical."id"),
  link."contactId",
  canonical."id",
  CURRENT_TIMESTAMP
FROM "contact_tag_links" AS link
JOIN "contact_tags" AS duplicate ON duplicate."id" = link."tagId"
JOIN "contact_tags" AS canonical
  ON canonical."brandId" = duplicate."brandId" AND canonical."key" = 'real-estate'
WHERE duplicate."key" IN ('real-estate-bookeeper', 'real-estate-bookkeeper')
ON CONFLICT ("contactId", "tagId") DO NOTHING;

INSERT INTO "contact_tag_automations" (
  "id", "brandId", "tagId", "pipelineId", "stageId", "isActive", "createdAt", "updatedAt"
)
SELECT
  'cta_' || md5(automation."pipelineId" || ':' || canonical."id"),
  automation."brandId",
  canonical."id",
  automation."pipelineId",
  automation."stageId",
  automation."isActive",
  automation."createdAt",
  CURRENT_TIMESTAMP
FROM "contact_tag_automations" AS automation
JOIN "contact_tags" AS duplicate ON duplicate."id" = automation."tagId"
JOIN "contact_tags" AS canonical
  ON canonical."brandId" = duplicate."brandId" AND canonical."key" = 'real-estate'
WHERE duplicate."key" IN ('real-estate-bookeeper', 'real-estate-bookkeeper')
ON CONFLICT ("tagId", "pipelineId") DO NOTHING;

UPDATE "catalog_services" AS service
SET "tagId" = canonical."id", "realEstateSpecific" = true
FROM "contact_tags" AS duplicate
JOIN "contact_tags" AS canonical
  ON canonical."brandId" = duplicate."brandId" AND canonical."key" = 'real-estate'
WHERE service."tagId" = duplicate."id"
  AND duplicate."key" IN ('real-estate-bookeeper', 'real-estate-bookkeeper');

-- Attach all catalog-backed real-estate proposal items to the canonical tag.
INSERT INTO "catalog_service_tags" ("id", "brandId", "serviceId", "tagId", "createdAt")
SELECT
  'cst_' || md5(service."id" || ':' || tag."id"),
  service."brandId",
  service."id",
  tag."id",
  CURRENT_TIMESTAMP
FROM "catalog_services" AS service
JOIN "contact_tags" AS tag ON tag."brandId" = service."brandId" AND tag."key" = 'real-estate'
WHERE service."offer_key" IN (
  'stessa-migration',
  'property-reporting-setup',
  'real-estate-chart-of-accounts',
  'new-quickbooks-file'
)
ON CONFLICT ("serviceId", "tagId") DO NOTHING;

UPDATE "catalog_services" AS service
SET "realEstateSpecific" = true
WHERE EXISTS (
  SELECT 1
  FROM "catalog_service_tags" AS link
  JOIN "contact_tags" AS tag ON tag."id" = link."tagId"
  WHERE link."serviceId" = service."id"
    AND tag."brandId" = service."brandId"
    AND tag."key" = 'real-estate'
);

UPDATE "contact_tags"
SET "isActive" = false, "updatedAt" = CURRENT_TIMESTAMP
WHERE "key" IN ('real-estate-bookeeper', 'real-estate-bookkeeper');

-- Preserve every publication as a numbered immutable revision. The legacy snapshot
-- remains populated so rollback can restore the previous reader without data loss.
CREATE TABLE IF NOT EXISTS "quote_revisions" (
  "id" TEXT NOT NULL,
  "brandId" TEXT NOT NULL,
  "quoteId" TEXT NOT NULL,
  "version" INTEGER NOT NULL,
  "snapshotJson" JSONB NOT NULL,
  "publishedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "supersededAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "quote_revisions_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "quote_revisions_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "Brand"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "quote_revisions_quoteId_fkey" FOREIGN KEY ("quoteId") REFERENCES "quotes"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "quote_revisions_quoteId_version_key"
  ON "quote_revisions"("quoteId", "version");
CREATE INDEX IF NOT EXISTS "quote_revisions_brandId_quoteId_version_idx"
  ON "quote_revisions"("brandId", "quoteId", "version");
CREATE INDEX IF NOT EXISTS "quote_revisions_brandId_publishedAt_idx"
  ON "quote_revisions"("brandId", "publishedAt");

INSERT INTO "quote_revisions" (
  "id", "brandId", "quoteId", "version", "snapshotJson", "publishedAt", "createdAt"
)
SELECT
  'revision_' || md5(quote."id" || ':1'),
  quote."brandId",
  quote."id",
  1,
  quote."publishedSnapshotJson",
  COALESCE(quote."publishedAt", quote."updatedAt"),
  COALESCE(quote."publishedAt", quote."updatedAt")
FROM "quotes" AS quote
WHERE quote."publishedSnapshotJson" IS NOT NULL
ON CONFLICT ("quoteId", "version") DO NOTHING;

-- Deployment reconciliation examples (run before and after applying in production):
-- SELECT "brandId", count(*) FROM "catalog_services" WHERE "offer_section" = 'options' GROUP BY "brandId";
-- SELECT "brandId", count(*) FROM "catalog_service_tags" WHERE "tagId" IN (SELECT "id" FROM "contact_tags" WHERE "key" = 'real-estate') GROUP BY "brandId";
-- SELECT count(*) FROM "quotes" WHERE "publishedSnapshotJson" IS NOT NULL;
-- SELECT count(DISTINCT "quoteId") FROM "quote_revisions";
