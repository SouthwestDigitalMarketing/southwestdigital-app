-- Keep planning notes private to the active brand, including direct table access.
ALTER TABLE "ShowrunnerStudio" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ShowrunnerStudio" FORCE ROW LEVEL SECURITY;
CREATE POLICY showrunner_studio_brand_context ON "ShowrunnerStudio"
  USING ("brandId" = NULLIF(current_setting('app.current_brand_id', true), ''))
  WITH CHECK ("brandId" = NULLIF(current_setting('app.current_brand_id', true), ''));
