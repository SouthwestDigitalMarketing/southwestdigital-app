import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { authenticateScannerRequest } from "./auth";
import { applyScanFinding, decideScan, parseScanIngest, type StoredFinding } from "./ingest";
import { groupOpenByRoom, needsAttention, recentClosed, sortNeedsYou, type ScanListRow } from "./view";
import { SCAN_ROLES, SCAN_ROOMS } from "./vocab";

const token = "scanner-secret";
const env = {
  SCANNER_API_TOKEN_SHA256: createHash("sha256").update(token).digest("hex"),
  SCANNER_API_ACTOR_USER_ID: "user-1",
};

const openBody = {
  brand: "bookkeeping-conroe",
  room: "inbox",
  key: "unanswered:858",
  what: "Kevin has not been answered for 2 days",
  severity: "urgent",
  evidence: "Zoho INBOX UID 858",
  fixLevel: 2,
  role: "mail-desk",
  presence: "open",
};

function row(over: Partial<StoredFinding> = {}): StoredFinding {
  return {
    id: "f1",
    state: "open",
    what: openBody.what,
    severity: "urgent",
    evidence: openBody.evidence,
    fixLevel: 2,
    roleKey: "mail-desk",
    doneNote: null,
    firstSeenAt: new Date("2026-11-12T12:00:00Z"),
    lastSeenAt: new Date("2026-11-12T12:00:00Z"),
    closedAt: null,
    ...over,
  };
}

describe("authenticateScannerRequest", () => {
  it("accepts the right bearer token", () => {
    expect(authenticateScannerRequest(`Bearer ${token}`, env)).toEqual({ ok: true, actorUserId: "user-1" });
  });
  it("rejects a bad token and stays shut when unconfigured", () => {
    expect(authenticateScannerRequest("Bearer nope", env)).toEqual({ ok: false, status: 401 });
    expect(authenticateScannerRequest(`Bearer ${token}`, {})).toEqual({ ok: false, status: 503 });
  });
});

describe("parseScanIngest", () => {
  it("accepts a Bookkeeping Conroe finding", () => {
    const parsed = parseScanIngest(openBody);
    expect(parsed.ok).toBe(true);
  });
  it("refuses another brand, an unknown field, and a done note on an open finding", () => {
    expect(parseScanIngest({ ...openBody, brand: "melbourne-cfo" })).toMatchObject({ ok: false, status: 403 });
    expect(parseScanIngest({ ...openBody, send: true })).toMatchObject({ ok: false, status: 400 });
    expect(parseScanIngest({ ...openBody, doneNote: "sent the reply" })).toMatchObject({ ok: false, status: 400 });
  });
});

describe("decideScan", () => {
  const parsed = parseScanIngest(openBody);
  if (!parsed.ok) throw new Error("fixture");
  const input = parsed.value;

  it("inserts a new open finding and updates a repeat without reopening", () => {
    expect(decideScan(null, input)).toEqual({ action: "insert" });
    expect(decideScan(row(), input)).toEqual({ action: "update", reopened: false, changed: false });
    expect(decideScan(row({ what: "older" }), input)).toEqual({ action: "update", reopened: false, changed: true });
  });
  it("closes an open finding, skips a problem that was never seen, and reopens a return", () => {
    const gone = { ...input, presence: "gone" as const, doneNote: "He replied." };
    expect(decideScan(row(), gone)).toEqual({ action: "close", doneNote: "He replied." });
    expect(decideScan(null, gone)).toEqual({ action: "skip" });
    expect(decideScan(row({ state: "closed" }), input)).toEqual({ action: "update", reopened: true, changed: true });
  });
});

describe("applyScanFinding", () => {
  it("stores a new finding and does not call anything else", async () => {
    const parsed = parseScanIngest(openBody);
    if (!parsed.ok) throw new Error("fixture");
    const created: unknown[] = [];
    const tx = {
      scanRole: { findUnique: async () => ({ id: "role-1" }) },
      scanFinding: {
        findUnique: async () => null,
        create: async (args: { data: Record<string, unknown> }) => {
          created.push(args.data);
          return row({ id: "new" });
        },
        update: async () => { throw new Error("no update"); },
      },
    };
    const result = await applyScanFinding(tx, "brand-1", parsed.value, new Date("2026-11-12T18:00:00Z"));
    expect(result).toMatchObject({ mode: "log-only", id: "new", state: "open", created: true });
    expect(created).toEqual([expect.objectContaining({ brandId: "brand-1", state: "open", roleId: "role-1" })]);
  });
});

describe("the page groups", () => {
  const at = (iso: string) => new Date(iso);
  const item = (over: Partial<ScanListRow>): ScanListRow => ({
    id: "1",
    room: "inbox",
    key: "a",
    what: "One",
    severity: "normal",
    evidence: "e",
    state: "open",
    fixLevel: 3,
    roleKey: "mail-desk",
    firstSeenAt: at("2026-11-12T12:00:00Z"),
    lastSeenAt: at("2026-11-12T12:00:00Z"),
    closedAt: null,
    doneNote: null,
    ...over,
  });

  it("puts ask-first and urgent items in Needs you now, in room order otherwise", () => {
    const rows = [
      item({ id: "surface", fixLevel: 3, severity: "normal", room: "phone" }),
      item({ id: "ask", fixLevel: 2, room: "payments", lastSeenAt: at("2026-11-12T15:00:00Z") }),
      item({ id: "hot", fixLevel: 1, severity: "urgent", room: "inbox", lastSeenAt: at("2026-11-12T14:00:00Z") }),
    ];
    expect(rows.filter(needsAttention).map((row) => row.id).sort()).toEqual(["ask", "hot"]);
    expect(sortNeedsYou(rows).map((row) => row.id)).toEqual(["hot", "ask"]);
    expect(groupOpenByRoom(rows).map((group) => group.room)).toEqual(["phone", "inbox", "payments"]);
  });

  it("lists closed findings newest first", () => {
    const rows = [
      item({ id: "old", state: "closed", closedAt: at("2026-11-10T12:00:00Z") }),
      item({ id: "new", state: "closed", closedAt: at("2026-11-12T12:00:00Z") }),
      item({ id: "open", state: "open" }),
    ];
    expect(recentClosed(rows).map((row) => row.id)).toEqual(["new", "old"]);
  });
});

describe("the SQL file", () => {
  const sql = readFileSync("prisma/migrations/20261112203000_scan_finding_and_role/migration.sql", "utf8");
  it("is idempotent, forces brand row-level security, and seeds only Bookkeeping Conroe", () => {
    expect(sql).toContain('CREATE TABLE IF NOT EXISTS "ScanFinding"');
    expect(sql).toContain('CREATE TABLE IF NOT EXISTS "ScanRole"');
    expect(sql).toContain("FORCE ROW LEVEL SECURITY");
    expect(sql).toContain("DROP POLICY IF EXISTS");
    expect(sql).toContain("bookkeeping-conroe");
    expect(sql).not.toContain("prisma migrate");
    for (const room of SCAN_ROOMS) expect(sql).toContain(`'${room.key}'`);
    for (const role of SCAN_ROLES) expect(sql).toContain(`'${role.key}'`);
  });
});
