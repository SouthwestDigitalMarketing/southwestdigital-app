import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ list: vi.fn(), upsert: vi.fn(), auth: vi.fn() }));
vi.mock("@/lib/pipe/contacts", async () => {
  class PipeBrandError extends Error {}
  return {
    PipeBrandError,
    authenticatePipeRequest: mocks.auth,
    listPipeContacts: mocks.list,
    upsertPipeContact: mocks.upsert,
    parsePipeContactInput: (body: { name?: string } | null) => {
      if (!body?.name) throw new RangeError("name is required");
      return body;
    },
  };
});
vi.mock("@/lib/simpleRateLimit", () => ({ checkRateLimit: () => ({ allowed: true, remaining: 1 }) }));

import { GET, POST } from "./route";

const post = (body: unknown) =>
  new Request("http://x/api/pipe/contacts", { method: "POST", headers: { authorization: "Bearer t" }, body: JSON.stringify(body) });

beforeEach(() => {
  mocks.list.mockReset();
  mocks.upsert.mockReset();
  mocks.auth.mockReset().mockReturnValue({ ok: true, actorUserId: "user-1" });
});

describe("/api/pipe/contacts", () => {
  it("answers 401 and 503 without touching data", async () => {
    mocks.auth.mockReturnValue({ ok: false, status: 401 });
    expect((await GET(new Request("http://x/api/pipe/contacts?brand=b"))).status).toBe(401);
    mocks.auth.mockReturnValue({ ok: false, status: 503 });
    expect((await POST(post({ name: "x" }))).status).toBe(503);
    expect(mocks.list).not.toHaveBeenCalled();
    expect(mocks.upsert).not.toHaveBeenCalled();
  });
  it("GET needs a brand", async () => {
    expect((await GET(new Request("http://x/api/pipe/contacts"))).status).toBe(400);
  });
  it("GET returns the list", async () => {
    mocks.list.mockResolvedValue([{ id: "c1" }]);
    const response = await GET(new Request("http://x/api/pipe/contacts?brand=b&q=dana"));
    expect(await response.json()).toEqual({ contacts: [{ id: "c1" }] });
    expect(mocks.list).toHaveBeenCalledWith({ actorUserId: "user-1", brand: "b", query: "dana" });
  });
  it("POST is 201 when created and 200 when it already existed", async () => {
    mocks.upsert.mockResolvedValueOnce({ created: true, contact: { id: "c1" } });
    expect((await POST(post({ brand: "b", name: "x" }))).status).toBe(201);
    mocks.upsert.mockResolvedValueOnce({ created: false, contact: { id: "c1" } });
    expect((await POST(post({ brand: "b", name: "x" }))).status).toBe(200);
  });
  it("POST rejects bad input with 400 and an unknown brand with 404", async () => {
    expect((await POST(post({ brand: "b" }))).status).toBe(400);
    const { PipeBrandError } = await import("@/lib/pipe/contacts");
    mocks.upsert.mockRejectedValue(new PipeBrandError("unknown brand b"));
    expect((await POST(post({ brand: "b", name: "x" }))).status).toBe(404);
  });
});
