-- Title-screen still on the episode page (Tom, 2026-11-28).
ALTER TABLE "ShowrunnerVideoStatus" ADD COLUMN "titleScreen" TEXT;
ALTER TABLE "ShowrunnerVideoStatus" ADD COLUMN "titleScreenKind" TEXT;
ALTER TABLE "ShowrunnerVideoStatus" ADD COLUMN "titleScreenDay" INTEGER;
ALTER TABLE "ShowrunnerVideoStatus" ADD COLUMN "titleScreenApprovedAt" TIMESTAMP(3);
