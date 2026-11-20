import { beforeEach, describe, expect, it, vi } from "vitest";

const db = vi.hoisted(() => ({
  contactFindMany: vi.fn(),
  eventFindMany: vi.fn(),
  eventUpsert: vi.fn(),
  syncUpsert: vi.fn(),
  transaction: vi.fn(),
}));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    contact: { findMany: db.contactFindMany },
    scorecardEvent: { findMany: db.eventFindMany, upsert: db.eventUpsert },
    scorecardSync: { upsert: db.syncUpsert },
    $transaction: db.transaction,
  },
}));

import { ingestScorecard, parseEvent, parseIngestBody, parseIsoDate, parseSync, type ParsedIngest } from "./ingest";

const now = new Date("2026-11-20T18:00:00Z");
const event = (over: Record<string, unknown> = {}) => ({
  sourceKey: "quo:msg:AC123",
  channel: "text",
  kind: "text_reply",
  contactId: "c1",
  // Thu 9:00 CST to 9:20 CST.
  startedAt: "2026-11-19T15:00:00Z",
  respondedAt: "2026-11-19T09:20:00-06:00",
  responseVia: "text",
  details: { line: "conroe" },
  ...over,
});

describe("parseIsoDate", () => {
  it("needs a date-time with offset or Z", () => {
    expect(parseIsoDate("2026-11-19T15:00:00Z")?.toISOString()).toBe("2026-11-19T15:00:00.000Z");
    expect(parseIsoDate("2026-11-19T09:00:00.123456-06:00")?.toISOString()).toBe("2026-11-19T15:00:00.123Z");
    expect(parseIsoDate("2026-11-19T15:00:00")).toBeNull();
    expect(parseIsoDate("2026-11-19")).toBeNull();
    expect(parseIsoDate("2026-13-45T15:00:00Z")).toBeNull();
    expect(parseIsoDate(1_700_000_000)).toBeNull();
  });
});

describe("parseEvent", () => {
  it("computes clock and business seconds", () => {
    const parsed = parseEvent(event(), now);
    if (typeof parsed === "string") throw new Error(parsed);
    expect(parsed.clockSeconds).toBe(1200);
    expect(parsed.businessSeconds).toBe(1200);
    expect(parsed.details).toEqual({ line: "conroe" });
  });

  it("keeps an unanswered event with no spans", () => {
    const parsed = parseEvent(event({ respondedAt: null, responseVia: undefined, details: undefined }), now);
    if (typeof parsed === "string") throw new Error(parsed);
    expect(parsed).toMatchObject({ respondedAt: null, clockSeconds: null, businessSeconds: null, responseVia: null, details: null });
  });

  it("counts business seconds only in hours", () => {
    // Fri 17:30 CST to Mon 8:10 CST.
    const parsed = parseEvent(event({ startedAt: "2026-11-13T23:30:00Z", respondedAt: "2026-11-16T14:10:00Z" }), now);
    if (typeof parsed === "string") throw new Error(parsed);
    expect(parsed.businessSeconds).toBe(600);
    expect(parsed.clockSeconds).toBe(62 * 3600 + 40 * 60);
  });

  it("rejects bad fields", () => {
    expect(parseEvent(null, now)).toMatch(/object/);
    expect(parseEvent(event({ sourceKey: "ab" }), now)).toMatch(/sourceKey/);
    expect(parseEvent(event({ sourceKey: "quo msg 1" }), now)).toMatch(/sourceKey/);
    expect(parseEvent(event({ sourceKey: "x".repeat(201) }), now)).toMatch(/sourceKey/);
    expect(parseEvent(event({ channel: "fax" }), now)).toMatch(/channel/);
    expect(parseEvent(event({ kind: "text_sent" }), now)).toMatch(/kind/);
    expect(parseEvent(event({ kind: "email_reply" }), now)).toMatch(/belongs to channel email/);
    expect(parseEvent(event({ contactId: 7 }), now)).toMatch(/contactId/);
    expect(parseEvent(event({ startedAt: "yesterday" }), now)).toMatch(/startedAt/);
    expect(parseEvent(event({ startedAt: "2026-11-21T00:00:00Z", respondedAt: null }), now)).toMatch(/future/);
    expect(parseEvent(event({ respondedAt: "2026-11-19T14:59:59Z" }), now)).toMatch(/before startedAt/);
    expect(parseEvent(event({ respondedAt: "soon" }), now)).toMatch(/respondedAt/);
    expect(parseEvent(event({ responseVia: "x".repeat(41) }), now)).toMatch(/responseVia/);
    expect(parseEvent(event({ details: [1] }), now)).toMatch(/details/);
    expect(parseEvent(event({ details: { big: "x".repeat(3000) } }), now)).toMatch(/details/);
  });

  it("accepts respondedAt equal to startedAt", () => {
    const parsed = parseEvent(event({ respondedAt: "2026-11-19T15:00:00Z" }), now);
    if (typeof parsed === "string") throw new Error(parsed);
    expect(parsed.clockSeconds).toBe(0);
  });
});

