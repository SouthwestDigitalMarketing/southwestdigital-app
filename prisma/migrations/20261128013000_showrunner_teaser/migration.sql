-- Teaser before the title: on/off and a transcript-highlighted range.
ALTER TABLE "ShowrunnerVideoStatus" ADD COLUMN "transcriptCues" JSONB;
ALTER TABLE "ShowrunnerVideoStatus" ADD COLUMN "teaser" JSONB;
ALTER TABLE "ShowrunnerVideoStatus" ADD COLUMN "teaserBusy" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "ShowrunnerVideoStatus" ADD COLUMN "teaserRequestedAt" TIMESTAMP(3);
ALTER TABLE "ShowrunnerVideoStatus" ADD COLUMN "teaserRequest" JSONB;
