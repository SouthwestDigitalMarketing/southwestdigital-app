-- YouTube privacy on the episode card, and a tap to change it.
ALTER TABLE "ShowrunnerVideoStatus" ADD COLUMN "visibility" TEXT;
ALTER TABLE "ShowrunnerVideoStatus" ADD COLUMN "visibilityBusy" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "ShowrunnerVideoStatus" ADD COLUMN "visibilityRequestedAt" TIMESTAMP(3);
ALTER TABLE "ShowrunnerVideoStatus" ADD COLUMN "visibilityRequest" TEXT;