describe("parseSync", () => {
  it("validates source, coveredTo and ok", () => {
    expect(parseSync({ source: "quo", coveredTo: "2026-11-20T17:55:00Z", ok: true })).toMatchObject({ source: "quo", ok: true, note: null });
    expect(parseSync({ source: "quo", coveredTo: null, ok: false, note: "imap down" })).toMatchObject({ coveredTo: null, note: "imap down" });
    expect(parseSync({ source: "gmail", ok: true })).toMatch(/source/);
    expect(parseSync({ source: "quo", coveredTo: "x", ok: true })).toMatch(/coveredTo/);
    expect(parseSync({ source: "quo", ok: "yes" })).toMatch(/ok/);
  });
});

describe("parseIngestBody", () => {
  it("rejects a bad body as a whole", () => {
    expect(parseIngestBody(null, now)).toMatch(/JSON object/);
    expect(parseIngestBody({ events: [] }, now)).toMatch(/brand/);
    expect(parseIngestBody({ brand: "b", events: {} }, now)).toMatch(/array/);
    expect(parseIngestBody({ brand: "b", events: Array.from({ length: 501 }, () => event()) }, now)).toMatch(/500/);
    expect(parseIngestBody({ brand: "b", events: [], sync: { source: "x" } }, now)).toMatch(/sync.source/);
  });

  it("rejects only the bad events and keeps the last copy of a repeated key", () => {
    const parsed = parseIngestBody(
      {
        brand: " bookkeeping-conroe ",
        events: [
          event({ responseVia: "call" }),
          event({ sourceKey: "quo:msg:bad", respondedAt: "2026-11-18T00:00:00Z" }),
          event({ responseVia: "text" }),
          "nope",
        ],
        sync: { source: "quo", coveredTo: null, ok: true },
      },
      now,
    );
    if (typeof parsed === "string") throw new Error(parsed);
    expect(parsed.brand).toBe("bookkeeping-conroe");
    expect(parsed.events).toHaveLength(1);
    expect(parsed.events[0].responseVia).toBe("text");
    expect(parsed.rejected).toEqual([
      { index: 1, sourceKey: "quo:msg:bad", error: "respondedAt is before startedAt" },
      { index: 3, sourceKey: null, error: "event must be an object" },
    ]);
    expect(parsed.sync?.source).toBe("quo");
  });

  it("allows exactly 500 events", () => {
    const events = Array.from({ length: 500 }, (_, i) => event({ sourceKey: `quo:msg:${i}` }));
    const parsed = parseIngestBody({ brand: "b", events }, now);
    if (typeof parsed === "string") throw new Error(parsed);
    expect(parsed.events).toHaveLength(500);
  });
});

describe("ingestScorecard", () => {
  beforeEach(() => {
    for (const fn of Object.values(db)) fn.mockReset();
    db.eventUpsert.mockImplementation((args: unknown) => args);
    db.transaction.mockResolvedValue([]);
  });

  const parsed = (raw: Record<string, unknown>[], sync?: Record<string, unknown>) => {
    const result = parseIngestBody({ brand: "b", events: raw, sync }, now);
    if (typeof result === "string") throw new Error(result);
    return result as ParsedIngest;
  };

  it("upserts by (brandId, sourceKey), drops contacts of other brands and records the sync", async () => {
    db.contactFindMany.mockResolvedValue([{ id: "c1" }]);
    db.eventFindMany.mockResolvedValue([{ sourceKey: "quo:msg:1" }]);
    const input = parsed(
      [
        event({ sourceKey: "quo:msg:1" }),
        event({ sourceKey: "quo:msg:2", contactId: "other-brand" }),
        event({ sourceKey: "quo:msg:3", contactId: null, details: null }),
      ],
      { source: "quo", coveredTo: "2026-11-20T17:55:00Z", ok: true },
    );
    const result = await ingestScorecard("brand-1", input, now);
    expect(result).toEqual({ received: 3, created: 2, updated: 1, rejected: [], contactsDropped: 1 });
    expect(db.contactFindMany).toHaveBeenCalledWith({
      where: { brandId: "brand-1", id: { in: ["c1", "other-brand"] } },
      select: { id: true },
    });
    const upserts = db.eventUpsert.mock.calls.map((c) => c[0]);
    expect(upserts[0].where).toEqual({ brandId_sourceKey: { brandId: "brand-1", sourceKey: "quo:msg:1" } });
    expect(upserts[0].create).toMatchObject({ brandId: "brand-1", contactId: "c1", clockSeconds: 1200, businessSeconds: 1200 });
    expect(upserts[1].update.contactId).toBeNull();
    expect(db.transaction).toHaveBeenCalledTimes(1);
    expect(db.syncUpsert).toHaveBeenCalledWith({
      where: { brandId_source: { brandId: "brand-1", source: "quo" } },
      create: expect.objectContaining({ brandId: "brand-1", source: "quo", lastRunAt: now, eventsSent: 3, ok: true }),
      update: expect.objectContaining({ lastRunAt: now, coveredTo: new Date("2026-11-20T17:55:00Z"), eventsSent: 3 }),
    });
  });

  it("writes nothing for an empty batch but still records the sync", async () => {
    const result = await ingestScorecard("brand-1", parsed([], { source: "zoho", ok: false, note: "login failed" }), now);
    expect(result).toEqual({ received: 0, created: 0, updated: 0, rejected: [], contactsDropped: 0 });
    expect(db.contactFindMany).not.toHaveBeenCalled();
    expect(db.transaction).not.toHaveBeenCalled();
    expect(db.syncUpsert).toHaveBeenCalledTimes(1);
  });
});
