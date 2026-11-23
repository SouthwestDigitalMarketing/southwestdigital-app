-- Fix the questions tables to match the Prisma schema exactly: no database
-- default on @updatedAt columns (Prisma manages those), plus the brand
-- foreign keys. Additive repair only.
ALTER TABLE "ScanRule" ALTER COLUMN "updatedAt" DROP DEFAULT;
ALTER TABLE "ScanQuestion" ALTER COLUMN "updatedAt" DROP DEFAULT;

ALTER TABLE "ScanRule" ADD CONSTRAINT "ScanRule_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "Brand"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ScanQuestion" ADD CONSTRAINT "ScanQuestion_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "Brand"("id") ON DELETE CASCADE ON UPDATE CASCADE;
