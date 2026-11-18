-- CRM rows are visible or writable only when the current transaction carries
-- the server-derived brand context. A missing or empty setting denies access.

ALTER TABLE "CustomerAccount" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "CustomerAccount" FORCE ROW LEVEL SECURITY;
CREATE POLICY "customer_account_brand_context" ON "CustomerAccount"
TO PUBLIC
USING ("brandId" = NULLIF(current_setting('app.current_brand_id', true), ''))
WITH CHECK ("brandId" = NULLIF(current_setting('app.current_brand_id', true), ''));

ALTER TABLE "Contact" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Contact" FORCE ROW LEVEL SECURITY;
CREATE POLICY "contact_brand_context" ON "Contact"
TO PUBLIC
USING ("brandId" = NULLIF(current_setting('app.current_brand_id', true), ''))
WITH CHECK ("brandId" = NULLIF(current_setting('app.current_brand_id', true), ''));

ALTER TABLE "CustomerContact" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "CustomerContact" FORCE ROW LEVEL SECURITY;
CREATE POLICY "customer_contact_brand_context" ON "CustomerContact"
TO PUBLIC
USING ("brandId" = NULLIF(current_setting('app.current_brand_id', true), ''))
WITH CHECK ("brandId" = NULLIF(current_setting('app.current_brand_id', true), ''));

ALTER TABLE "Lead" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Lead" FORCE ROW LEVEL SECURITY;
CREATE POLICY "lead_brand_context" ON "Lead"
TO PUBLIC
USING ("brandId" = NULLIF(current_setting('app.current_brand_id', true), ''))
WITH CHECK ("brandId" = NULLIF(current_setting('app.current_brand_id', true), ''));

ALTER TABLE "LeadAttributionTouch" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "LeadAttributionTouch" FORCE ROW LEVEL SECURITY;
CREATE POLICY "lead_attribution_brand_context" ON "LeadAttributionTouch"
TO PUBLIC
USING ("brandId" = NULLIF(current_setting('app.current_brand_id', true), ''))
WITH CHECK ("brandId" = NULLIF(current_setting('app.current_brand_id', true), ''));
