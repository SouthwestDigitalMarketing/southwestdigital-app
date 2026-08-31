-- Move the lead-facing recurring package lineup out of client code and into
-- each brand's service catalog. Per-offer package assignments are snapshotted
-- with the offer, so later catalog changes do not rewrite published proposals.

ALTER TABLE "catalog_services"
  ADD COLUMN IF NOT EXISTS "default_package_keys" JSONB;

INSERT INTO "catalog_services" (
  "id", "brandId", "code", "name", "description", "card_label", "client_benefit",
  "itemType", "category", "priority", "default_inclusion", "offer_key", "offer_section",
  "default_price", "billing_cadence", "requires_platform_migration",
  "required_target_platform", "applicability_note", "default_package_keys",
  "active", "realEstateSpecific", "createdAt", "updatedAt"
)
SELECT
  'offer_' || md5(brand."id" || ':' || item.offer_key),
  brand."id",
  item.code,
  item.name,
  item.description,
  item.name,
  item.description,
  'proposal-core-service',
  'proposal services',
  item.priority,
  'included',
  item.offer_key,
  'core-services',
  0.00,
  'monthly',
  false,
  NULL,
  NULL,
  item.default_package_keys::jsonb,
  true,
  false,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM "Brand" AS brand
CROSS JOIN (
  VALUES
    ('monthly-bookkeeping', 'OFFER-MONTHLY-BOOKKEEPING', 'Monthly Bookkeeping', 'Includes categorizing transactions, reconciling accounts, generating the Balance Sheet and Profit & Loss statement, and completing the monthly close process. Reports and communication are delivered through the client portal.', 10, '["grow", "improve", "maintain"]'),
    ('standard-client-support', 'OFFER-STANDARD-SUPPORT', 'Standard Client Support', 'Responses within 1–2 business days for bookkeeping questions and support requests.', 20, '["maintain"]'),
    ('monthly-reporting-package', 'OFFER-MONTHLY-REPORTING', 'Monthly Reporting Package', 'A recurring financial reporting package that provides clear visibility into performance.', 30, '["grow", "improve"]'),
    ('priority-client-support', 'OFFER-PRIORITY-SUPPORT', 'Priority Client Support', 'Same-business-day responses for bookkeeping questions and support requests.', 40, '["improve"]'),
    ('investor-reporting-kpi-review', 'OFFER-INVESTOR-REPORTING', 'Investor Reporting & KPI Review', 'Investor-focused financial reporting and KPI review to support portfolio decisions.', 50, '["grow"]'),
    ('concierge-client-support', 'OFFER-CONCIERGE-SUPPORT', 'Concierge Client Support', '24/7 priority access for bookkeeping questions and time-sensitive support needs.', 60, '["grow"]'),
    ('monthly-advisory-calls', 'OFFER-MONTHLY-ADVISORY', 'Monthly Advisory Calls', 'A recurring call with the bookkeeper to review the numbers and talk through decisions.', 70, '["grow"]'),
    ('cfo-pack', 'OFFER-CFO-PACK', 'CFO Pack', 'Executive-level financial reporting built for owner and investor decision-making.', 80, '["grow"]'),
    ('cash-flow-analysis', 'OFFER-CASH-FLOW', 'Cash Flow Analysis', 'Ongoing analysis of cash inflows and outflows to support planning and investment decisions.', 90, '["grow"]')
) AS item(offer_key, code, name, description, priority, default_package_keys)
ON CONFLICT ("brandId", "offer_key") DO UPDATE
SET "default_package_keys" = COALESCE("catalog_services"."default_package_keys", EXCLUDED."default_package_keys"),
    "offer_section" = 'core-services',
    "updatedAt" = CURRENT_TIMESTAMP;

-- Reconciliation:
-- SELECT "brandId", count(*)
-- FROM "catalog_services"
-- WHERE "offer_section" = 'core-services'
-- GROUP BY "brandId";
