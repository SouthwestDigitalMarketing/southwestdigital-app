ALTER TABLE "catalog_services" ADD COLUMN "realEstateSpecific" BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX "catalog_services_brandId_realEstateSpecific_idx" ON "catalog_services"("brandId", "realEstateSpecific");
