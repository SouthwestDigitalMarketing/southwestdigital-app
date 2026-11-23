-- Scan progress modal (Tom 2026-11-23): per-source live status on each run.
-- Additive: one nullable column.
ALTER TABLE "scan_runs" ADD COLUMN "sources" JSONB;
