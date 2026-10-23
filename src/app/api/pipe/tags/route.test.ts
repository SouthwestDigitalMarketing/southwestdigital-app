import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ list: vi.fn(), apply: vi.fn(), auth: vi.fn() }));
vi.mock("@/lib/pipe/contacts", async () => {
  class PipeBrandError extends Error {}
  return { PipeBrandError, authenticatePipeRequest: mocks.auth };
});
vi.mock("@/lib/pipe/tags", async () => {
  class PipeTagNotFoundError extends Error {}
  return {
    PipeTagNotFoundError,
    applyPipeTag: mocks.apply,
    listPipeContactTags: mocks.list,
    parsePipeTagInput: (body: { tag?: string } | null) => {
      if (!body?.tag) throw new RangeError("tag is required");
      return body;
    },
  };
});
vi.mock("@/lib/simpleRateLimit", () => ({ checkRateLimit: () => ({ allowed: true, remaining: 1 }) }));

import { GET, POST } from "./route";

const post = (body: unknown) =>
  new Request("http://x/api/pipe/tags", { method: "POST", headers: { authorization: "Bearer t" }, body: JSON.stringify(body) });

beforeEach(() => {
  mocks.list.mockReset();
  mocks.apply.mockReset();
  mocks.auth.mockReset().mockReturnValue({ ok: true, actorUserId: "user-1" });
});

describe("/api/pipe/tags", () => {
  it("answers 401 and 503 without touching data", async () => {
    mocks.auth.mockReturnValue({ ok: false, status: 401 });
    expect((await GET(new Request("http://x/api/pipe/tags?brand=b&contactId=c"))).status).toBe(401);
    mocks.auth.mockReturnValue({ ok: false, status: 503 });
    expect((await POST(post({ tag: "x" }))).status).toBe(503);
    expect(mocks.list).not.toHaveBeenCalled();
    expect(mocks.apply).not.toHaveBeenCalled();
  });
  it("GET needs brand and contactId", async () => {
    expect((await GET(new Request("http://x/api/pipe/tags?brand=b"))).status).toBe(400);
  });
  it("GET returns the tag keys", async () => {
    mocks.list.mockResolvedValue(["lead", "reviews"]);
    const response = await GET(new Request("http://x/api/pipe/tags?brand=b&contactId=c1"));
    expect(await response.json()).toEqual({ tags: ["lead", "reviews"] });
    expect(mocks.list).toHaveBeenCalledWith({ actorUserId: "user-1", brand: "b", contactId: "c1" });
  });
  it("POST is 201 when the tag was created and 200 otherwise", async () => {
    mocks.apply.mockResolvedValueOnce({ tagCreated: true, changed: true });
    expect((await POST(post({ tag: "reviews" }))).status).toBe(201);
    mocks.apply.mockResolvedValueOnce({ tagCreated: false, changed: false });
    expect((await POST(post({ tag: "reviews" }))).status).toBe(200);
  });
  it("POST rejects bad input with 400 and unknown brand or contact with 404", async () => {
    expect((await POST(post({}))).status).toBe(400);
    const { PipeBrandError } = await import("@/lib/pipe/contacts");
    const { PipeTagNotFoundError } = await import("@/lib/pipe/tags");
    mocks.apply.mockRejectedValueOnce(new PipeBrandError("unknown brand b"));
    expect((await POST(post({ tag: "x" }))).status).toBe(404);
    mocks.apply.mockRejectedValueOnce(new PipeTagNotFoundError("unknown contact c"));
    expect((await POST(post({ tag: "x" }))).status).toBe(404);
  });
});
