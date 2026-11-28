import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  staff: vi.fn(),
  findFirst: vi.fn(),
  update: vi.fn(),
  lock: vi.fn(),
  revalidate: vi.fn(),
}));

vi.mock("@/lib/quotes/access", () => ({ requireQuoteStaffOrThrow: mocks.staff }));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    quote: { findFirst: mocks.findFirst },
    $transaction: (fn: (tx: unknown) => unknown) => fn({ quote: { update: mocks.update } }),
  },
}));
vi.mock("@/lib/quotes/mutationLock", () => ({ lockQuoteMutation: mocks.lock }));
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidate }));

import { updateProposalValidityAction } from "./actions";

function form(days: string) {
  const data = new FormData();
  data.set("id", "quote");
  data.set("validityDays", days);
  return data;
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.staff.mockResolvedValue({ brand: { id: "brand" } });
  mocks.findFirst.mockResolvedValue({
    id: "quote",
    status: "sent",
    engagement: null,
    snapshotJson: { kind: "consulting" },
  });
  mocks.update.mockResolvedValue({ id: "quote" });
});

describe("updateProposalValidityAction", () => {
  it("stores the edited window in the snapshot only", async () => {
    await updateProposalValidityAction(form("14"));
    expect(mocks.update).toHaveBeenCalledOnce();
    const data = mocks.update.mock.calls[0][0].data as Record<string, unknown>;
    expect(data).toEqual({
      snapshotJson: { kind: "consulting", proposalValidityDays: 14 },
    });
    expect(mocks.revalidate).toHaveBeenCalledWith("/offers/quote");
  });

  it("rejects out-of-range values", async () => {
    await expect(updateProposalValidityAction(form("0"))).rejects.toThrow("Validity");
    await expect(updateProposalValidityAction(form("400"))).rejects.toThrow("Validity");
    expect(mocks.update).not.toHaveBeenCalled();
  });

  it("refuses frozen quotes", async () => {
    mocks.findFirst.mockResolvedValue({
      id: "quote",
      status: "accepted",
      engagement: null,
      snapshotJson: {},
    });
    await expect(updateProposalValidityAction(form("14"))).rejects.toThrow("frozen");
    expect(mocks.update).not.toHaveBeenCalled();
  });
});
