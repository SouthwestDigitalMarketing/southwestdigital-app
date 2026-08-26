ALTER TABLE "quotes"
ADD COLUMN "publishedSnapshotJson" JSONB,
ADD COLUMN "publicToken" TEXT,
ADD COLUMN "publishedAt" TIMESTAMP(3);

CREATE UNIQUE INDEX "quotes_publicToken_key" ON "quotes"("publicToken");
CREATE INDEX "quotes_brandId_publishedAt_idx" ON "quotes"("brandId", "publishedAt");
