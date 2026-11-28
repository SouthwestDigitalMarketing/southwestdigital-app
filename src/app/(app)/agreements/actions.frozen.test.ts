import { beforeEach, describe, expect, it, vi } from "vitest";
process.env.PLATFORM_BASE_URL ??= "https://staff.example.test";
const mocks = vi.hoisted(() => ({ findFirst: vi.fn(), updateMany: vi.fn(), send: vi.fn(), transaction: vi.fn(), deleteMany: vi.fn() }));
vi.mock("@/lib/brands/staff", () => ({ requireStaffBrandOrThrow: async () => ({ brand: { id: "brand" }, session: { user: { id: "staff" } }, membership: { id: "member" } }) }));
vi.mock("@/lib/prisma", () => ({ prisma: {
  engagement: { findFirst: mocks.findFirst, updateMany: mocks.updateMany },
  quote: { findMany: vi.fn() },
  $transaction: mocks.transaction,
} }));
vi.mock("@/lib/emailConnections/send", () => ({ sendFromMembership: mocks.send, EmailConnectionMissingError: class extends Error {}, EmailConnectionRegionInvalidError: class extends Error {} }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
import { batchAgreementAction, deleteAgreementAction, requestAgreementCancellationAction } from "./actions";
beforeEach(() => {
  vi.clearAllMocks();
  mocks.findFirst.mockResolvedValue({ primaryContactEmail: null, billingContactEmail: "signer@example.test", clientName: "SJ Equity", signerName: "Sam" });
  mocks.updateMany.mockResolvedValue({ count: 1 });
  mocks.send.mockResolvedValue({ provider: "zoho", fromAddress: "staff@example.test" });
});
describe("proposal-linked agreement cancellation (unchanged staff workflow)", () => {
  it("still allows cancellation requests on signed proposal-linked agreements", async () => {
    await requestAgreementCancellationAction("eng", "Reason");
    expect(mocks.updateMany).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ agreementManagerStatus: "CANCELLATION_REQUESTED" }),
    }));
    expect(mocks.send).toHaveBeenCalledOnce();
    expect(mocks.send).toHaveBeenCalledWith(expect.objectContaining({ to: "signer@example.test" }));
  });
  it("refuses cancellation without a signer email, as before", async () => {
    mocks.findFirst.mockResolvedValue({ primaryContactEmail: null, billingContactEmail: null, clientName: "SJ Equity", signerName: "Sam" });
    await expect(requestAgreementCancellationAction("eng", "Reason")).rejects.toThrow("signer email");
    expect(mocks.send).not.toHaveBeenCalled();
  });
});
describe("frozen agreement deletion", () => {
  it("refuses to delete a signed proposal-linked engagement under the shared lock", async () => {
    mocks.transaction.mockImplementation(async (fn: (tx: unknown) => unknown) => fn({
      quote: {
        findMany: async () => [{ id: "quote" }],
        findFirst: async () => ({ id: "quote", status: "accepted",
          engagement: { status: "SIGNED", signedAt: new Date(), onboardingFeeStatus: "INVOICED", onboardingData: {} } }),
      },
      engagement: { findMany: async () => [{ id: "eng" }], deleteMany: mocks.deleteMany },
      $queryRaw: async () => [{ id: "eng" }],
    }));
    await expect(deleteAgreementAction("eng")).rejects.toThrow(/frozen/i);
    expect(mocks.deleteMany).not.toHaveBeenCalled();
  });
  it("batch delete removes eligible rows and reports frozen ones as skipped", async () => {
    const frozenEngagement = { id: "eng-frozen", status: "SIGNED", signedAt: new Date(),
      onboardingFeeStatus: "INVOICED", onboardingData: {}, quotes: [{ id: "q1", status: "accepted" }] };
    const deletableEngagement = { id: "eng-ok", status: "ACTIVE", signedAt: null,
      onboardingFeeStatus: "REQUIRED", onboardingData: {}, quotes: [{ id: "q2", status: "draft" }] };
    mocks.transaction.mockImplementation(async (fn: (tx: unknown) => unknown) => fn({
      quote: {
        findMany: async () => [{ id: "q1" }, { id: "q2" }],
        findFirst: async ({ where }: { where: { id: string } }) => where.id === "q2"
          ? { id: "q2", status: "draft", publishedAt: new Date(), snapshotJson: null,
              engagement: { status: "ACTIVE", signedAt: null, onboardingFeeStatus: "REQUIRED", onboardingData: {} } }
          : { id: "q1", status: "accepted", publishedAt: new Date(), snapshotJson: null,
              engagement: { status: "SIGNED", signedAt: new Date(), onboardingFeeStatus: "INVOICED", onboardingData: {} } },
      },
      engagement: { findMany: async () => [frozenEngagement, deletableEngagement], deleteMany: mocks.deleteMany },
      $queryRaw: async () => [{ id: "eng" }],
    }));
    mocks.deleteMany.mockResolvedValue({ count: 1 });
    const summary = await batchAgreementAction(["eng-frozen", "eng-ok"], "delete");
    expect(summary).toEqual({ deleted: 1, skipped: ["eng-frozen"] });
    expect(mocks.deleteMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ id: { in: ["eng-ok"] } }),
    }));
  });
});
