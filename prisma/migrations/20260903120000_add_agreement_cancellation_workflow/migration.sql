ALTER TYPE "AgreementManagerStatus" ADD VALUE IF NOT EXISTS 'VOIDED_BEFORE_SIGNATURE';
ALTER TYPE "AgreementManagerStatus" ADD VALUE IF NOT EXISTS 'CANCELLATION_REQUESTED';
ALTER TYPE "AgreementManagerStatus" ADD VALUE IF NOT EXISTS 'TERMINATED_AFTER_SIGNATURE';

ALTER TABLE "Engagement"
ADD COLUMN "agreementCancellationRequestedAt" TIMESTAMP(3),
ADD COLUMN "agreementCancellationRequestedByUserId" TEXT,
ADD COLUMN "agreementCancellationReason" TEXT,
ADD COLUMN "agreementCancellationAcknowledgedAt" TIMESTAMP(3),
ADD COLUMN "agreementCancellationAcknowledgedByName" TEXT,
ADD COLUMN "agreementCancellationAcknowledgedByEmail" TEXT;
