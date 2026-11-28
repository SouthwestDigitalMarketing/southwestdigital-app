import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ quote: vi.fn(), update: vi.fn(), transaction: vi.fn() }));
vi.mock("@/lib/prisma", () => ({ prisma: { quote: { findFirst: mocks.quote, update: mocks.update }, $transaction: mocks.transaction } }));
vi.mock("./contacts", () => ({ resolveBrand: async () => ({ id: "brand" }), PipeBrandError: class extends Error {} }));
vi.mock("@/lib/quotes/materializeProposalCatalog", () => ({ materializeProposalCatalog: vi.fn() }));
vi.mock("@/lib/agreements/materialize", () => ({ materializeAgreementTemplate: vi.fn() }));
import { setPipeOfferStatus, updatePipeOfferDraft } from "./offers";
beforeEach(() => vi.clearAllMocks());
describe("pipe offer freeze guards", () => {
  it.each([{ status: "accepted" }, { status: "sent", engagement: { signedAt: new Date() } }, { status: "sent", engagement: { onboardingFeeStatus: "PAID" } }])("refuses send/status and repricing for frozen %j", async (state) => {
    mocks.quote.mockResolvedValue({ id: "quote", ...state });
    const args = { actorUserId: "staff", brand: "firm", offerId: "quote" };
    await expect(setPipeOfferStatus({ ...args, status: "sent" })).rejects.toThrow("frozen");
    await expect(updatePipeOfferDraft({ ...args, patch: { pricing: {} } })).rejects.toThrow("frozen");
    expect(mocks.update).not.toHaveBeenCalled(); expect(mocks.transaction).not.toHaveBeenCalled();
  });
});
