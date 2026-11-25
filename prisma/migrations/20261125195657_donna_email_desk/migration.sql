-- CreateTable
CREATE TABLE "DonnaMailbox" (
    "id" TEXT NOT NULL,
    "brandId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "paused" BOOLEAN NOT NULL DEFAULT true,
    "hookKey" TEXT NOT NULL,
    "hookSecret" TEXT,
    "setupExpiresAt" TIMESTAMP(3),
    "lastNotifiedAt" TIMESTAMP(3),
    "lastCheckedAt" TIMESTAMP(3),
    "heartbeatAt" TIMESTAMP(3),
    "lastError" TEXT,
    "coverage" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DonnaMailbox_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DonnaJob" (
    "id" TEXT NOT NULL,
    "mailboxId" TEXT NOT NULL,
    "eventKey" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "leaseToken" TEXT,
    "leaseUntil" TIMESTAMP(3),
    "nextAttemptAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "error" TEXT,
    "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "DonnaJob_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DonnaRequest" (
    "id" TEXT NOT NULL,
    "mailboxId" TEXT NOT NULL,
    "sourceKey" TEXT NOT NULL,
    "sourceVersion" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "person" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "owner" TEXT NOT NULL DEFAULT 'Donna',
    "state" TEXT NOT NULL DEFAULT 'needs-you',
    "urgent" BOOLEAN NOT NULL DEFAULT false,
    "summary" TEXT NOT NULL,
    "recommendation" TEXT NOT NULL,
    "nextAction" TEXT NOT NULL,
    "evidence" JSONB NOT NULL DEFAULT '[]',
    "draft" JSONB,
    "direction" TEXT,
    "dueAt" TIMESTAMP(3),
    "followUpAt" TIMESTAMP(3),
    "waitingOn" TEXT,
    "answeredAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "completionNote" TEXT,
    "firstReceivedAt" TIMESTAMP(3) NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DonnaRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DonnaActivity" (
    "id" TEXT NOT NULL,
    "mailboxId" TEXT NOT NULL,
    "requestId" TEXT,
    "eventKey" TEXT NOT NULL,
    "messageKey" TEXT,
    "kind" TEXT NOT NULL,
    "detail" TEXT NOT NULL,
    "actor" TEXT NOT NULL DEFAULT 'Donna',
    "evidence" TEXT NOT NULL,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "occurredAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DonnaActivity_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "DonnaMailbox_hookKey_key" ON "DonnaMailbox"("hookKey");

-- CreateIndex
CREATE UNIQUE INDEX "DonnaMailbox_brandId_key_key" ON "DonnaMailbox"("brandId", "key");

-- CreateIndex
CREATE INDEX "DonnaJob_status_nextAttemptAt_idx" ON "DonnaJob"("status", "nextAttemptAt");

-- CreateIndex
CREATE UNIQUE INDEX "DonnaJob_mailboxId_eventKey_key" ON "DonnaJob"("mailboxId", "eventKey");

-- CreateIndex
CREATE INDEX "DonnaRequest_mailboxId_state_dueAt_idx" ON "DonnaRequest"("mailboxId", "state", "dueAt");

-- CreateIndex
CREATE UNIQUE INDEX "DonnaRequest_mailboxId_sourceKey_key" ON "DonnaRequest"("mailboxId", "sourceKey");

-- CreateIndex
CREATE INDEX "DonnaActivity_mailboxId_occurredAt_idx" ON "DonnaActivity"("mailboxId", "occurredAt");

-- CreateIndex
CREATE INDEX "DonnaActivity_requestId_idx" ON "DonnaActivity"("requestId");

-- CreateIndex
CREATE UNIQUE INDEX "DonnaActivity_mailboxId_eventKey_key" ON "DonnaActivity"("mailboxId", "eventKey");

-- AddForeignKey
ALTER TABLE "DonnaMailbox" ADD CONSTRAINT "DonnaMailbox_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "Brand"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DonnaJob" ADD CONSTRAINT "DonnaJob_mailboxId_fkey" FOREIGN KEY ("mailboxId") REFERENCES "DonnaMailbox"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DonnaRequest" ADD CONSTRAINT "DonnaRequest_mailboxId_fkey" FOREIGN KEY ("mailboxId") REFERENCES "DonnaMailbox"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DonnaActivity" ADD CONSTRAINT "DonnaActivity_mailboxId_fkey" FOREIGN KEY ("mailboxId") REFERENCES "DonnaMailbox"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DonnaActivity" ADD CONSTRAINT "DonnaActivity_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "DonnaRequest"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Every Donna row is scoped through the mailbox's authorized brand.
ALTER TABLE "DonnaMailbox" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "DonnaMailbox" FORCE ROW LEVEL SECURITY;
CREATE POLICY donna_mailbox_brand ON "DonnaMailbox"
  USING ("brandId" = NULLIF(current_setting('app.current_brand_id', true), ''))
  WITH CHECK ("brandId" = NULLIF(current_setting('app.current_brand_id', true), ''));
ALTER TABLE "DonnaJob" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "DonnaJob" FORCE ROW LEVEL SECURITY;
CREATE POLICY donna_mailbox_scope ON "DonnaJob"
  USING (EXISTS (SELECT 1 FROM "DonnaMailbox" m WHERE m.id = "DonnaJob"."mailboxId"
    AND m."brandId" = NULLIF(current_setting('app.current_brand_id', true), '')))
  WITH CHECK (EXISTS (SELECT 1 FROM "DonnaMailbox" m WHERE m.id = "DonnaJob"."mailboxId"
    AND m."brandId" = NULLIF(current_setting('app.current_brand_id', true), '')));
ALTER TABLE "DonnaRequest" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "DonnaRequest" FORCE ROW LEVEL SECURITY;
CREATE POLICY donna_mailbox_scope ON "DonnaRequest"
  USING (EXISTS (SELECT 1 FROM "DonnaMailbox" m WHERE m.id = "DonnaRequest"."mailboxId"
    AND m."brandId" = NULLIF(current_setting('app.current_brand_id', true), '')))
  WITH CHECK (EXISTS (SELECT 1 FROM "DonnaMailbox" m WHERE m.id = "DonnaRequest"."mailboxId"
    AND m."brandId" = NULLIF(current_setting('app.current_brand_id', true), '')));
ALTER TABLE "DonnaActivity" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "DonnaActivity" FORCE ROW LEVEL SECURITY;
CREATE POLICY donna_mailbox_scope ON "DonnaActivity"
  USING (EXISTS (SELECT 1 FROM "DonnaMailbox" m WHERE m.id = "DonnaActivity"."mailboxId"
    AND m."brandId" = NULLIF(current_setting('app.current_brand_id', true), '')))
  WITH CHECK (EXISTS (SELECT 1 FROM "DonnaMailbox" m WHERE m.id = "DonnaActivity"."mailboxId"
    AND m."brandId" = NULLIF(current_setting('app.current_brand_id', true), '')));

ALTER TABLE "DonnaJob" ADD CONSTRAINT donna_job_state CHECK (status IN ('pending','leased','done'));
ALTER TABLE "DonnaRequest" ADD CONSTRAINT donna_request_state CHECK (state IN ('needs-you','working','waiting','handled'));
ALTER TABLE "DonnaRequest" ADD CONSTRAINT donna_completed_evidence CHECK
  (state <> 'handled' OR ("completedAt" IS NOT NULL AND length(trim("completionNote")) > 0));
