import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  findFirst: vi.fn(),
  findUnique: vi.fn(),
  findMany: vi.fn(),
  updateMany: vi.fn(),
  update: vi.fn(),
  create: vi.fn(),
  leadCreate: vi.fn(),
  upsertContact: vi.fn(),
  internal: vi.fn(),
  tags: vi.fn(),
  finding: vi.fn(),
}));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    scanRun: {
      findFirst: mocks.findFirst,
      findUnique: mocks.findUnique,
      updateMany: mocks.updateMany,
      update: mocks.update,
      create: mocks.create,
    },
    lead: { findFirst: mocks.findFirst, create: mocks.create, update: mocks.update },
    quoteClient: { findFirst: mocks.findFirst, findMany: mocks.findMany, update: mocks.update },
    brand: { findMany: mocks.findMany },
  },
}));
vi.mock("@/lib/tenancy/context", () => ({
  createBrandDataContext: vi.fn((input: unknown) => input),
  withBrandDataTransaction: vi.fn(async (_ctx: unknown, fn: (tx: unknown) => unknown) =>
    fn({ lead: { create: mocks.leadCreate } }),
  ),
}));
vi.mock("@/lib/pipe/contacts", () => ({
  parsePipeContactInput: (input: unknown) => input,
  toE164: (phone: string) => phone,
  upsertPipeContact: mocks.upsertContact,
}));
vi.mock("@/lib/scan/internal", () => ({ computeInternalChanges: mocks.internal }));
vi.mock("@/lib/scan/tags", () => ({ applyTagEvidence: mocks.tags }));
vi.mock("@/lib/scan/questions", () => ({
  syncQuestions: vi.fn(async () => ({ created: 0, retired: 0 })),
  proposeBroaderRules: vi.fn(async () => ({ created: 0 })),
  MAX_OPEN_QUESTIONS: 5,
  QUESTION_OPTIONS: { "sms-lead": [{ key: "create-lead", label: "Create lead" }] },
}));
vi.mock("@/lib/scanner/post", () => ({ postScanFinding: mocks.finding }));
vi.mock("@/lib/simpleRateLimit", () => ({ checkRateLimit: () => ({ allowed: true, remaining: 1 }) }));

process.env.SCAN_STATUS_TOKEN = "x".repeat(32);
const token = { authorization: `Bearer ${"x".repeat(32)}` };

const { GET: pending } = await import("./pending/route");
const { POST: claim } = await import("./claim/route");
const { POST: complete } = await import("./complete/route");
const { POST: progress } = await import("./progress/route");

beforeEach(() => {
  Object.values(mocks).forEach((fn) => fn.mockReset());
  mocks.internal.mockResolvedValue({ changes: [], ga4: null, ga4NeedsLogin: false });
  mocks.tags.mockResolvedValue({ changes: [], fixed: 0, judgments: 0 });
});

describe("scan token guard", () => {
  it("answers 401 without a token and 503 without setup", async () => {
    const noAuth = new Request("http://x/api/scan/pending");
    expect((await pending(noAuth)).status).toBe(401);
    const saved = process.env.SCAN_STATUS_TOKEN;
    delete process.env.SCAN_STATUS_TOKEN;
    expect((await pending(new Request("http://x/api/scan/pending", { headers: token }))).status).toBe(503);
    process.env.SCAN_STATUS_TOKEN = saved;
  });
});

describe("GET /api/scan/pending", () => {
  it("reports the oldest request and the last finish", async () => {
    mocks.findFirst
      .mockResolvedValueOnce({ id: "r1", auto: false, requestedAt: new Date("2026-11-23T04:00:00Z") })
      .mockResolvedValueOnce({ finishedAt: new Date("2026-11-23T03:30:00Z") });
    const response = await pending(new Request("http://x/api/scan/pending", { headers: token }));
    expect(await response.json()).toEqual({
      requested: { id: "r1", auto: false, requestedAt: "2026-11-23T04:00:00.000Z" },
      lastFinishedAt: "2026-11-23T03:30:00.000Z",
    });
  });
});

describe("POST /api/scan/claim", () => {
  it("answers 404 when nothing is requested", async () => {
    mocks.findFirst.mockResolvedValue(null);
    const response = await claim(new Request("http://x/api/scan/claim", { method: "POST", headers: token }));
    expect(response.status).toBe(404);
  });
  it("claims the oldest request atomically", async () => {
    mocks.findFirst.mockResolvedValueOnce({ id: "r1" }).mockResolvedValue(null);
    mocks.updateMany.mockResolvedValue({ count: 1 });
    const response = await claim(
      new Request("http://x/api/scan/claim", { method: "POST", headers: token, body: "{}" }),
    );
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ runId: "r1" });
    expect(mocks.updateMany).toHaveBeenCalledWith({
      where: { id: "r1", status: "requested" },
      data: { status: "running", startedAt: expect.any(Date) },
    });
  });
  it("answers 409 when another poller claimed first", async () => {
    mocks.findFirst.mockResolvedValue({ id: "r1" });
    mocks.updateMany.mockResolvedValue({ count: 0 });
    const response = await claim(
      new Request("http://x/api/scan/claim", { method: "POST", headers: token, body: "{}" }),
    );
    expect(response.status).toBe(409);
  });
  it("starts an auto run on request", async () => {
    mocks.findFirst.mockResolvedValue(null);
    mocks.create.mockResolvedValue({ id: "auto1" });
    const response = await claim(
      new Request("http://x/api/scan/claim", { method: "POST", headers: token, body: '{"auto":true}' }),
    );
    expect(await response.json()).toMatchObject({ runId: "auto1", since: null });
  });
});

