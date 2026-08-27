ALTER TABLE "BrandTheme"
  ADD COLUMN "logoMarkUrl" TEXT,
  ADD COLUMN "mode" TEXT NOT NULL DEFAULT 'system';
