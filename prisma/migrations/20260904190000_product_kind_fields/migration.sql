-- Add product-kind fields so offers/engagements/catalog services can be
-- typed (bookkeeping / consulting / coaching / referral-network) and
-- filtered accordingly. Quote.kind already exists as a String and is left
-- alone. Application-level guards (isOfferKindKey) validate values.
--
-- Additive and idempotent.

BEGIN;

-- Engagement.productKind — defaults to bookkeeping so every existing
-- engagement is treated as the current bookkeeping product flow.
ALTER TABLE "Engagement"
  ADD COLUMN IF NOT EXISTS "productKind" TEXT NOT NULL DEFAULT 'bookkeeping';

-- CatalogService.product_kind — filter services shown in each product's
-- offer builder. Every existing row is a bookkeeping-flow row.
ALTER TABLE "catalog_services"
  ADD COLUMN IF NOT EXISTS "product_kind" TEXT NOT NULL DEFAULT 'bookkeeping';

CREATE INDEX IF NOT EXISTS "catalog_services_brandId_product_kind_active_idx"
  ON "catalog_services"("brandId", "product_kind", "active");

-- AgreementTemplate.defaultForProductKind — nullable. When set, this
-- template is auto-selected for offers of that product kind. Multiple
-- templates may share the same value.
ALTER TABLE "AgreementTemplate"
  ADD COLUMN IF NOT EXISTS "defaultForProductKind" TEXT;

CREATE INDEX IF NOT EXISTS "AgreementTemplate_brandId_defaultForProductKind_status_idx"
  ON "AgreementTemplate"("brandId", "defaultForProductKind", "status");

COMMIT;
