import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  staff: vi.fn(),
  findFirst: vi.fn(),
  update: vi.fn(),
  revalidate: vi.fn(),
}));

vi.mock("@/lib/quotes/access", () => ({ requireQuoteStaffOrThrow: mocks.staff }));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    quote: { findFirst: mocks.findFirst, update: mocks.update },
  },
}));
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidate }));
vi.mock("next/navigation", () => ({ redirect: vi.fn() }));
vi.mock("@/lib/quotes/fromContacts", () => ({ contactInfoFromCrm: vi.fn() }));
vi.mock("@/lib/database/schemaCapabilities", () => ({ getSchemaCapabilities: vi.fn() }));
vi.mock("@/lib/engagements/fromOffer", () => ({ ensureQuoteEngagement: vi.fn() }));
vi.mock("@/lib/quotes/mutationLock", () => ({ lockQuoteMutation: vi.fn() }));
vi.mock("@/lib/quotes/clientInfo", () => ({ quoteClientDetailsFromSnapshot: vi.fn() }));

import { revokeOfferPublicLinkAction, setOfferStatusAction } from "./actions";

function form(values: Record<string, string>) {
  const data = new FormData();
  for (const [key, value] of Object.entries(values)) data.set(key, value);
  return data;
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.staff.mockResolvedValue({ brand: { id: "brand" } });
  mocks.update.mockResolvedValue({ id: "quote" });
});

describe("offer public link write path", () => {
  it("revokeOfferPublicLinkAction nulls publicToken", async () => {
    mocks.findFirst.mockResolvedValue({ id: "quote", publicToken: "live-token" });
    await revokeOfferPublicLinkAction(form({ id: "quote" }));
    expect(mocks.update).toHaveBeenCalledWith({
      where: { id: "quote" },
      data: { publicToken: null },
    });
    expect(mocks.revalidate).toHaveBeenCalledWith("/proposal/live-token");
  });

  it("archiving an unsigned quote nulls the revoked token", async () => {
    mocks.findFirst.mockResolvedValue({
      id: "quote",
      sentAt: null,
      firstSentAt: null,
      publicToken: "live-token",
      engagement: { signedAt: null },
    });
    await setOfferStatusAction(form({ id: "quote", status: "archived" }));
    expect(mocks.update).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ status: "archived", publicToken: null }),
    }));
  });

  it("archiving a signed quote keeps publicToken for receipt", async () => {
    mocks.findFirst.mockResolvedValue({
      id: "quote",
      sentAt: new Date(),
      firstSentAt: new Date(),
      publicToken: "live-token",
      engagement: { signedAt: new Date() },
    });
    await setOfferStatusAction(form({ id: "quote", status: "archived" }));
    expect(mocks.update).toHaveBeenCalledWith(expect.objectContaining({
      data: { status: "archived" },
    }));
    expect(mocks.update.mock.calls[0][0].data.publicToken).toBeUndefined();
  });
});
