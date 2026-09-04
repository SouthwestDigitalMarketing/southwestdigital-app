ALTER TABLE "quotes" ADD COLUMN "offerCode" TEXT;
UPDATE "quotes" SET "offerCode" = id WHERE "offerCode" IS NULL;
ALTER TABLE "quotes" ALTER COLUMN "offerCode" SET NOT NULL;
CREATE UNIQUE INDEX "quotes_offerCode_key" ON "quotes"("offerCode");

CREATE TABLE "brand_discount_quotes" (
  "brandId" TEXT NOT NULL,
  "discountId" TEXT NOT NULL,
  "quoteId" TEXT NOT NULL,
  "assignedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "brand_discount_quotes_pkey" PRIMARY KEY ("discountId", "quoteId"),
  CONSTRAINT "brand_discount_quotes_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "Brand"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "brand_discount_quotes_discountId_fkey" FOREIGN KEY ("discountId") REFERENCES "BrandDiscount"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "brand_discount_quotes_quoteId_fkey" FOREIGN KEY ("quoteId") REFERENCES "quotes"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "brand_discount_quotes_brandId_quoteId_idx" ON "brand_discount_quotes"("brandId", "quoteId");
CREATE INDEX "brand_discount_quotes_brandId_discountId_idx" ON "brand_discount_quotes"("brandId", "discountId");
