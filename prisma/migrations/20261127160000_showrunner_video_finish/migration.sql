-- Finish tapped in SWapp while a video is waiting for Tom (add clips or build).
ALTER TABLE "ShowrunnerVideoStatus" ADD COLUMN "finishRequestedAt" TIMESTAMP(3);
ALTER TABLE "ShowrunnerVideoStatus" ADD COLUMN "finishNote" TEXT;
