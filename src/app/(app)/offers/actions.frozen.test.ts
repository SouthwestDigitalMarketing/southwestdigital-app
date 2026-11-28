import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ staff: vi.fn(), quote: vi.fn(), transaction: vi.fn(), update: vi.fn(), contact: vi.fn() }));
vi.mock("@/lib/quotes/access", () => ({ requireQuoteStaffOrThrow: mocks.staff }));
vi.mock("@/lib/prisma", () => ({ prisma: { quote: { findFirst: mocks.quote, update: mocks.update }, $transaction: mocks.transaction } }));
vi.mock("@/lib/tenancy/context", () => ({ withBrandDataTransaction: (ctx: unknown, fn: (tx: unknown) => unknown) => fn({ contact: { findFirst: mocks.contact } }) }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/navigation", () => ({ redirect: vi.fn() }));
vi.mock("@/lib/engagements/fromOffer", () => ({ ensureQuoteEngagement: vi.fn() }));
vi.mock("@/lib/quotes/materializeProposalCatalog", () => ({ materializeProposalCatalog: vi.fn() }));
vi.mock("@/lib/agreements/materialize", () => ({ materializeAgreementTemplate: vi.fn() }));
import { markQuoteSentAction, resendQuoteAction, reassignQuoteContactAction, setOfferStatusAction, revokeOfferPublicLinkAction, deleteQuoteAction, clearDuplicateMarkerAction } from "./actions";
import { publishOfferChangesAction, saveOfferDraftAction } from "./who/actions";
import { publishHourlyOfferAction, saveHourlyOfferDraftAction, type HourlyOfferSnapshot } from "./hourly/actions";
const form = () => { const f = new FormData(); f.set("id", "quote"); f.set("contactId", "contact"); f.set("status", "sent"); return f; };
const paths = [
  ["mark sent", () => markQuoteSentAction(form())], ["resend", () => resendQuoteAction(form())],
  ["reassign / republish", () => reassignQuoteContactAction(form())], ["status / expiry", () => setOfferStatusAction(form())],
  ["revoke", () => revokeOfferPublicLinkAction(form())], ["delete", () => deleteQuoteAction(form())],
  ["clear duplicate", () => clearDuplicateMarkerAction(form())],
  ["bookkeeping publish", () => publishOfferChangesAction("quote", {})], ["bookkeeping save", () => saveOfferDraftAction("quote", {})],
  ["hourly publish", () => publishHourlyOfferAction("quote", {} as HourlyOfferSnapshot)], ["hourly save", () => saveHourlyOfferDraftAction("quote", {} as HourlyOfferSnapshot)],
] as const;
beforeEach(() => { vi.clearAllMocks(); mocks.staff.mockResolvedValue({ brand: { id: "brand" }, dataContext: {} }); mocks.contact.mockResolvedValue({ id: "contact" }); });
describe.each([
  ["accepted", { status: "accepted", engagement: null }],
  ["signed", { status: "sent", engagement: { signedAt: new Date() } }],
  ["paid", { status: "sent", engagement: { onboardingFeeStatus: "PAID" } }],
])("frozen %s offer", (_, state) => {
  it.each(paths)("refuses %s before any write", async (_name, run) => {
    mocks.quote.mockResolvedValue({ id: "quote", kind: "consulting", ...state });
    await expect(run()).rejects.toThrow("frozen");
    expect(mocks.transaction).not.toHaveBeenCalled(); expect(mocks.update).not.toHaveBeenCalled();
  });
});
