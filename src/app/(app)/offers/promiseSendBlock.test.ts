import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ staff: vi.fn(), quote: vi.fn(), update: vi.fn(), transaction: vi.fn() }));
vi.mock("@/lib/quotes/access", () => ({ requireQuoteStaffOrThrow: mocks.staff }));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    quote: { findFirst: mocks.quote, update: mocks.update },
    $transaction: mocks.transaction,
  },
}));
vi.mock("@/lib/tenancy/context", () => ({ withBrandDataTransaction: (_ctx: unknown, fn: (tx: unknown) => unknown) => fn({}) }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/navigation", () => ({ redirect: vi.fn() }));
vi.mock("@/lib/engagements/fromOffer", () => ({ ensureQuoteEngagement: vi.fn() }));
vi.mock("@/lib/quotes/materializeProposalCatalog", () => ({ materializeProposalCatalog: vi.fn() }));
vi.mock("@/lib/agreements/materialize", () => ({ materializeAgreementTemplate: vi.fn() }));
import { markQuoteSentAction, resendQuoteAction, setOfferStatusAction } from "./actions";

const form = () => {
  const data = new FormData();
  data.set("id", "quote");
  data.set("status", "sent");
  return data;
};

const riskySnapshot = { assessment: { introBody: "We guarantee same-day results." } };
const cleanSnapshot = { assessment: { introBody: "Clean books, clear answers." } };

beforeEach(() => {
  vi.clearAllMocks();
  mocks.staff.mockResolvedValue({ brand: { id: "brand" }, dataContext: {} });
});

describe("send promise block", () => {
  it("mark-as-sent refuses flagged wording before any write", async () => {
    mocks.quote.mockResolvedValue({ id: "quote", status: "draft", engagement: null, snapshotJson: riskySnapshot });
    await expect(markQuoteSentAction(form())).rejects.toThrow(/finalize/);
    expect(mocks.transaction).not.toHaveBeenCalled();
    expect(mocks.update).not.toHaveBeenCalled();
  });

  it("resend refuses flagged wording before any write", async () => {
    mocks.quote.mockResolvedValue({ id: "quote", status: "sent", engagement: null, snapshotJson: riskySnapshot });
    await expect(resendQuoteAction(form())).rejects.toThrow(/finalize/);
    expect(mocks.transaction).not.toHaveBeenCalled();
    expect(mocks.update).not.toHaveBeenCalled();
  });

  it("status-to-sent refuses flagged wording before any write", async () => {
    mocks.quote.mockResolvedValue({ id: "quote", status: "draft", engagement: null, snapshotJson: riskySnapshot, sentAt: null, firstSentAt: null, publicToken: null, expiresAt: null, publishedAt: new Date() });
    await expect(setOfferStatusAction(form())).rejects.toThrow(/finalize/);
    expect(mocks.transaction).not.toHaveBeenCalled();
    expect(mocks.update).not.toHaveBeenCalled();
  });

  it("scans the published snapshot when one exists", async () => {
    // Draft was cleaned but the published page is still flagged: send stays blocked.
    mocks.quote.mockResolvedValue({
      id: "quote",
      status: "draft",
      engagement: null,
      snapshotJson: cleanSnapshot,
      publishedSnapshotJson: riskySnapshot,
    });
    await expect(markQuoteSentAction(form())).rejects.toThrow(/finalize/);
    expect(mocks.transaction).not.toHaveBeenCalled();
    expect(mocks.update).not.toHaveBeenCalled();
  });

  it("lets a cleaned republish through even when the draft is still flagged", async () => {
    // Published snapshot is clean (republished after edits); the draft still
    // holds the old flagged text. The gate scans what the link serves.
    mocks.quote.mockResolvedValue({
      id: "quote",
      status: "draft",
      engagement: null,
      snapshotJson: riskySnapshot,
      publishedSnapshotJson: cleanSnapshot,
    });
    const result = await markQuoteSentAction(form()).then(
      () => "resolved",
      (error) => (error instanceof Error ? error.message : String(error)),
    );
    expect(result).not.toMatch(/finalize/);
  });

  it("lets a clean snapshot through the promise check", async () => {
    // The block passes, so mark-as-sent proceeds into the expiry/write path
    // (which the stubs here do not back). Either outcome proves the block let
    // it through rather than refusing it as a promise violation.
    mocks.quote.mockResolvedValue({ id: "quote", status: "draft", engagement: null, snapshotJson: cleanSnapshot });
    const result = await markQuoteSentAction(form()).then(
      () => "resolved",
      (error) => (error instanceof Error ? error.message : String(error)),
    );
    expect(result).not.toMatch(/finalize/);
  });
});
