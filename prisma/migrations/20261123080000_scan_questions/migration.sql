-- SCAN PART 2 (Tom 2026-11-23): questions that teach the team.
-- ScanRule: every tap answer saved as a rule the scan applies next time.
-- ScanQuestion: max-5 tap-answer items drawn from open review findings.
-- Additive: two new tables only.
CREATE TABLE "ScanRule" (
  "id" TEXT NOT NULL,
  "brandId" TEXT NOT NULL,
  "kind" TEXT NOT NULL,
  "matcher" JSONB NOT NULL,
  "action" JSONB,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "createdFrom" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ScanRule_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ScanRule_brandId_active_idx" ON "ScanRule"("brandId", "active");

CREATE TABLE "ScanQuestion" (
  "id" TEXT NOT NULL,
  "brandId" TEXT NOT NULL,
  "kind" TEXT NOT NULL,
  "ref" JSONB,
  "findingId" TEXT,
  "what" TEXT NOT NULL,
  "options" JSONB NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'open',
  "answerKey" TEXT,
  "ruleId" TEXT,
  "undo" JSONB,
  "severity" TEXT NOT NULL DEFAULT 'normal',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "answeredAt" TIMESTAMP(3),
  CONSTRAINT "ScanQuestion_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ScanQuestion_brandId_status_idx" ON "ScanQuestion"("brandId", "status");
