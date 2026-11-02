import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ list: vi.fn(), create: vi.fn(), auth: vi.fn() }));
vi.mock("@/lib/pipe/offers", async () => {
  class PipeOfferError extends Error {}
  return {
    listPipeOffers: mocks.list,
    createPipeOffer: mocks.create,
    PipeOfferError,
    parseCreatePipeOfferInput: (body: { brand?: string; kind?: string; contactIds?: string[] } | null) => {
      if (!body?.brand) throw new RangeError("brand is required");
      if (!body?.kind) throw new RangeError("kind must be one of the known offer types");
      if (!body?.contactIds?.length) throw new RangeError("contactIds must include at least one existing contact");
      return body;
    },
  };
});
vi.mock("@/lib/pipe/contacts", () => {
  class PipeBrandError extends Error {}
  return {
    PipeBrandError,
    authenticatePipeRequest: mocks.auth,
  };
});
vi.mock("@/lib/simpleRateLimit", () => ({ checkRateLimit: () => ({ allowed: true, remaining: 1 }) }));

import { GET, POST } from "./route";

const post = (body: unknown) =>
  new Request("http://x/api/pipe/offers", {
    method: "POST",
    headers: { authorization: "Bearer [REDACTED]" },
    body: JSON.stringify(body),
  });

beforeEach(() => {
  mocks.list.mockReset();
  mocks.create.mockReset();
  mocks.auth.mockReset().mockReturnValue({ ok: true, actorUserId: "user-1" });
});

describe("/api/pipe/offers", () => {
  it("rejects an unauthenticated request", async () => {
    mocks.auth.mockReturnValue({ ok: false, status: 401 });
    const response = await GET(new Request("http://x/api/pipe/offers?brand=b"));
    expect(response.status).toBe(401);
  });

  it("GET requires a brand", async () => {
    const response = await GET(new Request("http://x/api/pipe/offers"));
    expect(response.status).toBe(400);
  });

  it("GET returns the list", async () => {
    mocks.list.mockResolvedValue([{ id: "o1" }]);
    const response = await GET(new Request("http://x/api/pipe/offers?brand=b&q=joe&status=draft"));
    expect(await response.json()).toEqual({ offers: [{ id: "o1" }] });
    expect(mocks.list).toHaveBeenCalledWith({ actorUserId: "user-1", brand: "b", status: "draft", query: "joe" });
  });

  it("POST creates an offer and returns 201", async () => {
    mocks.create.mockResolvedValue({ id: "o1", status: "draft" });
    const response = await POST(post({ brand: "b", kind: "bookkeeping", contactIds: ["c1"] }));
    expect(response.status).toBe(201);
    expect(await response.json()).toEqual({ offer: { id: "o1", status: "draft" } });
  });

  it("POST rejects bad input with 400 and an unknown brand with 404", async () => {
    expect((await POST(post({ brand: "b" }))).status).toBe(400);
    const { PipeBrandError } = await import("@/lib/pipe/contacts");
    mocks.create.mockRejectedValue(new PipeBrandError("unknown brand b"));
    expect((await POST(post({ brand: "b", kind: "bookkeeping", contactIds: ["c1"] }))).status).toBe(404);
  });

  it("POST reports a missing contact with 422", async () => {
    const { PipeOfferError } = await import("@/lib/pipe/offers");
    mocks.create.mockRejectedValue(new PipeOfferError("No matching contact found for this brand."));
    const response = await POST(post({ brand: "b", kind: "bookkeeping", contactIds: ["missing"] }));
    expect(response.status).toBe(422);
  });
});
