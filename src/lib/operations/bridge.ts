import { prisma } from "@/lib/prisma";

/**
 * ChatGPT <-> Herdr Gmail bridge ON/OFF switch (Tom, 2026-11-28). Tom flips it in /settings/bridge
 * before a ChatGPT Voice session; ripley's bridged.py reads it every ~30 s through
 * /api/operations/bridge and reports its heartbeat. Off = ripley does not connect to Gmail.
 */
export const BRIDGE_KEY = "chatgpt-bridge";
export const BRIDGE_MODES = ["off", "active", "idle", "error"] as const;
export type BridgeMode = (typeof BRIDGE_MODES)[number];
/** No heartbeat for this long and the page says ripley is not answering. */
export const BRIDGE_STALE_MS = 3 * 60_000;

export type BridgeReport = {
  mode: BridgeMode;
  lastCheckAt: Date | null;
  lastMessageAt: Date | null;
  lastMessageUid: number | null;
  lastError: string | null;
  /** Agents may only turn the bridge OFF; turning it on is Tom's tap. */
  turnOff: boolean;
  reportedBy: string;
};

const date = (value: unknown) => {
  if (typeof value !== "string" || !value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

/** Validates ripley's heartbeat body. Returns an error message or the report. */
export function parseBridgeReport(raw: Record<string, unknown> | null): BridgeReport | string {
  if (!raw) return "JSON body required";
  const mode = raw.mode;
  if (typeof mode !== "string" || !(BRIDGE_MODES as readonly string[]).includes(mode)) {
    return `mode must be one of: ${BRIDGE_MODES.join(", ")}`;
  }
  const uid = raw.lastMessageUid;
  return {
    mode: mode as BridgeMode,
    lastCheckAt: date(raw.lastCheckAt),
    lastMessageAt: date(raw.lastMessageAt),
    lastMessageUid: typeof uid === "number" && Number.isInteger(uid) && uid > 0 ? uid : null,
    lastError: typeof raw.lastError === "string" && raw.lastError.trim() ? raw.lastError.trim().slice(0, 300) : null,
    turnOff: raw.turnOff === true,
    reportedBy: typeof raw.reportedBy === "string" ? raw.reportedBy.trim().slice(0, 40) : "",
  };
}

export async function loadBridge() {
  return prisma.bridgeSwitch.findUnique({ where: { key: BRIDGE_KEY } });
}

/** Saves ripley's heartbeat (and an agent's OFF, if asked); returns the switch ripley must follow. */
export async function recordBridgeReport(report: BridgeReport, now = new Date()) {
  const heartbeat = {
    mode: report.mode,
    heartbeatAt: now,
    lastCheckAt: report.lastCheckAt,
    lastMessageAt: report.lastMessageAt,
    lastMessageUid: report.lastMessageUid,
    lastError: report.lastError,
  };
  const off = report.turnOff
    ? { enabled: false, changedAt: now, changedBy: `ripley${report.reportedBy ? `:${report.reportedBy}` : ""}` }
    : {};
  const row = await prisma.bridgeSwitch.upsert({
    where: { key: BRIDGE_KEY },
    create: { key: BRIDGE_KEY, enabled: false, ...heartbeat, ...off },
    update: { ...heartbeat, ...off },
  });
  return { enabled: row.enabled, changedAt: row.changedAt, changedBy: row.changedBy };
}

export async function setBridgeEnabled(enabled: boolean, changedBy: string, now = new Date()) {
  return prisma.bridgeSwitch.upsert({
    where: { key: BRIDGE_KEY },
    create: { key: BRIDGE_KEY, enabled, changedAt: now, changedBy },
    update: { enabled, changedAt: now, changedBy },
  });
}

export type BridgeView = {
  enabled: boolean;
  /** What the page shows as ripley's state. */
  state: "off" | "turning-on" | "turning-off" | "active" | "idle" | "error" | "not-answering";
  heartbeatAt: Date | null;
  lastCheckAt: Date | null;
  lastMessageAt: Date | null;
  lastMessageUid: number | null;
  lastError: string | null;
  changedAt: Date | null;
  changedBy: string | null;
};

type BridgeRow = Awaited<ReturnType<typeof loadBridge>>;

/** Combines Tom's switch with ripley's last report into one plain state. */
export function bridgeView(row: BridgeRow, now = new Date()): BridgeView {
  const enabled = row?.enabled ?? false;
  const heartbeatAt = row?.heartbeatAt ?? null;
  const fresh = heartbeatAt !== null && now.getTime() - heartbeatAt.getTime() < BRIDGE_STALE_MS;
  const mode = row?.mode ?? null;
  // A report older than the last flip still describes the old setting.
  const caughtUp = fresh && (!row?.changedAt || (heartbeatAt !== null && heartbeatAt >= row.changedAt));
  let state: BridgeView["state"];
  if (!fresh) state = enabled ? "not-answering" : "off";
  else if (!caughtUp) state = enabled ? "turning-on" : "turning-off";
  else if (!enabled) state = mode === "off" ? "off" : "turning-off";
  else if (mode === "active" || mode === "idle" || mode === "error") state = mode;
  else state = "turning-on";
  return {
    enabled,
    state,
    heartbeatAt,
    lastCheckAt: row?.lastCheckAt ?? null,
    lastMessageAt: row?.lastMessageAt ?? null,
    lastMessageUid: row?.lastMessageUid ?? null,
    lastError: row?.lastError ?? null,
    changedAt: row?.changedAt ?? null,
    changedBy: row?.changedBy ?? null,
  };
}
