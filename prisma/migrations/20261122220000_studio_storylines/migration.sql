-- Candidate storylines with drafted storyboards, rebuilt on each refresh.
ALTER TABLE "ShowrunnerStudio" ADD COLUMN "storylines" JSONB NOT NULL DEFAULT '[]';
