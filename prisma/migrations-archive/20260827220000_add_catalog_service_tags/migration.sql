CREATE TABLE "catalog_service_tags" (
  "id" TEXT NOT NULL,
  "brandId" TEXT NOT NULL,
  "serviceId" TEXT NOT NULL,
  "tagId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "catalog_service_tags_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "catalog_service_tags_serviceId_tagId_key" ON "catalog_service_tags"("serviceId", "tagId");
CREATE INDEX "catalog_service_tags_brandId_tagId_idx" ON "catalog_service_tags"("brandId", "tagId");

ALTER TABLE "catalog_service_tags"
  ADD CONSTRAINT "catalog_service_tags_brandId_fkey"
  FOREIGN KEY ("brandId") REFERENCES "Brand"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "catalog_service_tags"
  ADD CONSTRAINT "catalog_service_tags_serviceId_fkey"
  FOREIGN KEY ("serviceId") REFERENCES "catalog_services"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "catalog_service_tags"
  ADD CONSTRAINT "catalog_service_tags_tagId_fkey"
  FOREIGN KEY ("tagId") REFERENCES "contact_tags"("id") ON DELETE CASCADE ON UPDATE CASCADE;
