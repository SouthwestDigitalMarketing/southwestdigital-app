import { beforeEach, describe, expect, it, vi } from "vitest";
import { recordProcessedStripeEvent, stripeEventAlreadyProcessed } from "./processedStripeEvents";

const mocks = vi.hoisted(() => ({ find: vi.fn(), update: vi.fn(), transaction: vi.fn() }));
vi.mock("@/lib/prisma", () => ({
  prisma: { engagement: { findFirst: mocks.find, updateMany: mocks.update }, $transaction: mocks.transaction },
}));

const obligation = { amountInCents: 50_000, currency: "usd", selectionHash: "hash", chargeKind: "first_month", isTestProposal: false };
const payment = { provider: "stripe", reference: "pi_expected", amount: 500, currency: "USD", status: "paid" };
const engagement = (eventIds?: string[]) => ({
  id: "eng",
  brandId: "brand",
  updatedAt: new Date(),
  onboardingData: {
    proposalAcceptance: {
      paymentObligation: obligation,
      payment,
      ...(eventIds ? { processedStripeEventIds: eventIds } : {}),
    },
  },
});

beforeEach(() => {
  vi.clearAllMocks();
  mocks.find.mockResolvedValue(engagement());
  mocks.update.mockResolvedValue({ count: 1 });
  mocks.transaction.mockImplementation(async (callback) => callback({ engagement: { findFirst: mocks.find, updateMany: mocks.update } }));
});

describe("processed Stripe event ids", () => {
  it("records a Stripe event id without replacing paymentObligation", async () => {
    await recordProcessedStripeEvent("eng", "brand", "evt_1");
    expect(mocks.update).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ id: "eng", brandId: "brand", updatedAt: expect.any(Date) }),
      data: {
        onboardingData: expect.objectContaining({
          proposalAcceptance: expect.objectContaining({
            paymentObligation: obligation,
            payment,
            processedStripeEventIds: ["evt_1"],
          }),
        }),
      },
    }));
  });

  it("treats a repeated event id as already processed", async () => {
    mocks.find.mockResolvedValue(engagement(["evt_1"]));
    await expect(stripeEventAlreadyProcessed("eng", "brand", "evt_1")).resolves.toBe(true);
    await recordProcessedStripeEvent("eng", "brand", "evt_1");
    expect(mocks.update).not.toHaveBeenCalled();
  });

  it("scopes event-id reads and writes to brandId", async () => {
    await stripeEventAlreadyProcessed("eng", "brand", "evt_1");
    expect(mocks.find).toHaveBeenCalledWith(expect.objectContaining({ where: { id: "eng", brandId: "brand" } }));
    await recordProcessedStripeEvent("eng", "brand", "evt_2");
    expect(mocks.find).toHaveBeenCalledWith(expect.objectContaining({ where: { id: "eng", brandId: "brand" } }));
    expect(mocks.update).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ id: "eng", brandId: "brand" }),
    }));
  });
});
