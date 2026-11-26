-- Job numbers for Donna's jobs (Tom, 2026-11-26). Existing jobs are numbered in the
-- order they were created; new jobs take the next number from the sequence.
ALTER TABLE "DonnaJob" ADD COLUMN "number" INTEGER;

WITH ordered AS (
  SELECT "id", row_number() OVER (ORDER BY "receivedAt", "id") AS n FROM "DonnaJob"
)
UPDATE "DonnaJob" j SET "number" = ordered.n FROM ordered WHERE j."id" = ordered."id";

CREATE SEQUENCE "DonnaJob_number_seq" AS INTEGER OWNED BY "DonnaJob"."number";
SELECT setval('"DonnaJob_number_seq"', COALESCE((SELECT MAX("number") FROM "DonnaJob"), 0) + 1, false);

ALTER TABLE "DonnaJob"
  ALTER COLUMN "number" SET DEFAULT nextval('"DonnaJob_number_seq"'),
  ALTER COLUMN "number" SET NOT NULL;

CREATE UNIQUE INDEX "DonnaJob_number_key" ON "DonnaJob"("number");
