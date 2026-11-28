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
const call = () => POST(new Request("https://example.test/api/proposal/eng/sign", { method: "POST", body: JSON.stringify({ signerName: "Alex", email: "alex@example.test", confirmedReadAndAgreed: true, confirmedScrolledAgreement: true, consentToElectronicSignature: true }) }), { params: Promise.resolve({ engagementId: "eng" }) });
beforeEach(() => {
  vi.clearAllMocks();
  mocks.engagement.mockResolvedValue({ brandId: "brand",
    onboardingData: { proposalBuilderState: { services: selection }, proposalAcceptance: { selection } },
    onboardingFeeStatus: "REQUIRED", agreementText: "Stored agreement", signedAt: null, signerName: null,
    agreementManagerStatus: "ACTIVE", productKind: "bookkeeping", isTestProposal: false, updatedAt: new Date() });
  // Post-commit read for the accepted copy: frozen, owned, token-bearing, with the accepted selection.
  mocks.quote.mockResolvedValue({ id: "quote", status: "accepted", publicToken: "tok-live-1",
    client: { name: "Alex Example", company: "Example LLC" },
    engagement: { id: "eng", brandId: "brand", status: "SIGNED", signedAt,
      onboardingFeeStatus: "INVOICED", onboardingData: { proposalAcceptance: { selection } } } });
  mocks.revision.mockResolvedValue({ id: "rev", version: 1 }); mocks.update.mockResolvedValue({ count: 1 });
  mocks.domains.mockResolvedValue([{ hostname: "brand.test", isPrimary: true }]);
  mocks.patch.mockResolvedValue(1);
  // The real copy function's own dependency fails: signing must still succeed.
  mocks.fetch.mockRejectedValue(new Error("connect timeout"));
  vi.stubGlobal("fetch", mocks.fetch);
});
describe("accepted copy at signing", () => {
  it("saves after signature succeeds with the persisted selection", async () => {
    expect((await call()).status).toBe(200);
    expect(mocks.update.mock.calls[0][0].data.onboardingData.proposalAcceptance.selection).toEqual(selection);
    await vi.waitFor(() => expect(mocks.fetch).toHaveBeenCalled());
    expect(mocks.update.mock.invocationCallOrder[0]).toBeLessThan(mocks.fetch.mock.invocationCallOrder[0]);
    expect(mocks.fetch).toHaveBeenCalledWith(expect.stringContaining("/proposal/"), expect.objectContaining({
      headers: expect.objectContaining({ Cookie: "swapp_internal_viewer=1" }),
    }));
    expect(mocks.alert).toHaveBeenCalled();
  });
  it("a throwing copy fetch still signs and never leaks the token", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    const response = await call();
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ ok: true });
    expect(mocks.update).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ signedAt: expect.any(Date), status: "SIGNED" }),
    }));
    await vi.waitFor(() => expect(log).toHaveBeenCalledWith(
      "[proposal/sign] Accepted copy could not be saved", { engagementId: "eng" }));
    expect(JSON.stringify(log.mock.calls)).not.toContain("tok-live-1");
    log.mockRestore();
  });
  it("a 500 copy page still signs the engagement", async () => {
    mocks.fetch.mockResolvedValue(new Response("error page", { status: 500 }));
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    expect((await call()).status).toBe(200);
    expect(mocks.update).toHaveBeenCalled();
    await vi.waitFor(() => expect(log).toHaveBeenCalledWith(
      "[proposal/sign] Accepted copy could not be saved", { engagementId: "eng" }));
    log.mockRestore();
  });
  it("does not capture when the signature loses its optimistic lock", async () => {
    mocks.update.mockResolvedValue({ count: 0 });
    expect((await call()).status).toBe(409); expect(mocks.fetch).not.toHaveBeenCalled();
  });
  it("a failing copy fetch still signs and records a staff-visible error", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    expect((await call()).status).toBe(200);
    await vi.waitFor(() => expect(mocks.patch).toHaveBeenCalled());
    const [sql, json, id, brandId] = mocks.patch.mock.calls[0];
    expect(sql.join("?")).toContain("'{acceptedProposalCopyLastError}'");
    expect(sql.join("?")).not.toContain("'{acceptedProposalCopy}'");
    expect(sql.join("?")).not.toMatch(/updatedAt|SET.*status/);
    expect(JSON.parse(json)).toMatchObject({ reason: "fetch-failed" });
    expect(JSON.stringify(mocks.patch.mock.calls)).not.toContain("tok-live-1");
    expect([id, brandId]).toEqual(["eng", "brand"]);
    log.mockRestore();
  });
});
