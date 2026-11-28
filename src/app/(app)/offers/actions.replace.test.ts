import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  staff: vi.fn(),
  findFirst: vi.fn(),
  quoteCreate: vi.fn(),
  clientCreate: vi.fn(),
  revalidate: vi.fn(),
  redirect: vi.fn(),
}));

vi.mock("@/lib/quotes/access", () => ({ requireQuoteStaffOrThrow: mocks.staff }));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    quote: { findFirst: mocks.findFirst, create: mocks.quoteCreate },
    quoteClient: { create: mocks.clientCreate },
    $transaction: (fn: (tx: unknown) => unknown) => fn({}),
  },
}));
vi.mock("@/lib/tenancy/context", () => ({ withBrandDataTransaction: vi.fn() }));
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidate }));
vi.mock("next/navigation", () => ({ redirect: mocks.redirect }));
vi.mock("@/lib/engagements/fromOffer", () => ({ ensureQuoteEngagement: vi.fn() }));
vi.mock("@/lib/database/schemaCapabilities", () => ({ getSchemaCapabilities: vi.fn() }));
vi.mock("@/lib/quotes/fromContacts", () => ({ contactInfoFromCrm: vi.fn() }));

import { duplicateQuoteAction } from "./actions";

const source = {
  id: "old-quote",
  status: "sent",
  engagement: null,
  offerCode: "OFF-1",
  snapshotJson: { kind: "consulting" },
  client: { name: "Acme", email: "a@acme.test", company: "Acme" },
  lineItems: [],
};

function form(extra: Record<string, string> = {}) {
  const data = new FormData();
  data.set("id", "old-quote");
  for (const [key, value] of Object.entries(extra)) data.set(key, value);
  return data;
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.staff.mockResolvedValue({ brand: { id: "brand" }, dataContext: {} });
  mocks.findFirst.mockResolvedValue(source);
  mocks.clientCreate.mockResolvedValue({ id: "client-1" });
  mocks.quoteCreate.mockResolvedValue({ id: "new-quote", kind: "consulting" });
});

describe("replace this proposal", () => {
  it("links the duplicate back via snapshot replacesQuoteId", async () => {
    await duplicateQuoteAction(form({ replace: "1" }));
    expect(mocks.quoteCreate).toHaveBeenCalledOnce();
    const snapshot = mocks.quoteCreate.mock.calls[0][0].data.snapshotJson as Record<string, unknown>;
    expect(snapshot.replacesQuoteId).toBe("old-quote");
  });

  it("a plain duplicate carries no replace link", async () => {
    await duplicateQuoteAction(form());
    const snapshot = mocks.quoteCreate.mock.calls[0][0].data.snapshotJson as Record<string, unknown>;
    expect(snapshot.replacesQuoteId).toBeUndefined();
  });

  it("refuses a frozen source without writing", async () => {
    mocks.findFirst.mockResolvedValue({ ...source, status: "accepted" });
    await expect(duplicateQuoteAction(form({ replace: "1" }))).rejects.toThrow("frozen");
    expect(mocks.quoteCreate).not.toHaveBeenCalled();
    expect(mocks.clientCreate).not.toHaveBeenCalled();
  });
});
