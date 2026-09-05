import { beforeEach, describe, expect, it, vi } from "vitest";
import { markEngagementDepositPaid } from "./fromOffer";

const mocks = vi.hoisted(() => ({ find: vi.fn(), update: vi.fn(), quote: vi.fn(), transaction: vi.fn() }));
vi.mock("@/lib/prisma", () => ({ prisma: { $transaction: mocks.transaction } }));
const payment = { provider: "stripe" as const, reference: "pi_expected", amount: 500, currency: "USD" };
const obligation = { amountInCents: 50_000, currency: "usd", selectionHash: "hash", chargeKind: "first_month", isTestProposal: false };
const engagement = () => ({ id: "eng", brandId: "brand", signedAt: new Date(), updatedAt: new Date(), onboardingFeeStatus: "INVOICED", onboardingData: { proposalAcceptance: { paymentObligation: obligation } } });

beforeEach(() => {
  vi.clearAllMocks();
  mocks.find.mockResolvedValue(engagement());
  mocks.update.mockResolvedValue({ count: 1 });
  mocks.transaction.mockImplementation(async (callback) => callback({ engagement: { findFirst: mocks.find, updateMany: mocks.update }, quote: { updateMany: mocks.quote } }));
});

describe("atomic payment recording", () => {
  it("scopes evidence and completion updates to the brand in one transaction", async () => {
    await markEngagementDepositPaid("eng", "brand", payment);
    expect(mocks.transaction).toHaveBeenCalledTimes(1);
    expect(mocks.find).toHaveBeenCalledWith(expect.objectContaining({ where: { id: "eng", brandId: "brand" } }));
    expect(mocks.update).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ id: "eng", brandId: "brand", updatedAt: expect.any(Date) }) }));
    expect(mocks.quote).toHaveBeenCalledWith(expect.objectContaining({ where: { engagementId: "eng", brandId: "brand", status: { not: "archived" } } }));
  });
  it("preserves original evidence and timestamps on repeated callbacks", async () => {
    const row = engagement();
    mocks.find.mockResolvedValue({ ...row, onboardingFeeStatus: "PAID", onboardingData: { proposalAcceptance: { paymentObligation: obligation, payment: { ...payment, status: "paid", paidAt: "2026-01-01T00:00:00.000Z" } } } });
    await markEngagementDepositPaid("eng", "brand", payment);
    expect(mocks.update).not.toHaveBeenCalled();
    expect(mocks.quote).not.toHaveBeenCalled();
    await expect(markEngagementDepositPaid("eng", "brand", { ...payment, reference: "pi_other" })).rejects.toThrow("different payment");
  });
  it("does not complete a quote after losing a concurrent write", async () => {
    mocks.update.mockResolvedValue({ count: 0 });
    await expect(markEngagementDepositPaid("eng", "brand", payment)).rejects.toThrow("concurrently");
    expect(mocks.quote).not.toHaveBeenCalled();
  });
  it.each([{ amount: 1 }, { amount: Number.NaN }, { currency: "EUR" }])("rejects payment inconsistent with acceptance: %j", async (change) => {
    await expect(markEngagementDepositPaid("eng", "brand", { ...payment, ...change })).rejects.toThrow("signed obligation");
    expect(mocks.update).not.toHaveBeenCalled();
  });
});
