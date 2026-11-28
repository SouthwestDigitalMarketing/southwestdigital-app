-- ChatGPT bridge ON/OFF switch (Tom 2026-11-28): /settings/bridge, read by ripley.
-- Additive: one new table only. Starts with no row = off.
CREATE TABLE "BridgeSwitch" (
  "key" TEXT NOT NULL,
  "enabled" BOOLEAN NOT NULL DEFAULT false,
  "changedAt" TIMESTAMP(3),
  "changedBy" TEXT,
  "mode" TEXT,
  "heartbeatAt" TIMESTAMP(3),
  "lastCheckAt" TIMESTAMP(3),
  "lastMessageAt" TIMESTAMP(3),
  "lastMessageUid" INTEGER,
  "lastError" TEXT,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "BridgeSwitch_pkey" PRIMARY KEY ("key")
);
