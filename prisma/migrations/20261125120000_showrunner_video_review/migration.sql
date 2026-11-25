-- The video scorecard ripley writes for each published video, and Run review requests from SWapp.
ALTER TABLE "ShowrunnerVideoStatus" ADD COLUMN "review" JSONB;
ALTER TABLE "ShowrunnerVideoStatus" ADD COLUMN "reviewRequestedAt" TIMESTAMP(3);
