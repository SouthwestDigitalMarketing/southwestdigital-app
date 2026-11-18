-- AlterTable
ALTER TABLE "Engagement" ADD COLUMN     "contactId" TEXT;

-- AlterTable
ALTER TABLE "OperationsClient" ADD COLUMN     "engagementId" TEXT,
ADD COLUMN     "stage" TEXT NOT NULL DEFAULT 'active',
ADD COLUMN     "wonOn" DATE;

-- CreateIndex
CREATE INDEX "Engagement_contactId_idx" ON "Engagement"("contactId");

-- CreateIndex
CREATE UNIQUE INDEX "OperationsClient_engagementId_key" ON "OperationsClient"("engagementId");

-- AddForeignKey
ALTER TABLE "Engagement" ADD CONSTRAINT "Engagement_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "Contact"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OperationsClient" ADD CONSTRAINT "OperationsClient_engagementId_fkey" FOREIGN KEY ("engagementId") REFERENCES "Engagement"("id") ON DELETE SET NULL ON UPDATE CASCADE;


-- Hand-written: allowed stages.
ALTER TABLE "OperationsClient" ADD CONSTRAINT "OperationsClient_stage_check"
  CHECK ("stage" IN ('onboarding', 'active', 'former'));
