import { SCANNER_BRAND_SLUG, isScanRoleKey, isScanRoom, type FixLevel, type ScanRoleKey, type ScanRoom, type ScanSeverity } from "./vocab";

const KEY_PATTERN = /^[A-Za-z0-9._:@/=+-]{1,200}$/;
const ALLOWED_KEYS = new Set([
  "brand",
  "room",
  "key",
  "what",
  "severity",
  "evidence",
  "fixLevel",
  "role",
  "presence",
  "doneNote",
]);

export type ScanIngest = {
  brand: typeof SCANNER_BRAND_SLUG;
  room: ScanRoom;
  key: string;
  what: string;
  severity: ScanSeverity;
  evidence: string;
  fixLevel: FixLevel;
  role: ScanRoleKey;
  presence: "open" | "gone";
  doneNote: string | null;
};

export type ParseResult =
  | { ok: true; value: ScanIngest }
  | { ok: false; status: 400 | 403; error: string };

function text(value: unknown, max: number): string {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

export function parseScanIngest(body: unknown): ParseResult {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return { ok: false, status: 400, error: "A JSON object is required." };
  }
  const raw = body as Record<string, unknown>;
  const extra = Object.keys(raw).filter((key) => !ALLOWED_KEYS.has(key));
  if (extra.length > 0) {
    return { ok: false, status: 400, error: `Unknown field: ${extra[0]}. This API only records findings.` };
  }
  const brand = text(raw.brand, 100);
  if (!brand) return { ok: false, status: 400, error: "brand is required." };
  if (brand !== SCANNER_BRAND_SLUG) {
    return { ok: false, status: 403, error: "Scanner is on for Bookkeeping Conroe only." };
  }
  const room = text(raw.room, 40);
  const key = text(raw.key, 200);
  const what = text(raw.what, 500);
  const severity = text(raw.severity, 20);
  const evidence = text(raw.evidence, 4000);
  const role = text(raw.role, 40);
  const presence = text(raw.presence, 10);
  if (raw.doneNote != null && typeof raw.doneNote !== "string") {
    return { ok: false, status: 400, error: "doneNote must be text." };
  }
  const doneNote = raw.doneNote == null ? null : text(raw.doneNote, 1000);
  if (!isScanRoom(room) || !KEY_PATTERN.test(key) || !what || !evidence || !isScanRoleKey(role)) {
    return { ok: false, status: 400, error: "room, key, what, evidence, and role are required." };
  }
  if (severity !== "urgent" && severity !== "normal") {
    return { ok: false, status: 400, error: "severity must be urgent or normal." };
  }
  if (presence !== "open" && presence !== "gone") {
    return { ok: false, status: 400, error: "presence must be open or gone." };
  }
  if (!Number.isInteger(raw.fixLevel) || (raw.fixLevel !== 1 && raw.fixLevel !== 2 && raw.fixLevel !== 3)) {
    return { ok: false, status: 400, error: "fixLevel must be 1, 2, or 3." };
  }
  if (presence === "open" && doneNote) {
    return { ok: false, status: 400, error: "doneNote is only for a gone finding." };
  }
  return {
    ok: true,
    value: {
      brand: SCANNER_BRAND_SLUG,
      room,
      key,
      what,
      severity,
      evidence,
      fixLevel: raw.fixLevel,
      role,
      presence,
      doneNote: doneNote || null,
    },
  };
}

export type StoredFinding = {
  id: string;
  state: "open" | "closed";
  what: string;
  severity: string;
  evidence: string;
  fixLevel: number;
  roleKey: string;
  doneNote: string | null;
  firstSeenAt: Date;
  lastSeenAt: Date;
  closedAt: Date | null;
};

export type ScanDecision =
  | { action: "skip" }
  | { action: "touch" }
  | { action: "close"; doneNote: string | null }
  | { action: "note"; doneNote: string }
  | { action: "insert" }
  | { action: "update"; reopened: boolean; changed: boolean };

