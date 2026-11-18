CREATE TABLE IF NOT EXISTS "LocalSeoConfig" (
  "id" TEXT NOT NULL,
  "brandId" TEXT NOT NULL,
  "gridSize" INTEGER NOT NULL DEFAULT 7,
  "spacingMiles" DOUBLE PRECISION NOT NULL DEFAULT 1,
  "keywords" JSONB NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "LocalSeoConfig_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "LocalSeoConfig_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "Brand"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX IF NOT EXISTS "LocalSeoConfig_brandId_key" ON "LocalSeoConfig"("brandId");

CREATE TABLE IF NOT EXISTS "LocalSeoScan" (
  "id" TEXT NOT NULL,
  "brandId" TEXT NOT NULL,
  "source" TEXT NOT NULL,
  "scheduleKey" TEXT,
  "status" TEXT NOT NULL DEFAULT 'queued',
  "gridSize" INTEGER NOT NULL,
  "spacingMiles" DOUBLE PRECISION NOT NULL,
  "keywords" JSONB NOT NULL,
  "estimatedCostUsd" DOUBLE PRECISION NOT NULL,
  "actualCostUsd" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "error" TEXT,
  "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "completedAt" TIMESTAMP(3),
  CONSTRAINT "LocalSeoScan_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "LocalSeoScan_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "Brand"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX IF NOT EXISTS "LocalSeoScan_brandId_startedAt_idx" ON "LocalSeoScan"("brandId", "startedAt");
CREATE INDEX IF NOT EXISTS "LocalSeoScan_status_startedAt_idx" ON "LocalSeoScan"("status", "startedAt");
CREATE UNIQUE INDEX IF NOT EXISTS "LocalSeoScan_scheduleKey_key" ON "LocalSeoScan"("scheduleKey");

CREATE TABLE IF NOT EXISTS "LocalSeoGridCell" (
  "id" TEXT NOT NULL,
  "scanId" TEXT NOT NULL,
  "keyword" TEXT NOT NULL,
  "row" INTEGER NOT NULL,
  "column" INTEGER NOT NULL,
  "latitude" DOUBLE PRECISION NOT NULL,
  "longitude" DOUBLE PRECISION NOT NULL,
  "providerTaskId" TEXT,
  "status" TEXT NOT NULL DEFAULT 'queued',
  "rank" INTEGER,
  "competitors" JSONB NOT NULL DEFAULT '[]'::jsonb,
  "error" TEXT,
  CONSTRAINT "LocalSeoGridCell_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "LocalSeoGridCell_scanId_fkey" FOREIGN KEY ("scanId") REFERENCES "LocalSeoScan"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX IF NOT EXISTS "LocalSeoGridCell_providerTaskId_key" ON "LocalSeoGridCell"("providerTaskId");
CREATE UNIQUE INDEX IF NOT EXISTS "LocalSeoGridCell_scanId_keyword_row_column_key" ON "LocalSeoGridCell"("scanId", "keyword", "row", "column");
CREATE INDEX IF NOT EXISTS "LocalSeoGridCell_scanId_keyword_idx" ON "LocalSeoGridCell"("scanId", "keyword");
CREATE INDEX IF NOT EXISTS "LocalSeoGridCell_status_providerTaskId_idx" ON "LocalSeoGridCell"("status", "providerTaskId");
