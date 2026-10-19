import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ list: vi.fn(), upsert: vi.fn(), auth: vi.fn() }));
vi.mock("@/lib/pipe/deals", async () => ({
  listPipeDeals: mocks.list,
  upsertPipeDeal: mocks.upsert,
  parsePipeDealInput: (body: { name?: string } | null) => {
    if (!body?.name) throw new RangeError("name is required");
    return body;
  },
}));
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
  new Request("http://x/api/pipe/deals", { method: "POST", headers: { authorization: "Bearer [REDACTED]" }, body: JSON.stringify(body) });

beforeEach(() => {
  mocks.list.mockReset();
  mocks.upsert.mockReset();
  mocks.auth.mockReset().mockReturnValue({ ok: true, actorUserId: "user-1" });
});

describe("/api/pipe/deals", () => {
  it("GET returns the list", async () => {
    mocks.list.mockResolvedValue([{ id: "l1" }]);
    const response = await GET(new Request("http://x/api/pipe/deals?brand=b&q=ari"));
    expect(await response.json()).toEqual({ deals: [{ id: "l1" }] });
    expect(mocks.list).toHaveBeenCalledWith({ actorUserId: "user-1", brand: "b", query: "ari" });
  });
  it("POST is 201 when created and 200 when it already existed", async () => {
    mocks.upsert.mockResolvedValueOnce({ created: true, deal: { id: "l1" } });
    expect((await POST(post({ brand: "b", pipe_id: "7", name: "x" }))).status).toBe(201);
    mocks.upsert.mockResolvedValueOnce({ created: false, deal: { id: "l1" } });
    expect((await POST(post({ brand: "b", pipe_id: "7", name: "x" }))).status).toBe(200);
  });
  it("POST rejects bad input with 400 and an unknown brand with 404", async () => {
    expect((await POST(post({ brand: "b" }))).status).toBe(400);
    const { PipeBrandError } = await import("@/lib/pipe/contacts");
    mocks.upsert.mockRejectedValue(new PipeBrandError("unknown brand b"));
    expect((await POST(post({ brand: "b", pipe_id: "7", name: "x" }))).status).toBe(404);
  });
});
