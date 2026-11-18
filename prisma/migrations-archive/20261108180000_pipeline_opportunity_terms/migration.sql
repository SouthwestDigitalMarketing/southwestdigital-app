-- Make commercial terms and close milestones explicit on each opportunity.
-- Existing amountKind remains the Sales document kind (offer or invoice).
ALTER TABLE "MeetingLead"
  ADD COLUMN IF NOT EXISTS "offerType" TEXT,
  ADD COLUMN IF NOT EXISTS "valueBasis" TEXT,
  ADD COLUMN IF NOT EXISTS "firstPaymentReceivedAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "serviceAgreementSignedAt" TIMESTAMP(3);
