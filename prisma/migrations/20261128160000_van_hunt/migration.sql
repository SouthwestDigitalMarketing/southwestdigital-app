-- One hunt per active brand; its editable lists follow Travel's JSON plan shape.
CREATE TABLE "VanHunt" (
    "id" TEXT NOT NULL,
    "brandId" TEXT NOT NULL,
    "plan" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "VanHunt_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "VanHunt_brandId_key" ON "VanHunt"("brandId");
ALTER TABLE "VanHunt" ADD CONSTRAINT "VanHunt_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "Brand"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "VanHunt" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "VanHunt" FORCE ROW LEVEL SECURITY;
CREATE POLICY van_hunt_brand_context ON "VanHunt"
  USING ("brandId" = NULLIF(current_setting('app.current_brand_id', true), ''))
  WITH CHECK ("brandId" = NULLIF(current_setting('app.current_brand_id', true), ''));
