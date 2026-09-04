CREATE TYPE "AgreementManagerStatus" AS ENUM ('ACTIVE', 'VOIDED', 'ARCHIVED');

ALTER TABLE "Engagement"
ADD COLUMN "agreementManagerStatus" "AgreementManagerStatus" NOT NULL DEFAULT 'ACTIVE';
