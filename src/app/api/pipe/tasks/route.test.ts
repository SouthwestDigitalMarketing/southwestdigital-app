import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ list: vi.fn(), upsert: vi.fn(), remove: vi.fn(), auth: vi.fn() }));
vi.mock("@/lib/pipe/tasks", async () => ({
  listPipeTasks: mocks.list,
  upsertPipeTask: mocks.upsert,
  deletePipeTask: mocks.remove,
  parsePipeTaskInput: (body: { title?: string; deleted?: boolean } | null) => {
    if (body?.deleted) return body;
    if (!body?.title) throw new RangeError("title is required");
    return body;
  },
}));
vi.mock("@/lib/pipe/contacts", () => {
  class PipeBrandError extends Error {}
  return { PipeBrandError, authenticatePipeRequest: mocks.auth };
});
vi.mock("@/lib/simpleRateLimit", () => ({ checkRateLimit: () => ({ allowed: true, remaining: 1 }) }));

import { GET, POST } from "./route";

const post = (body: unknown) =>
  new Request("http://x/api/pipe/tasks", { method: "POST", headers: { authorization: "Bearer [REDACTED]" }, body: JSON.stringify(body) });

beforeEach(() => {
  mocks.list.mockReset();
  mocks.upsert.mockReset();
  mocks.remove.mockReset();
  mocks.auth.mockReset().mockReturnValue({ ok: true, actorUserId: "user-1" });
});

describe("/api/pipe/tasks", () => {
  it("rejects a missing or wrong token", async () => {
    mocks.auth.mockReturnValue({ ok: false, status: 401 });
    expect((await POST(post({ title: "x" }))).status).toBe(401);
    mocks.auth.mockReturnValue({ ok: false, status: 503 });
    expect((await GET(new Request("http://x/api/pipe/tasks?brand=b"))).status).toBe(503);
  });
  it("GET needs a brand and returns the list", async () => {
    expect((await GET(new Request("http://x/api/pipe/tasks"))).status).toBe(400);
    mocks.list.mockResolvedValue([{ id: "t1" }]);
    const response = await GET(new Request("http://x/api/pipe/tasks?brand=personal&stage=big3&q=gate"));
    expect(await response.json()).toEqual({ tasks: [{ id: "t1" }] });
    expect(mocks.list).toHaveBeenCalledWith({ actorUserId: "user-1", brand: "personal", stage: "big3", query: "gate" });
  });
  it("POST is 201 when created and 200 when it already existed", async () => {
    mocks.upsert.mockResolvedValueOnce({ created: true, task: { id: "t1" } });
    expect((await POST(post({ pipe_id: "7", title: "x" }))).status).toBe(201);
    mocks.upsert.mockResolvedValueOnce({ created: false, task: { id: "t1" } });
    expect((await POST(post({ pipe_id: "7", title: "x" }))).status).toBe(200);
  });
  it("POST rejects bad input with 400 and an unknown brand with 404", async () => {
    expect((await POST(post({ pipe_id: "7" }))).status).toBe(400);
    const { PipeBrandError } = await import("@/lib/pipe/contacts");
    mocks.upsert.mockRejectedValue(new PipeBrandError("unknown brand b"));
    expect((await POST(post({ pipe_id: "7", title: "x" }))).status).toBe(404);
  });
  it("POST with deleted removes the task and reports it", async () => {
    mocks.remove.mockResolvedValue({ deleted: true });
    const response = await POST(post({ deleted: true, id: "t1" }));
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ deleted: true });
    expect(mocks.upsert).not.toHaveBeenCalled();
  });
});
