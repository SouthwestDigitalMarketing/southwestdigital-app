import { beforeEach, describe, expect, it, vi } from "vitest";
import { POST } from "./route";

const mocks = vi.hoisted(() => ({
  access: vi.fn(), engagement: vi.fn(), update: vi.fn(), account: vi.fn(),
  retrieve: vi.fn(), create: vi.fn(), cancel: vi.fn(), reconcile: vi.fn(), matches: vi.fn(),
}));
vi.mock("@/lib/engagements/publicProposalAccess", () => ({ hasPublicProposalAccess: mocks.access, publicProposalNotFound: () => Response.json({}, { status: 404 }) }));
vi.mock("@/lib/prisma", () => ({ prisma: { engagement: { findUnique: mocks.engagement, updateMany: mocks.update } } }));
vi.mock("@/lib/stripe", () => ({ getStripeClient: () => ({ paymentIntents: { retrieve: mocks.retrieve, create: mocks.create, cancel: mocks.cancel } }) }));
vi.mock("@/lib/stripe/connect", () => ({ getChargeableConnectedAccountId: mocks.account }));
vi.mock("@/lib/stripe/reconcileProposalPayment", () => ({
  reconcileProposalPayment: mocks.reconcile, matchesProposalPayment: mocks.matches,
  PaymentReconciliationError: class extends Error { constructor() { super("Payment needs review"); } },
}));
const obligation = { amountInCents: 35000, currency: "usd", selectionHash: "signed-hash", chargeKind: "hourly_consulting", isTestProposal: false };
const row = (services = {}) => ({ brandId: "brand", signedAt: new Date(), updatedAt: new Date(), agreementManagerStatus: "ACTIVE", onboardingFeeStatus: "INVOICED", billingContactEmail: "client@example.test", onboardingData: { proposalAcceptance: { paymentObligation: obligation }, proposalBuilderState: { services } } });
const call = () => POST(new Request("https://firm.example.test/api/proposal/eng/payment-intent", { method: "POST" }), { params: Promise.resolve({ engagementId: "eng" }) });
beforeEach(() => {
  vi.resetAllMocks();
  mocks.access.mockResolvedValue(true);
  mocks.engagement.mockResolvedValue(row());
  mocks.account.mockResolvedValue("acct_firm");
  mocks.update.mockResolvedValue({ count: 1 });
  mocks.create.mockResolvedValue({ id: "pi_new", client_secret: "test-secret", livemode: false });
});

describe("proposal payment preparation", () => {
  it("creates from signed totals and saves destination evidence before returning a secret", async () => {
    mocks.engagement.mockResolvedValue(row({ amountDueNow: 1 }));
    expect((await call()).status).toBe(200);
    expect(mocks.create).toHaveBeenCalledWith(expect.objectContaining({ amount: 35000, transfer_data: { destination: "acct_firm" }, metadata: expect.objectContaining({ selectionHash: "signed-hash", brandId: "brand" }) }), expect.any(Object));
    expect(mocks.update).toHaveBeenCalledWith(expect.objectContaining({ data: { onboardingData: expect.objectContaining({ proposalBuilderState: expect.objectContaining({ services: expect.objectContaining({ stripePaymentExpectation: expect.objectContaining({ intentId: "pi_new", connectedAccountId: "acct_firm", amountInCents: 35000 }) }) }) }) } }));
  });
  it("does not charge a legacy signature without frozen payment evidence", async () => {
    mocks.engagement.mockResolvedValue({ ...row(), onboardingData: {} });
    expect((await call()).status).toBe(409);
    expect(mocks.create).not.toHaveBeenCalled();
  });
  it("does not silently accept a previously successful intent", async () => {
    mocks.engagement.mockResolvedValue(row({ stripePaymentIntentId: "pi_prior" }));
    mocks.retrieve.mockResolvedValue({ id: "pi_prior", status: "succeeded" });
    expect((await call()).status).toBe(200);
    expect(mocks.reconcile).toHaveBeenCalledWith(expect.objectContaining({ id: "pi_prior" }), "eng", "brand");
    expect(mocks.create).not.toHaveBeenCalled();
  });
  it("blocks missing Connect routing", async () => {
    mocks.account.mockResolvedValue(null);
    expect((await call()).status).toBe(409);
    expect(mocks.create).not.toHaveBeenCalled();
  });
  it("does not cancel or replace another engagement's intent", async () => {
    mocks.engagement.mockResolvedValue(row({ stripePaymentIntentId: "pi_prior" }));
    mocks.retrieve.mockResolvedValue({ id: "pi_prior", status: "requires_payment_method", metadata: { brandId: "other", engagementId: "other" } });
    expect((await call()).status).toBe(409);
    expect(mocks.cancel).not.toHaveBeenCalled();
    expect(mocks.create).not.toHaveBeenCalled();
  });
  it("withholds the client secret after a concurrent state change", async () => {
    mocks.update.mockResolvedValue({ count: 0 });
    const response = await call();
    expect(response.status).toBe(409);
    expect(await response.text()).not.toContain("test-secret");
    expect(mocks.cancel).not.toHaveBeenCalled();
  });
});
