-- CreateTable
CREATE TABLE "ScorecardEvent" (
    "id" TEXT NOT NULL,
    "brandId" TEXT NOT NULL,
    "contactId" TEXT,
    "channel" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL,
    "respondedAt" TIMESTAMP(3),
    "clockSeconds" INTEGER,
    "businessSeconds" INTEGER,
    "responseVia" TEXT,
    "details" JSONB,
    "sourceKey" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ScorecardEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ScorecardSync" (
    "id" TEXT NOT NULL,
    "brandId" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "lastRunAt" TIMESTAMP(3) NOT NULL,
    "coveredTo" TIMESTAMP(3),
    "eventsSent" INTEGER NOT NULL DEFAULT 0,
    "ok" BOOLEAN NOT NULL DEFAULT true,
    "note" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ScorecardSync_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ScorecardEvent_brandId_channel_startedAt_idx" ON "ScorecardEvent"("brandId", "channel", "startedAt");

-- CreateIndex
CREATE INDEX "ScorecardEvent_contactId_idx" ON "ScorecardEvent"("contactId");

-- CreateIndex
CREATE UNIQUE INDEX "ScorecardEvent_brandId_sourceKey_key" ON "ScorecardEvent"("brandId", "sourceKey");

-- CreateIndex
CREATE UNIQUE INDEX "ScorecardSync_brandId_source_key" ON "ScorecardSync"("brandId", "source");

-- AddForeignKey
ALTER TABLE "ScorecardEvent" ADD CONSTRAINT "ScorecardEvent_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "Brand"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScorecardEvent" ADD CONSTRAINT "ScorecardEvent_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "Contact"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScorecardSync" ADD CONSTRAINT "ScorecardSync_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "Brand"("id") ON DELETE CASCADE ON UPDATE CASCADE;
