import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({
  quote: vi.fn(),
  brandDiscounts: vi.fn(),
  transaction: vi.fn(),
  quoteUpdate: vi.fn(),
}));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    quote: { findFirst: mocks.quote, update: mocks.quoteUpdate },
    brandDiscount: { findMany: mocks.brandDiscounts },
    $transaction: mocks.transaction,
  },
}));
vi.mock("./contacts", () => ({
  resolveBrand: async () => ({ id: "brand" }),
  PipeBrandError: class extends Error {},
}));
vi.mock("@/lib/quotes/materializeProposalCatalog", () => ({ materializeProposalCatalog: vi.fn() }));
vi.mock("@/lib/agreements/materialize", () => ({ materializeAgreementTemplate: vi.fn() }));
vi.mock("@/lib/quotes/mutationLock", () => ({ lockQuoteMutation: vi.fn() }));
vi.mock("@/lib/database/schemaCapabilities", () => ({
  getSchemaCapabilities: async () => ({ quoteRevisions: false, quoteEngagement: false }),
}));
vi.mock("@/lib/quotes/supersedeReplaced", () => ({ supersedeReplacedQuoteOnWrite: vi.fn() }));
import { setPipeOfferStatus } from "./offers";

const riskySnapshot = { assessment: { introBody: "We guarantee same-day results." } };
const cleanSnapshot = { assessment: { introBody: "Clean books, clear answers." } };

const args = { actorUserId: "staff", brand: "firm", offerId: "quote" };

beforeEach(() => {
  vi.clearAllMocks();
  mocks.brandDiscounts.mockResolvedValue([]);
  mocks.transaction.mockImplementation(async (fn: (tx: unknown) => unknown) => fn({
    quote: { update: mocks.quoteUpdate },
  }));
  mocks.quoteUpdate.mockImplementation(async (input: { data?: { status?: string } }) => ({
    id: "quote",
    offerCode: "Q-1",
    slug: "s",
    kind: "bookkeeping",
    status: input?.data?.status ?? "sent",
    totalOneTime: { toNumber: () => 0 },
    totalRecurring: { toNumber: () => 0 },
    onboardingFee: { toNumber: () => 0 },
    publicToken: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    sentAt: new Date(),
    client: null,
  }));
});

describe("pipe set-status promise block", () => {
  it("refuses status sent while flagged wording is unconfirmed, before any write", async () => {
    mocks.quote
      .mockResolvedValueOnce({ id: "quote", status: "draft", engagement: null })
      .mockResolvedValueOnce({ snapshotJson: riskySnapshot, publishedSnapshotJson: null, publishedAt: null });
    await expect(setPipeOfferStatus({ ...args, status: "sent" })).rejects.toThrow(/finalize/);
    expect(mocks.transaction).not.toHaveBeenCalled();
  });

  it("scans the published snapshot, not just the cleaned draft", async () => {
    mocks.quote
      .mockResolvedValueOnce({ id: "quote", status: "draft", engagement: null })
      .mockResolvedValueOnce({ snapshotJson: cleanSnapshot, publishedSnapshotJson: riskySnapshot, publishedAt: new Date() });
    await expect(setPipeOfferStatus({ ...args, status: "sent" })).rejects.toThrow(/finalize/);
    expect(mocks.transaction).not.toHaveBeenCalled();
  });

  it("sends a cleaned republish even when the draft is still flagged", async () => {
    mocks.quote
      .mockResolvedValueOnce({ id: "quote", status: "draft", engagement: null })
      .mockResolvedValueOnce({ snapshotJson: riskySnapshot, publishedSnapshotJson: cleanSnapshot, publishedAt: new Date() });
    const result = await setPipeOfferStatus({ ...args, status: "sent" });
    expect(result.status).toBe("sent");
  });

  it("leaves non-send statuses ungated", async () => {
    mocks.quote.mockResolvedValue({ id: "quote", status: "draft", engagement: null });
    const result = await setPipeOfferStatus({ ...args, status: "archived" });
    expect(result.status).toBe("archived");
  });
});
