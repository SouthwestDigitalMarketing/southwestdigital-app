import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  auth: vi.fn(),
  rate: vi.fn(),
  brand: vi.fn(),
  contactFindMany: vi.fn(),
  eventFindMany: vi.fn(),
  eventUpsert: vi.fn(),
  syncUpsert: vi.fn(),
  transaction: vi.fn(),
}));
vi.mock("@/lib/operations/api", () => ({ authenticateOperationsRequest: mocks.auth }));
vi.mock("@/lib/simpleRateLimit", () => ({ checkRateLimit: mocks.rate }));
vi.mock("@/lib/pipe/contacts", () => {
  class PipeBrandError extends Error {}
  return { PipeBrandError, resolveBrand: mocks.brand };
});
vi.mock("@/lib/prisma", () => ({
  prisma: {
    contact: { findMany: mocks.contactFindMany },
    scorecardEvent: { findMany: mocks.eventFindMany, upsert: mocks.eventUpsert },
    scorecardSync: { upsert: mocks.syncUpsert },
    $transaction: mocks.transaction,
  },
}));

import { POST } from "./route";

const post = (body: unknown) =>
  new Request("http://x/api/scorecard/ingest", {
    method: "POST",
    headers: { authorization: "Bearer t" },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
const event = {
  sourceKey: "quo:msg:1",
  channel: "text",
  kind: "text_reply",
  contactId: "c1",
  startedAt: "2026-11-19T15:00:00Z",
  respondedAt: "2026-11-19T15:10:00Z",
  responseVia: "text",
};

beforeEach(() => {
  for (const fn of Object.values(mocks)) fn.mockReset();
  mocks.auth.mockReturnValue({ ok: true });
  mocks.rate.mockReturnValue({ allowed: true, remaining: 1 });
  mocks.brand.mockResolvedValue({ id: "brand-1", slug: "bookkeeping-conroe" });
  mocks.contactFindMany.mockResolvedValue([{ id: "c1" }]);
  mocks.eventFindMany.mockResolvedValue([]);
  mocks.eventUpsert.mockImplementation((args: unknown) => args);
  mocks.transaction.mockResolvedValue([]);
});

describe("POST /api/scorecard/ingest", () => {
  it("answers 401 and 503 without touching data", async () => {
    mocks.auth.mockReturnValue({ ok: false, status: 401 });
    expect((await POST(post({ brand: "b", events: [] }))).status).toBe(401);
    mocks.auth.mockReturnValue({ ok: false, status: 503 });
    const response = await POST(post({ brand: "b", events: [] }));
    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({ error: "Operations API is not configured." });
    expect(mocks.brand).not.toHaveBeenCalled();
  });

  it("answers 429 when rate limited", async () => {
    mocks.rate.mockReturnValue({ allowed: false, remaining: 0 });
    expect((await POST(post({ brand: "b", events: [] }))).status).toBe(429);
  });

  it("rejects a bad body with 400", async () => {
    expect((await POST(post("not json"))).status).toBe(400);
    expect((await POST(post({ events: [] }))).status).toBe(400);
    expect((await POST(post({ brand: "b", events: Array(501).fill(event) }))).status).toBe(400);
  });

  it("answers 404 for an unknown brand", async () => {
    const { PipeBrandError } = await import("@/lib/pipe/contacts");
    mocks.brand.mockRejectedValue(new PipeBrandError("unknown brand nope"));
    const response = await POST(post({ brand: "nope", events: [event] }));
    expect(response.status).toBe(404);
    expect(mocks.transaction).not.toHaveBeenCalled();
  });

  it("stores good events, lists rejected ones and records the sync", async () => {
    const response = await POST(
      post({
        brand: "bookkeeping-conroe",
        events: [event, { ...event, sourceKey: "quo:msg:2", respondedAt: "2026-11-18T00:00:00Z" }],
        sync: { source: "quo", coveredTo: "2026-11-19T15:10:00Z", ok: true },
      }),
    );
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      received: 2,
      created: 1,
      updated: 0,
      rejected: [{ index: 1, sourceKey: "quo:msg:2", error: "respondedAt is before startedAt" }],
      contactsDropped: 0,
    });
    expect(mocks.brand).toHaveBeenCalledWith("bookkeeping-conroe");
    expect(mocks.eventUpsert.mock.calls[0][0].create).toMatchObject({ brandId: "brand-1", clockSeconds: 600, businessSeconds: 600 });
    expect(mocks.syncUpsert).toHaveBeenCalledTimes(1);
  });
});
