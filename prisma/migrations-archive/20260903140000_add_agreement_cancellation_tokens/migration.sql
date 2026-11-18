ALTER TABLE "Engagement"
ADD COLUMN "agreementCancellationTokenHash" TEXT,
ADD COLUMN "agreementCancellationTokenExpiresAt" TIMESTAMP(3);

CREATE UNIQUE INDEX "Engagement_agreementCancellationTokenHash_key" ON "Engagement"("agreementCancellationTokenHash");
