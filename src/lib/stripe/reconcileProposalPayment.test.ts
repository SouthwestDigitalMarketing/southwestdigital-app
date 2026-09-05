import { beforeEach, describe, expect, it, vi } from "vitest";
import { matchesProposalPayment, reconcileProposalPayment, type ProposalPaymentIntent } from "./reconcileProposalPayment";
import type { AcceptedPayment, StripePaymentExpectation } from "@/lib/engagements/acceptedPayment";

const mocks = vi.hoisted(() => ({ engagement: vi.fn(), paid: vi.fn() }));
vi.mock("@/lib/prisma", () => ({ prisma: { engagement: { findFirst: mocks.engagement } } }));
vi.mock("@/lib/engagements/fromOffer", () => ({ markEngagementDepositPaid: mocks.paid }));
const accepted: AcceptedPayment = { amountInCents: 50_000, currency: "usd", selectionHash: "accepted-selection", chargeKind: "first_month", isTestProposal: false };
const expected: StripePaymentExpectation = { ...accepted, intentId: "pi_expected", brandId: "brand", engagementId: "eng", connectedAccountId: "acct_firm", livemode: false };
const intent = (): ProposalPaymentIntent => ({
  id: "pi_expected", status: "succeeded", amount: 50_000, amount_received: 50_000, currency: "usd", livemode: false,
  transfer_data: { destination: "acct_firm" },
  latest_charge: null,
  metadata: { brandId: "brand", engagementId: "eng", selectionHash: "accepted-selection", connectedAccountId: "acct_firm", chargeKind: "first_month" },
});
beforeEach(() => {
  vi.clearAllMocks();
  mocks.engagement.mockResolvedValue({ signedAt: new Date(), onboardingData: {
    proposalAcceptance: { paymentObligation: accepted },
    proposalBuilderState: { services: { stripePaymentExpectation: expected } },
  } });
});

describe("Stripe proposal reconciliation", () => {
  it("accepts an exact settled payment", async () => {
    expect(matchesProposalPayment(intent(), expected, accepted)).toBe(true);
    await reconcileProposalPayment(intent(), "eng", "brand");
    expect(mocks.paid).toHaveBeenCalledWith("eng", "brand", expect.objectContaining({ amount: 500, reference: "pi_expected", currency: "USD" }));
  });
  it.each([
    { amount: 49_999 }, { amount_received: 49_999 }, { amount_received: 50_001 }, { currency: "eur" },
    { id: "pi_other" }, { status: "processing" }, { livemode: true }, { transfer_data: null },
    { transfer_data: { destination: "acct_other" } },
  ])("rejects inconsistent provider evidence: %j", async (changes) => {
    const changed = { ...intent(), ...changes } as ProposalPaymentIntent;
    expect(matchesProposalPayment(changed, expected, accepted)).toBe(false);
    await expect(reconcileProposalPayment(changed, "eng", "brand")).rejects.toThrow("needs review");
    expect(mocks.paid).not.toHaveBeenCalled();
  });
  it.each(["brandId", "engagementId", "selectionHash", "connectedAccountId", "chargeKind"])("rejects wrong metadata %s", async (key) => {
    const changed = intent();
    changed.metadata[key] = "wrong";
    await expect(reconcileProposalPayment(changed, "eng", "brand")).rejects.toThrow("needs review");
    expect(mocks.paid).not.toHaveBeenCalled();
  });
  it("does not derive missing expectations from successful webhook metadata", async () => {
    mocks.engagement.mockResolvedValue({ signedAt: new Date(), onboardingData: {} });
    await expect(reconcileProposalPayment(intent(), "eng", "brand")).rejects.toThrow("needs review");
    expect(mocks.paid).not.toHaveBeenCalled();
  });
  it("rejects mismatched saved and accepted amounts", () => {
    expect(matchesProposalPayment(intent(), { ...expected, amountInCents: 100 }, accepted)).toBe(false);
  });
  it("can validate an unpaid intent for reuse without treating it as settled", () => {
    const unpaid: ProposalPaymentIntent = { ...intent(), status: "requires_action", amount_received: 0 };
    expect(matchesProposalPayment(unpaid, expected, accepted, false)).toBe(true);
    expect(matchesProposalPayment(unpaid, expected, accepted)).toBe(false);
  });
});
