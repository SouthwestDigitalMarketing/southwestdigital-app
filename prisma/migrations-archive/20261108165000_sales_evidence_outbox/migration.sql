CREATE TABLE IF NOT EXISTS "SalesEvidenceEvent" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "brandId" TEXT NOT NULL,
  "leadId" TEXT,
  "source" TEXT NOT NULL,
  "sourceEventId" TEXT NOT NULL,
  "eventType" TEXT NOT NULL,
  "occurredAt" TIMESTAMP(3) NOT NULL,
  "summary" TEXT NOT NULL,
  "sourceRef" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX IF NOT EXISTS "SalesEvidenceEvent_brandId_source_sourceEventId_key"
  ON "SalesEvidenceEvent"("brandId", "source", "sourceEventId");
CREATE INDEX IF NOT EXISTS "SalesEvidenceEvent_brandId_leadId_occurredAt_idx"
  ON "SalesEvidenceEvent"("brandId", "leadId", "occurredAt");

CREATE TABLE IF NOT EXISTS "AllThingWriteJob" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "eventId" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'pending',
  "attempts" INTEGER NOT NULL DEFAULT 0,
  "lastError" TEXT,
  "completedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AllThingWriteJob_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "SalesEvidenceEvent"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX IF NOT EXISTS "AllThingWriteJob_eventId_key" ON "AllThingWriteJob"("eventId");
CREATE INDEX IF NOT EXISTS "AllThingWriteJob_status_createdAt_idx" ON "AllThingWriteJob"("status", "createdAt");
