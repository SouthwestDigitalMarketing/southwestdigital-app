-- Add proposal-specific brand color overrides to BrandTheme.
-- These are independent of primaryColor/accentColor which drive the portal sidebar.
-- When null, the proposal falls back to the portal primaryColor/accentColor.
ALTER TABLE "BrandTheme" ADD COLUMN "proposalPrimaryColor" TEXT;
ALTER TABLE "BrandTheme" ADD COLUMN "proposalAccentColor" TEXT;
