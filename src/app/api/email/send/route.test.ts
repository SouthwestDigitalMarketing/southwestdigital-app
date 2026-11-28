import { beforeEach, describe, expect, it, vi } from "vitest";
import { isQuoteFrozen } from "@/lib/quotes/isQuoteFrozen";
const mocks = vi.hoisted(() => ({ quote: vi.fn(), update: vi.fn(), send: vi.fn(), lock: vi.fn() }));
vi.mock("@/lib/brands/staff", () => ({ requireStaffBrandOrThrow: async () => ({ brand: { id: "brand" }, membership: { id: "member" } }) }));
vi.mock("@/lib/prisma", () => ({ prisma: { $transaction: (fn: (tx: unknown) => unknown) => fn({ quote: { findFirst: mocks.quote, update: mocks.update } }) } }));
vi.mock("@/lib/emailConnections/send", () => ({ sendFromMembership: mocks.send, EmailConnectionMissingError: class extends Error {}, EmailConnectionRegionInvalidError: class extends Error {} }));
vi.mock("@/lib/quotes/mutationLock", () => ({ lockQuoteMutation: mocks.lock, QuoteMutationConflictError: class extends Error {} }));
import { POST } from "./route";
import { QuoteMutationConflictError } from "@/lib/quotes/mutationLock";
const call = () => POST(new Request("https://example.test/api/email/send", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ to: "client@example.test", subject: "Offer", bodyText: "Proposal follow-up", offerId: "quote" }) }));
beforeEach(() => {
  vi.clearAllMocks();
  mocks.send.mockResolvedValue({ fromAddress: "staff@example.test", provider: "zoho" });
  // The route trusts the lock's rechecked row: mirror the real guard.
  mocks.lock.mockImplementation(async () => {
    const row = await mocks.quote();
    if (!row) throw new QuoteMutationConflictError("Offer not found.");
    if (isQuoteFrozen(row)) throw new QuoteMutationConflictError("Accepted, signed or paid offers are frozen.");
    return row;
  });
});
describe("proposal email freeze guard", () => {
  it.each([{ status: "accepted" }, { status: "sent", engagement: { signedAt: new Date() } }, { status: "sent", engagement: { onboardingFeeStatus: "PAID" } }])("refuses frozen state %j before delivery", async (state) => {
    mocks.quote.mockResolvedValue({ id: "quote", ...state }); expect((await call()).status).toBe(409);
    expect(mocks.send).not.toHaveBeenCalled(); expect(mocks.update).not.toHaveBeenCalled();
  });
  it("refuses a missing or foreign offer before delivery", async () => { mocks.quote.mockResolvedValue(null); expect((await call()).status).toBe(409); expect(mocks.send).not.toHaveBeenCalled(); });
  it("locks and rechecks before sending an open quote", async () => {
    mocks.quote.mockResolvedValue({ id: "quote", status: "sent", firstSentAt: new Date() });
    expect((await call()).status).toBe(200); expect(mocks.send).toHaveBeenCalledOnce();
    expect(mocks.lock.mock.invocationCallOrder[0]).toBeLessThan(mocks.send.mock.invocationCallOrder[0]);
  });
});
