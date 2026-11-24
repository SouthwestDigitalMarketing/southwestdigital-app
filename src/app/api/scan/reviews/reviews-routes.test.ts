import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ findMany: vi.fn(), updateMany: vi.fn(), sync: vi.fn() }));
vi.mock("@/lib/prisma", () => ({
  prisma: { scanReviewItem: { findMany: mocks.findMany, updateMany: mocks.updateMany } },
}));
vi.mock("@/lib/simpleRateLimit", () => ({ checkRateLimit: () => ({ allowed: true, remaining: 1 }) }));
vi.mock("@/lib/scan/reviews", async (load) => ({
  ...(await load<typeof import("@/lib/scan/reviews")>()),
  syncReviewList: mocks.sync,
}));

process.env.SCAN_STATUS_TOKEN = "x".repeat(32);
const headers = { authorization: `Bearer ${"x".repeat(32)}` };

const { GET, POST } = await import("./route");
const { POST: applied } = await import("./applied/route");

const post = (url: string, body: unknown, auth = headers) =>
  new Request(url, { method: "POST", headers: auth, body: JSON.stringify(body) });

beforeEach(() => Object.values(mocks).forEach((fn) => fn.mockReset()));

describe("scan review routes", () => {
  it("need the poller token", async () => {
    expect((await GET(new Request("http://x/api/scan/reviews"))).status).toBe(401);
    expect((await POST(post("http://x/api/scan/reviews", { lists: {} }, { authorization: "Bearer nope" }))).status).toBe(401);
  });

  it("GET lists answered rows for ripley", async () => {
    mocks.findMany.mockResolvedValue([{ id: "1", review: "spam", itemKey: "5", answer: "spam" }]);
    const res = await GET(new Request("http://x/api/scan/reviews", { headers }));
    expect(await res.json()).toEqual({ items: [{ id: "1", review: "spam", itemKey: "5", answer: "spam" }] });
    expect(mocks.findMany.mock.calls[0][0].where).toEqual({ status: "answered" });
  });

  it("POST syncs only the lists that were sent", async () => {
    mocks.sync.mockResolvedValue({ created: 1, reopened: 0, gone: 0 });
    const res = await POST(post("http://x/api/scan/reviews", { lists: { spam: [{ number: 1, from: "a@x.com" }] } }));
    expect(res.status).toBe(200);
    expect(mocks.sync).toHaveBeenCalledTimes(1);
    expect(mocks.sync.mock.calls[0][1]).toBe("spam");
    expect((await POST(post("http://x/api/scan/reviews", {}))).status).toBe(400);
  });

  it("applied marks answered rows applied or failed", async () => {
    mocks.updateMany.mockResolvedValue({ count: 1 });
    const res = await applied(post("http://x/api/scan/reviews/applied", {
      results: [{ id: "1", ok: true, result: "ok" }, { id: "2", ok: false, result: "IMAP down" }],
    }));
    expect(await res.json()).toEqual({ saved: 2 });
    expect(mocks.updateMany.mock.calls.map((c) => [c[0].where, c[0].data.status])).toEqual([
      [{ id: "1", status: "answered" }, "applied"],
      [{ id: "2", status: "answered" }, "failed"],
    ]);
    expect((await applied(post("http://x/api/scan/reviews/applied", { results: [{ id: "1" }] }))).status).toBe(400);
  });
});
