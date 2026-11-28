import { beforeEach, describe, expect, it, vi } from "vitest";
import { buildProposalCheckoutSummary } from "@/lib/engagements/proposalCheckout";
import { sentinelBookkeepingSnapshot } from "@/lib/quotes/publicProposalSentinel";
const mocks = vi.hoisted(() => ({ engagement: vi.fn(), update: vi.fn(), quote: vi.fn(), revision: vi.fn(),
  quoteUpdate: vi.fn(), domains: vi.fn(), patch: vi.fn(), alert: vi.fn(), lock: vi.fn(), fetch: vi.fn() }));
vi.mock("@/lib/prisma", () => ({ prisma: {
  engagement: { findUnique: mocks.engagement },
  quote: { findFirst: mocks.quote },
  brandDomain: { findMany: mocks.domains },
  $executeRaw: mocks.patch,
  $transaction: (fn: (tx: unknown) => unknown) => fn({ engagement: { updateMany: mocks.update }, quote: { findFirst: mocks.quote, updateMany: mocks.quoteUpdate }, quoteRevision: { findFirst: mocks.revision } }),
} }));
vi.mock("@/lib/notifications/staffAlert", () => ({ sendProposalAlert: mocks.alert }));
vi.mock("@/lib/simpleRateLimit", () => ({ checkRateLimit: () => ({ allowed: true }) }));
vi.mock("@/lib/quotes/mutationLock", () => ({ lockQuoteMutation: mocks.lock, QuoteMutationConflictError: class extends Error {} }));
vi.mock("next/headers", () => ({ headers: async () => new Headers() }));
vi.mock("@/lib/engagements/publicProposalAccess", () => ({ hasPublicProposalAccess: async () => true, publicProposalNotFound: () => Response.json({}, { status: 404 }) }));
import { POST } from "./route";
const selection = buildProposalCheckoutSummary(sentinelBookkeepingSnapshot(), { tier: "maintain", hasTwelveMonthAgreement: false, selectedCleanupPeriodKeys: [], selectedAdditionalOptionIds: [] });
const signedAt = new Date("2026-11-27T12:00:00Z");
const body = { signerName: "Alex", email: "alex@example.test", confirmedReadAndAgreed: true, confirmedScrolledAgreement: true, consentToElectronicSignature: true };
const call = (services: unknown) => {
  mocks.engagement.mockResolvedValue({ brandId: "brand",
    onboardingData: { proposalBuilderState: { services }, proposalAcceptance: { selection: services } },
    onboardingFeeStatus: "REQUIRED", agreementText: "Stored agreement", signedAt: null, signerName: null,
    agreementManagerStatus: "ACTIVE", productKind: "bookkeeping", isTestProposal: false, updatedAt: new Date() });
  return POST(new Request("https://example.test/api/proposal/eng/sign", { method: "POST", body: JSON.stringify(body) }), { params: Promise.resolve({ engagementId: "eng" }) });
};
beforeEach(() => {
  vi.clearAllMocks();
  mocks.quote.mockResolvedValue({ id: "quote", status: "accepted", publicToken: "tok-live-1",
    client: { name: "Alex Example", company: "Example LLC" },
    engagement: { id: "eng", brandId: "brand", status: "SIGNED", signedAt,
      onboardingFeeStatus: "INVOICED", onboardingData: { proposalAcceptance: { selection } } } });
  mocks.revision.mockResolvedValue({ id: "rev", version: 1 }); mocks.update.mockResolvedValue({ count: 1 });
  mocks.domains.mockResolvedValue([{ hostname: "brand.test", isPrimary: true }]);
  mocks.patch.mockResolvedValue(1);
  mocks.fetch.mockRejectedValue(new Error("connect timeout"));
  vi.stubGlobal("fetch", mocks.fetch);
});
describe("sign route credit carry-over", () => {
  it("stores the carry-over on the acceptance atomically with signing", async () => {
    const services = { ...selection, creditRemaining: 400, creditRemainingReason: "Credit for October" };
    expect((await call(services)).status).toBe(200);
    const acceptance = mocks.update.mock.calls[0][0].data.onboardingData.proposalAcceptance;
    expect(acceptance.creditRemaining).toBe(400);
    expect(acceptance.creditRemainingReason).toBe("Credit for October");
    // The frozen selection itself is untouched.
    expect(acceptance.selection).toEqual(services);
  });
  it("writes no carry-over keys when the checkout has no remainder", async () => {
    expect((await call(selection)).status).toBe(200);
    const acceptance = mocks.update.mock.calls[0][0].data.onboardingData.proposalAcceptance;
    expect(acceptance).not.toHaveProperty("creditRemaining");
    expect(acceptance).not.toHaveProperty("creditRemainingReason");
  });
  it("never duplicates the carry-over on an already-signed re-run", async () => {
    const services = { ...selection, creditRemaining: 400, creditRemainingReason: "Credit for October" };
    mocks.engagement.mockResolvedValue({ brandId: "brand",
      onboardingData: { proposalBuilderState: { services },
        proposalAcceptance: { selection: services, creditRemaining: 400, creditRemainingReason: "Credit for October" } },
      onboardingFeeStatus: "INVOICED", agreementText: "Stored agreement", signedAt, signerName: "Alex",
      agreementManagerStatus: "ACTIVE", productKind: "bookkeeping", isTestProposal: false, updatedAt: new Date() });
    const response = await POST(new Request("https://example.test/api/proposal/eng/sign", { method: "POST", body: JSON.stringify(body) }), { params: Promise.resolve({ engagementId: "eng" }) });
    expect(response.status).toBe(200);
    expect(mocks.update).not.toHaveBeenCalled();
  });
});