describe("POST /api/scan/complete", () => {
  const post = (body: unknown) =>
    new Request("http://x/api/scan/complete", { method: "POST", headers: token, body: JSON.stringify(body) });
  it("validates runId and run state", async () => {
    expect((await complete(post({}))).status).toBe(400);
    mocks.findUnique.mockResolvedValue(null);
    expect((await complete(post({ runId: "nope" }))).status).toBe(404);
    mocks.findUnique.mockResolvedValue({ id: "r1", status: "done" });
    expect((await complete(post({ runId: "r1" }))).status).toBe(409);
  });
  it("creates leads, skips duplicates, and closes the run", async () => {
    mocks.findUnique.mockResolvedValue({ id: "r1", status: "running" });
    mocks.findMany.mockResolvedValue([{ id: "b1", slug: "bookkeeping-conroe" }]);
    mocks.findFirst
      .mockResolvedValueOnce(null) // lead dedup: new
      .mockResolvedValueOnce({ id: "dup" }) // lead dedup: duplicate, skipped
      .mockResolvedValueOnce(null) // signed hint: no client
      .mockResolvedValue(null); // previous done run: none
    mocks.leadCreate.mockResolvedValue({ id: "l1" });
    const response = await complete(
      post({
        runId: "r1",
        changes: [{ kind: "quo", text: "1 new voicemail" }],
        leads: [
          { brand: "bookkeeping-conroe", name: "Dana", phone: "9365550100", source: "quo" },
          { brand: "bookkeeping-conroe", name: "Dup", email: "dup@x.com", source: "zoho" },
          { brand: "nope", name: "Ghost", source: "zoho" },
        ],
        signedHints: [{ fromEmail: "nobody@x.com" }],
      }),
    );
    expect(await response.json()).toEqual({ saved: 2, leadsCreated: 1 });
    expect(mocks.update).toHaveBeenCalledWith({
      where: { id: "r1" },
      data: expect.objectContaining({ status: "done" }),
    });
  });
  it("files uncertain items to the review list, never the bin", async () => {
    mocks.findUnique.mockResolvedValue({ id: "r1", status: "running" });
    mocks.findMany.mockResolvedValue([{ id: "b1", slug: "bookkeeping-conroe" }]);
    mocks.findFirst.mockResolvedValue(null);
    const response = await complete(
      post({
        runId: "r1",
        reviewItems: [
          { brand: "bookkeeping-conroe", room: "phone", key: "scan-cleanup:sms:x", what: "Text is only an email — lead or spam?", evidence: "SMS x" },
          { brand: "nope", room: "inbox", key: "k", what: "w", evidence: "e" },
          { room: "inbox", key: "k", what: "w", evidence: "e" },
        ],
      }),
    );
    expect(await response.json()).toEqual({ saved: 1, leadsCreated: 0 });
    expect(mocks.finding).toHaveBeenCalledTimes(1);
  });

  it("flags a signed hint when the company matches an open quote", async () => {
    mocks.findUnique.mockResolvedValue({ id: "r1", status: "running" });
    mocks.findMany
      .mockResolvedValueOnce([{ id: "b1", slug: "bookkeeping-conroe" }])
      .mockResolvedValue([
        {
          id: "c1",
          brandId: "b1",
          name: "Stephanie Weddington",
          email: "sweddington@potts-law.com",
          company: "SJ Equity LLC",
          notes: null,
        },
      ]);
    mocks.findFirst.mockResolvedValue(null);
    const response = await complete(
      post({
        runId: "r1",
        signedHints: [
          {
            fromEmail: "dpottsprivate@potts-law.com",
            fromName: "Derek Potts",
            subject: "Re: Your bookkeeping proposal for SJ Equity LLC",
            snippet: "Done.",
          },
        ],
      }),
    );
    expect(await response.json()).toEqual({ saved: 1, leadsCreated: 0 });
    expect(mocks.update).toHaveBeenCalledWith({
      where: { id: "c1" },
      data: { notes: expect.stringContaining("verify in QuickBooks") },
    });
  });
});

describe("POST /api/scan/progress", () => {
  const post = (body: unknown) =>
    new Request("http://x/api/scan/progress", { method: "POST", headers: token, body: JSON.stringify(body) });
  it("validates runId, source and run state", async () => {
    expect((await progress(post({}))).status).toBe(400);
    expect((await progress(post({ runId: "r1", source: "nope", status: "done" }))).status).toBe(400);
    mocks.findUnique.mockResolvedValue(null);
    expect((await progress(post({ runId: "nope", source: "zoho", status: "done" }))).status).toBe(404);
    mocks.findUnique.mockResolvedValue({ id: "r1", status: "done", sources: [] });
    expect((await progress(post({ runId: "r1", source: "zoho", status: "done" }))).status).toBe(409);
  });
  it("merges per-source progress into the run", async () => {
    mocks.findUnique.mockResolvedValue({
      id: "r1",
      status: "running",
      sources: [{ source: "zoho", label: "Email (Zoho)", status: "waiting" }],
    });
    const response = await progress(
      post({ runId: "r1", source: "zoho", status: "scanning", detail: "Reading inbox" }),
    );
    expect(response.status).toBe(200);
    expect(mocks.update).toHaveBeenCalledWith({
      where: { id: "r1" },
      data: {
        sources: [{ source: "zoho", label: "Email (Zoho)", status: "scanning", detail: "Reading inbox" }],
      },
    });
  });
});
