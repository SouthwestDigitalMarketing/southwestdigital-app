-- CreateTable
CREATE TABLE "proposal_view_events" (
    "id" TEXT NOT NULL,
    "quoteId" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "step" INTEGER,
    "packageId" TEXT,
    "position" INTEGER,
    "value" INTEGER,
    "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "proposal_view_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "proposal_view_events_quoteId_occurredAt_idx" ON "proposal_view_events"("quoteId", "occurredAt");

-- CreateIndex
CREATE INDEX "proposal_view_events_quoteId_sessionId_idx" ON "proposal_view_events"("quoteId", "sessionId");

-- AddForeignKey
ALTER TABLE "proposal_view_events" ADD CONSTRAINT "proposal_view_events_quoteId_fkey" FOREIGN KEY ("quoteId") REFERENCES "quotes"("id") ON DELETE CASCADE ON UPDATE CASCADE;
