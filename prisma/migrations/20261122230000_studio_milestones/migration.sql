-- Tom-ticked milestones, keyed by milestone key.
ALTER TABLE "ShowrunnerStudio" ADD COLUMN "milestoneOverrides" JSONB NOT NULL DEFAULT '{}';
