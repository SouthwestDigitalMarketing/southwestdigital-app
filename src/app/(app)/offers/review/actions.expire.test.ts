import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  staff: vi.fn(),
  findFirst: vi.fn(),
  update: vi.fn(),
  revalidate: vi.fn(),
  redirect: vi.fn(),
  lock: vi.fn(),
}));

vi.mock("@/lib/quotes/access", () => ({ requireQuoteStaffOrThrow: mocks.staff }));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    quote: { findFirst: mocks.findFirst, update: mocks.update },
    $transaction: (fn: (tx: unknown) => unknown) => fn({ quote: { update: mocks.update } }),
  },
}));
vi.mock("@/lib/quotes/mutationLock", () => ({ lockQuoteMutation: mocks.lock }));
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidate }));
vi.mock("next/navigation", () => ({ redirect: mocks.redirect }));

import { expireReviewQuotesAction } from "./actions";
import { oldLinksReviewWhere } from "./query";

function form(ids: string[]) {
  const data = new FormData();
  for (const id of ids) data.append("ids", id);
  return data;
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.staff.mockResolvedValue({ brand: { id: "brand" } });
});

describe("old-links review query", () => {
  it("lists sent, unexpired, unsigned quotes only", () => {
    expect(oldLinksReviewWhere("brand")).toEqual({
      brandId: "brand",
      status: "sent",
      expiresAt: null,
      OR: [{ engagementId: null }, { engagement: { signedAt: null } }],
    });
  });
});

describe("expireReviewQuotesAction", () => {
  it("expires selected rows now and reports the batch", async () => {
    mocks.findFirst
      .mockResolvedValueOnce({ id: "q1", publicToken: "tok-1", status: "sent", engagement: null })
      .mockResolvedValueOnce({ id: "q2", publicToken: null, status: "sent", engagement: null });
    await expireReviewQuotesAction(form(["q1", "q2"]));
    expect(mocks.update).toHaveBeenCalledTimes(2);
    const data = mocks.update.mock.calls[0][0].data as Record<string, unknown>;
    expect(data.expiresAt).toBeInstanceOf(Date);
    expect(data.lastActivityAt).toBeInstanceOf(Date);
    expect(mocks.revalidate).toHaveBeenCalledWith("/offers/review");
    expect(mocks.revalidate).toHaveBeenCalledWith("/proposal/tok-1");
    expect(mocks.redirect).toHaveBeenCalledWith("/offers/review?expired=2&skipped=0");
  });

  it("skips an engagement-signed row and still expires the rest", async () => {
    mocks.findFirst
      .mockResolvedValueOnce({ id: "q1", publicToken: null, status: "sent", engagement: null })
      .mockResolvedValueOnce({
        id: "q2",
        publicToken: null,
        status: "sent",
        engagement: {
          status: "SIGNED",
          signedAt: new Date("2026-09-01T00:00:00Z"),
          onboardingFeeStatus: "UNPAID",
          onboardingData: {},
        },
      });
    await expireReviewQuotesAction(form(["q1", "q2"]));
    expect(mocks.update).toHaveBeenCalledTimes(1);
    expect(mocks.update.mock.calls[0][0].where).toEqual({ id: "q1" });
    expect(mocks.redirect).toHaveBeenCalledWith("/offers/review?expired=1&skipped=1");
  });

  it("skips a proposal-accepted row without touching it", async () => {
    mocks.findFirst.mockResolvedValueOnce({
      id: "q1",
      publicToken: null,
      status: "sent",
      engagement: {
        status: "SENT",
        signedAt: null,
        onboardingFeeStatus: "UNPAID",
        onboardingData: { proposalAcceptance: { acceptedAt: "2026-09-01T00:00:00Z" } },
      },
    });
    await expireReviewQuotesAction(form(["q1"]));
    expect(mocks.update).not.toHaveBeenCalled();
    expect(mocks.redirect).toHaveBeenCalledWith("/offers/review?expired=0&skipped=1");
  });

  it("requires a selection", async () => {
    await expect(expireReviewQuotesAction(new FormData())).rejects.toThrow("Select at least one");
    expect(mocks.findFirst).not.toHaveBeenCalled();
  });
});
