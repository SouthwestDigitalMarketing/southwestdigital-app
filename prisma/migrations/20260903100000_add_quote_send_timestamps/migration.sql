ALTER TABLE "quotes" ADD COLUMN IF NOT EXISTS "firstSentAt" TIMESTAMP(3);
ALTER TABLE "quotes" ADD COLUMN IF NOT EXISTS "lastSentAt" TIMESTAMP(3);

UPDATE "quotes"
SET "firstSentAt" = "sentAt",
    "lastSentAt" = "sentAt"
WHERE "sentAt" IS NOT NULL;
