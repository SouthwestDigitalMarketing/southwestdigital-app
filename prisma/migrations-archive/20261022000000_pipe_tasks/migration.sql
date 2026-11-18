-- Front Desk tasks from the pipe terminal tool, plus the two brands they can
-- live under that SWapp did not have: Personal and Lochside LLC.
--
-- Additive only: three new tables and two new brand rows. Nothing existing
-- is altered. Written idempotently: this production database is no longer
-- managed by `prisma migrate deploy` (its history diverged from this
-- checkout), so the file must be safe to run by hand and to re-run. Apply
-- with `prisma db execute --file`, per
-- docs/deployment/database-migration-state.md.
--
-- The two brands are DRAFT, have no domain and no members: they are homes
-- for task rows, not tenants anyone can sign in to.

BEGIN;

INSERT INTO "Brand" ("id", "slug", "name", "status", "createdAt", "updatedAt")
VALUES
  ('brand_personal_pipe', 'personal', 'Personal', 'DRAFT', NOW(), NOW()),
  ('brand_lochside_llc_pipe', 'lochside-llc', 'Lochside LLC', 'DRAFT', NOW(), NOW())
ON CONFLICT ("slug") DO NOTHING;

CREATE TABLE IF NOT EXISTS "PipeTask" (
  "id" TEXT NOT NULL,
  "brandId" TEXT NOT NULL,
  "pipeId" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "instructions" TEXT,
  "stage" TEXT NOT NULL DEFAULT 'todo',
  "taskBrand" TEXT NOT NULL DEFAULT 'personal',
  "ownerKey" TEXT,
  "ownerName" TEXT,
  "ownerKind" TEXT,
  "nextDue" TEXT,
  "big3Rank" INTEGER,
  "big3On" TEXT,
  "closedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "PipeTask_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "PipeTaskTag" (
  "id" TEXT NOT NULL,
  "taskId" TEXT NOT NULL,
  "label" TEXT NOT NULL,
  CONSTRAINT "PipeTaskTag_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "PipeTaskNote" (
  "id" TEXT NOT NULL,
  "taskId" TEXT NOT NULL,
  "pipeNoteId" TEXT NOT NULL,
  "body" TEXT NOT NULL,
  "notedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "PipeTaskNote_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "PipeTask_pipeId_key" ON "PipeTask"("pipeId");
CREATE INDEX IF NOT EXISTS "PipeTask_brandId_stage_idx" ON "PipeTask"("brandId", "stage");
CREATE INDEX IF NOT EXISTS "PipeTask_ownerKey_idx" ON "PipeTask"("ownerKey");
CREATE UNIQUE INDEX IF NOT EXISTS "PipeTaskTag_taskId_label_key" ON "PipeTaskTag"("taskId", "label");
CREATE INDEX IF NOT EXISTS "PipeTaskTag_label_idx" ON "PipeTaskTag"("label");
CREATE UNIQUE INDEX IF NOT EXISTS "PipeTaskNote_taskId_pipeNoteId_key" ON "PipeTaskNote"("taskId", "pipeNoteId");

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'PipeTask_brandId_fkey') THEN
    ALTER TABLE "PipeTask" ADD CONSTRAINT "PipeTask_brandId_fkey"
      FOREIGN KEY ("brandId") REFERENCES "Brand"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'PipeTaskTag_taskId_fkey') THEN
    ALTER TABLE "PipeTaskTag" ADD CONSTRAINT "PipeTaskTag_taskId_fkey"
      FOREIGN KEY ("taskId") REFERENCES "PipeTask"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'PipeTaskNote_taskId_fkey') THEN
    ALTER TABLE "PipeTaskNote" ADD CONSTRAINT "PipeTaskNote_taskId_fkey"
      FOREIGN KEY ("taskId") REFERENCES "PipeTask"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END
$$;

COMMIT;
