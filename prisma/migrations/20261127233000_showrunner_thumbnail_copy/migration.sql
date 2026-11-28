-- Transcript accordion and thumbnail-text picker on the production page.
ALTER TABLE "ShowrunnerVideoStatus" ADD COLUMN "transcript" TEXT;
ALTER TABLE "ShowrunnerVideoStatus" ADD COLUMN "thumbnailText" TEXT;
ALTER TABLE "ShowrunnerVideoStatus" ADD COLUMN "thumbnailOptions" JSONB;
ALTER TABLE "ShowrunnerVideoStatus" ADD COLUMN "thumbnailBusy" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "ShowrunnerVideoStatus" ADD COLUMN "thumbnailRequestedAt" TIMESTAMP(3);
ALTER TABLE "ShowrunnerVideoStatus" ADD COLUMN "thumbnailRequestText" TEXT;
