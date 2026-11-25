-- CreateTable
CREATE TABLE "Trip" (
    "id" TEXT NOT NULL,
    "brandId" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'planning',
    "destination" TEXT NOT NULL DEFAULT '',
    "startsOn" TEXT NOT NULL DEFAULT '',
    "endsOn" TEXT NOT NULL DEFAULT '',
    "plan" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Trip_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Trip_brandId_slug_key" ON "Trip"("brandId", "slug");

-- AddForeignKey
ALTER TABLE "Trip" ADD CONSTRAINT "Trip_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "Brand"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Trips are private to the active brand, including direct table access.
ALTER TABLE "Trip" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Trip" FORCE ROW LEVEL SECURITY;
CREATE POLICY trip_brand_context ON "Trip"
  USING ("brandId" = NULLIF(current_setting('app.current_brand_id', true), ''))
  WITH CHECK ("brandId" = NULLIF(current_setting('app.current_brand_id', true), ''));
