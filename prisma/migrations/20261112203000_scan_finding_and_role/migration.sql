-- Scanner tables. Idempotent. Brand-scoped like the CRM tables.
-- Seeded only for Bookkeeping Conroe.
-- Applied 2026-11-12 with prisma db execute against DIRECT_DATABASE_URL (port 5432).
-- Do not use migrate dev or migrate deploy. Do not use the transaction pooler (port 6543).

CREATE TABLE IF NOT EXISTS "ScanRole" (
  "id" TEXT NOT NULL,
  "brandId" TEXT NOT NULL,
  "key" TEXT NOT NULL,
  "label" TEXT NOT NULL,
  "holderLabel" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ScanRole_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ScanRole_brandId_key_key" UNIQUE ("brandId", "key"),
  CONSTRAINT "ScanRole_key_check" CHECK ("key" IN ('mail-desk', 'sales-pipeline', 'client-delivery', 'systems')),
  CONSTRAINT "ScanRole_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "Brand"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX IF NOT EXISTS "ScanRole_brandId_idx" ON "ScanRole"("brandId");

CREATE TABLE IF NOT EXISTS "ScanFinding" (
  "id" TEXT NOT NULL,
  "brandId" TEXT NOT NULL,
  "room" TEXT NOT NULL,
  "key" TEXT NOT NULL,
  "what" TEXT NOT NULL,
  "severity" TEXT NOT NULL,
  "evidence" TEXT NOT NULL,
  "state" TEXT NOT NULL DEFAULT 'open',
  "fixLevel" INTEGER NOT NULL,
  "roleKey" TEXT NOT NULL,
  "roleId" TEXT,
  "firstSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "closedAt" TIMESTAMP(3),
  "doneNote" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ScanFinding_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ScanFinding_brandId_room_key_key" UNIQUE ("brandId", "room", "key"),
  CONSTRAINT "ScanFinding_room_check" CHECK ("room" IN ('phone', 'inbox', 'payments', 'contracts', 'non-inbox')),
  CONSTRAINT "ScanFinding_severity_check" CHECK ("severity" IN ('urgent', 'normal')),
  CONSTRAINT "ScanFinding_state_check" CHECK ("state" IN ('open', 'closed')),
  CONSTRAINT "ScanFinding_fixLevel_check" CHECK ("fixLevel" IN (1, 2, 3)),
  CONSTRAINT "ScanFinding_roleKey_check" CHECK ("roleKey" IN ('mail-desk', 'sales-pipeline', 'client-delivery', 'systems')),
  CONSTRAINT "ScanFinding_key_check" CHECK (char_length("key") BETWEEN 1 AND 200),
  CONSTRAINT "ScanFinding_what_check" CHECK (char_length("what") BETWEEN 1 AND 500),
  CONSTRAINT "ScanFinding_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "Brand"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "ScanFinding_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "ScanRole"("id") ON DELETE SET NULL ON UPDATE CASCADE
);
CREATE INDEX IF NOT EXISTS "ScanFinding_brandId_state_lastSeenAt_idx" ON "ScanFinding"("brandId", "state", "lastSeenAt");
CREATE INDEX IF NOT EXISTS "ScanFinding_brandId_room_idx" ON "ScanFinding"("brandId", "room");
CREATE INDEX IF NOT EXISTS "ScanFinding_roleId_idx" ON "ScanFinding"("roleId");

ALTER TABLE "ScanRole" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ScanRole" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "scan_role_brand_context" ON "ScanRole";
CREATE POLICY "scan_role_brand_context" ON "ScanRole"
TO PUBLIC
USING ("brandId" = NULLIF(current_setting('app.current_brand_id', true), ''))
WITH CHECK ("brandId" = NULLIF(current_setting('app.current_brand_id', true), ''));

ALTER TABLE "ScanFinding" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ScanFinding" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "scan_finding_brand_context" ON "ScanFinding";
CREATE POLICY "scan_finding_brand_context" ON "ScanFinding"
TO PUBLIC
USING ("brandId" = NULLIF(current_setting('app.current_brand_id', true), ''))
WITH CHECK ("brandId" = NULLIF(current_setting('app.current_brand_id', true), ''));

-- One statement, so the brand setting and the insert share a transaction
-- even when row-level security is already forced.
DO $$
DECLARE
  brand_id text;
BEGIN
  SELECT id INTO brand_id FROM "Brand"
  WHERE slug = 'bookkeeping-conroe' AND "deletedAt" IS NULL
  LIMIT 1;
  IF brand_id IS NULL THEN
    RAISE NOTICE 'bookkeeping-conroe brand not found; scan roles not seeded';
    RETURN;
  END IF;
  PERFORM set_config('app.current_brand_id', brand_id, true);
  INSERT INTO "ScanRole" ("id", "brandId", "key", "label", "holderLabel", "createdAt", "updatedAt")
  SELECT 'scan_role_' || r.key || '_' || brand_id, brand_id, r.key, r.label, r.holder, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
  FROM (VALUES
    ('mail-desk', 'Mail desk', 'Donna'),
    ('sales-pipeline', 'Sales pipeline', 'Kassad'),
    ('client-delivery', 'Client delivery', 'Tom'),
    ('systems', 'Systems', NULL)
  ) AS r(key, label, holder)
  ON CONFLICT ("brandId", "key") DO NOTHING;
END $$;
