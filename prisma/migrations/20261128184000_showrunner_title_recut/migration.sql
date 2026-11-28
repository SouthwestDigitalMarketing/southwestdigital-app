-- Approve recuts the show with this title screen (Tom, 2026-11-28).
ALTER TABLE "ShowrunnerVideoStatus" ADD COLUMN "titleScreenBusy" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "ShowrunnerVideoStatus" ADD COLUMN "titleScreenRecutRequestedAt" TIMESTAMP(3);
