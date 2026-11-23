-- Scan button v1: one row per header Scan press (or 15-minute auto run).
-- Additive: new table only.
CREATE TABLE "scan_runs" (
  "id" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'requested',
  "auto" BOOLEAN NOT NULL DEFAULT false,
  "requestedBy" TEXT,
  "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "startedAt" TIMESTAMP(3),
  "finishedAt" TIMESTAMP(3),
  "summary" JSONB,
  "changes" JSONB,
  "error" TEXT,
  CONSTRAINT "scan_runs_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "scan_runs_status_requestedAt_idx" ON "scan_runs"("status", "requestedAt");