export function decideScan(existing: StoredFinding | null, input: ScanIngest): ScanDecision {
  if (input.presence === "gone") {
    if (!existing) return { action: "skip" };
    if (existing.state === "closed") {
      if (input.doneNote && input.doneNote !== existing.doneNote) return { action: "note", doneNote: input.doneNote };
      return { action: "touch" };
    }
    return { action: "close", doneNote: input.doneNote ?? existing.doneNote };
  }
  if (!existing) return { action: "insert" };
  const reopened = existing.state === "closed";
  const changed = reopened
    || existing.what !== input.what
    || existing.severity !== input.severity
    || existing.evidence !== input.evidence
    || existing.fixLevel !== input.fixLevel
    || existing.roleKey !== input.role;
  return { action: "update", reopened, changed };
}

export type ScanWriteResult = {
  mode: "log-only";
  id: string | null;
  state: "open" | "closed" | "absent";
  created: boolean;
  reopened: boolean;
  changed: boolean;
};

type ScanTx = {
  scanRole: {
    findUnique: (args: {
      where: { brandId_key: { brandId: string; key: string } };
      select: { id: true };
    }) => Promise<{ id: string } | null>;
  };
  scanFinding: {
    findUnique: (args: {
      where: { brandId_room_key: { brandId: string; room: string; key: string } };
    }) => Promise<StoredFinding | null>;
    create: (args: { data: Record<string, unknown> }) => Promise<StoredFinding>;
    update: (args: { where: { id: string }; data: Record<string, unknown> }) => Promise<StoredFinding>;
  };
};

/** Records one finding. No mail, no payment, no client message. */
export async function applyScanFinding(
  tx: ScanTx,
  brandId: string,
  input: ScanIngest,
  now = new Date(),
): Promise<ScanWriteResult> {
  const existing = await tx.scanFinding.findUnique({
    where: { brandId_room_key: { brandId, room: input.room, key: input.key } },
  });
  const decision = decideScan(existing, input);
  const base = { mode: "log-only" as const, created: false, reopened: false, changed: false };

  if (decision.action === "skip") return { ...base, id: null, state: "absent" };
  if (!existing) {
    const role = await tx.scanRole.findUnique({
      where: { brandId_key: { brandId, key: input.role } },
      select: { id: true },
    });
    const created = await tx.scanFinding.create({
      data: {
        brandId,
        room: input.room,
        key: input.key,
        what: input.what,
        severity: input.severity,
        evidence: input.evidence,
        state: "open",
        fixLevel: input.fixLevel,
        roleKey: input.role,
        roleId: role?.id ?? null,
        firstSeenAt: now,
        lastSeenAt: now,
      },
    });
    return { mode: "log-only", id: created.id, state: "open", created: true, reopened: false, changed: true };
  }
  if (decision.action === "touch") {
    await tx.scanFinding.update({ where: { id: existing.id }, data: { lastSeenAt: now } });
    return { ...base, id: existing.id, state: "closed" };
  }
  if (decision.action === "note") {
    await tx.scanFinding.update({
      where: { id: existing.id },
      data: { lastSeenAt: now, doneNote: decision.doneNote },
    });
    return { ...base, id: existing.id, state: "closed", changed: true };
  }
  if (decision.action === "close") {
    await tx.scanFinding.update({
      where: { id: existing.id },
      data: { state: "closed", closedAt: now, lastSeenAt: now, doneNote: decision.doneNote },
    });
    return { ...base, id: existing.id, state: "closed", changed: true };
  }
  if (decision.action !== "update") {
    throw new Error("Scanner reached a finding update without an open decision.");
  }
  const role = await tx.scanRole.findUnique({
    where: { brandId_key: { brandId, key: input.role } },
    select: { id: true },
  });
  await tx.scanFinding.update({
    where: { id: existing.id },
    data: {
      what: input.what,
      severity: input.severity,
      evidence: input.evidence,
      fixLevel: input.fixLevel,
      roleKey: input.role,
      roleId: role?.id ?? null,
      state: "open",
      lastSeenAt: now,
      closedAt: null,
      doneNote: decision.reopened ? null : existing.doneNote,
    },
  });
  return {
    mode: "log-only",
    id: existing.id,
    state: "open",
    created: false,
    reopened: decision.reopened,
    changed: decision.changed,
  };
}
