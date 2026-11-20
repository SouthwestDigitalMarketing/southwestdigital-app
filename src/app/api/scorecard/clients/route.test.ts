import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ auth: vi.fn(), rate: vi.fn(), brand: vi.fn(), records: vi.fn() }));
vi.mock("@/lib/operations/api", () => ({ authenticateOperationsRequest: mocks.auth }));
vi.mock("@/lib/simpleRateLimit", () => ({ checkRateLimit: mocks.rate }));
vi.mock("@/lib/pipe/contacts", () => {
  class PipeBrandError extends Error {}
  return { PipeBrandError, resolveBrand: mocks.brand };
});
vi.mock("@/lib/prisma", () => ({ prisma: { serviceRecord: { findMany: mocks.records } } }));

import { GET } from "./route";

const get = (query: string) => new Request(`http://x/api/scorecard/clients${query}`, { headers: { authorization: "Bearer t" } });

beforeEach(() => {
  for (const fn of Object.values(mocks)) fn.mockReset();
  mocks.auth.mockReturnValue({ ok: true });
  mocks.rate.mockReturnValue({ allowed: true, remaining: 1 });
  mocks.brand.mockResolvedValue({ id: "brand-1", slug: "bookkeeping-conroe" });
});

describe("GET /api/scorecard/clients", () => {
  it("answers 401 and 503 without touching data", async () => {
    mocks.auth.mockReturnValue({ ok: false, status: 401 });
    expect((await GET(get("?brand=bookkeeping-conroe"))).status).toBe(401);
    mocks.auth.mockReturnValue({ ok: false, status: 503 });
    expect((await GET(get("?brand=bookkeeping-conroe"))).status).toBe(503);
    expect(mocks.records).not.toHaveBeenCalled();
  });

  it("answers 429 when rate limited and 400 without a brand", async () => {
    mocks.rate.mockReturnValueOnce({ allowed: false, remaining: 0 });
    expect((await GET(get("?brand=b"))).status).toBe(429);
    expect((await GET(get(""))).status).toBe(400);
  });

  it("answers 404 for an unknown brand", async () => {
    const { PipeBrandError } = await import("@/lib/pipe/contacts");
    mocks.brand.mockRejectedValue(new PipeBrandError("unknown brand nope"));
    expect((await GET(get("?brand=nope"))).status).toBe(404);
  });

  it("lists the brand's clients from service records", async () => {
    mocks.records.mockResolvedValue([
      {
        contactId: "c1",
        startDate: new Date("2026-11-17T00:00:00Z"),
        endDate: null,
        evidenceDate: new Date("2026-11-13T00:00:00Z"),
        contact: {
          name: "Rodan",
          phoneE164: null,
          phoneNumber: "936.555.0101",
          email: "A@B.com",
          secondaryEmail: null,
          businessEmail: null,
          personalEmail: null,
        },
      },
    ]);
    const response = await GET(get("?brand=bookkeeping-conroe"));
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      brand: "bookkeeping-conroe",
      clients: [
        { contactId: "c1", name: "Rodan", phones: ["+19365550101"], emails: ["a@b.com"], clientFrom: "2026-11-13", clientUntil: null },
      ],
    });
    expect(mocks.records.mock.calls[0][0].where).toEqual({ brandId: "brand-1" });
  });
});
