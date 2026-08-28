ALTER TABLE "catalog_services" ADD COLUMN "tagId" TEXT;

CREATE INDEX "catalog_services_brandId_tagId_idx" ON "catalog_services"("brandId", "tagId");

ALTER TABLE "catalog_services"
  ADD CONSTRAINT "catalog_services_tagId_fkey"
  FOREIGN KEY ("tagId") REFERENCES "contact_tags"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
