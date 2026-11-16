-- Showrunner video status: what ripley's autopilot is doing with each phone batch, pushed by ripley.
-- Additive only. Idempotent. Brand-scoped like ShowrunnerFeedback.
-- Apply with prisma db execute against DIRECT_DATABASE_URL (port 5432) BEFORE the code merges.
-- Do not use migrate dev or migrate deploy. Do not use the transaction pooler (port 6543).

CREATE TABLE IF NOT EXISTS "ShowrunnerVideoStatus" (
  "id" TEXT NOT NULL,
  "brandId" TEXT NOT NULL,
  "batch" TEXT NOT NULL,
  "project" TEXT,
  "state" TEXT NOT NULL,
  "stage" TEXT,
  "steps" JSONB,
  "render" JSONB,
  "url" TEXT,
  "sentAt" TIMESTAMP(3),
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ShowrunnerVideoStatus_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ShowrunnerVideoStatus_batch_check" CHECK (char_length("batch") BETWEEN 1 AND 60),
  CONSTRAINT "ShowrunnerVideoStatus_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "Brand"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX IF NOT EXISTS "ShowrunnerVideoStatus_brandId_batch_key" ON "ShowrunnerVideoStatus"("brandId", "batch");
CREATE INDEX IF NOT EXISTS "ShowrunnerVideoStatus_brandId_updatedAt_idx" ON "ShowrunnerVideoStatus"("brandId", "updatedAt");

ALTER TABLE "ShowrunnerVideoStatus" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ShowrunnerVideoStatus" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "showrunner_video_status_brand_context" ON "ShowrunnerVideoStatus";
CREATE POLICY "showrunner_video_status_brand_context" ON "ShowrunnerVideoStatus"
TO PUBLIC
USING ("brandId" = NULLIF(current_setting('app.current_brand_id', true), ''))
WITH CHECK ("brandId" = NULLIF(current_setting('app.current_brand_id', true), ''));
