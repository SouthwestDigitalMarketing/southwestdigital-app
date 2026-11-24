-- Scanner reviews (Tom 2026-11-24): spam and newsletter reviews in /scanner.
-- Additive: one new table only.
CREATE TABLE "ScanReviewItem" (
  "id" TEXT NOT NULL,
  "review" TEXT NOT NULL,
  "itemKey" TEXT NOT NULL,
  "data" JSONB NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'pending',
  "answer" TEXT,
  "answeredBy" TEXT,
  "answeredAt" TIMESTAMP(3),
  "appliedAt" TIMESTAMP(3),
  "result" TEXT,
  "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ScanReviewItem_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ScanReviewItem_review_itemKey_key" ON "ScanReviewItem"("review", "itemKey");
CREATE INDEX "ScanReviewItem_review_status_idx" ON "ScanReviewItem"("review", "status");
