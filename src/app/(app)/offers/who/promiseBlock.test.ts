import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({
  staff: vi.fn(),
  quote: vi.fn(),
  transaction: vi.fn(),
  catalog: vi.fn(),
  agreement: vi.fn(),
  brandDiscounts: vi.fn(),
  quoteUpdate: vi.fn(),
}));
vi.mock("@/lib/quotes/access", () => ({ requireQuoteStaffOrThrow: mocks.staff }));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    quote: { findFirst: mocks.quote },
    brandDiscount: { findMany: mocks.brandDiscounts },
    $transaction: mocks.transaction,
  },
}));
vi.mock("@/lib/tenancy/context", () => ({ withBrandDataTransaction: (_ctx: unknown, fn: (tx: unknown) => unknown) => fn({}) }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/navigation", () => ({ redirect: vi.fn() }));
vi.mock("@/lib/quotes/materializeProposalCatalog", () => ({ materializeProposalCatalog: mocks.catalog }));
vi.mock("@/lib/agreements/materialize", () => ({ materializeAgreementTemplate: mocks.agreement }));
vi.mock("@/lib/quotes/mutationLock", () => ({ lockQuoteMutation: vi.fn() }));
vi.mock("@/lib/database/schemaCapabilities", () => ({ getSchemaCapabilities: async () => ({ quoteRevisions: false, quoteEngagement: false }) }));
vi.mock("@/lib/engagements/fromOffer", () => ({ ensureQuoteEngagement: vi.fn() }));
vi.mock("@/lib/quotes/supersedeReplaced", () => ({ supersedeReplacedQuoteOnWrite: vi.fn() }));
import { publishOfferChangesAction } from "./actions";

const draftQuote = (snapshotJson: unknown) => ({
  id: "quote",
  kind: "bookkeeping",
  status: "draft",
  engagement: null,
  snapshotJson,
  publicToken: null,
  clientId: "client",
  client: { name: "Client", email: "c@x.test", company: "Co" },
});

beforeEach(() => {
  vi.clearAllMocks();
  mocks.staff.mockResolvedValue({ brand: { id: "brand" }, dataContext: {} });
  mocks.catalog.mockImplementation(async (_brandId: unknown, assessment: unknown) => assessment);
  mocks.agreement.mockImplementation(async (_brandId: unknown, assessment: unknown) => assessment);
  mocks.brandDiscounts.mockResolvedValue([]);
  mocks.transaction.mockImplementation(async (fn: (tx: unknown) => unknown) => fn({
    quote: { count: async () => 1, update: mocks.quoteUpdate },
    quoteClient: { update: async () => ({}) },
  }));
});

describe("publish promise block", () => {
  it("refuses a publish while flagged wording is unconfirmed, before any write", async () => {
    mocks.quote.mockResolvedValue(draftQuote({ assessment: { introBody: "We guarantee same-day results, 24/7." } }));
    await expect(publishOfferChangesAction("quote", {})).rejects.toThrow(/finalize/);
    expect(mocks.transaction).not.toHaveBeenCalled();
  });

  it("stamps the frozen support copy on a clean publish", async () => {
    mocks.quote.mockResolvedValue(draftQuote({ assessment: { introBody: "Clean books, clear answers." } }));
    const result = await publishOfferChangesAction("quote", {});
    expect(result.publicPath).toMatch(/^\/proposal\//);
    const written = mocks.quoteUpdate.mock.calls[0][0].data;
    expect(written.publishedSnapshotJson.supportCopy.version).toBe(2);
    expect(written.publishedSnapshotJson.supportCopy.levels["Concierge Client Support"].meaning).toContain("2 business hours");
  });

  it("publishes when every hit is confirmed", async () => {
    const introBody = "We guarantee same-day results.";
    const { hashPromiseText } = await import("@/lib/quotes/promiseCheck");
    const textHash = hashPromiseText(introBody);
    mocks.quote.mockResolvedValue(draftQuote({
      assessment: { introBody },
      promiseConfirmations: [
        { where: "Intro body", phrase: "guarantee", textHash, confirmedAt: "2026-11-27T00:00:00Z" },
        { where: "Intro body", phrase: "same day", textHash, confirmedAt: "2026-11-27T00:00:00Z" },
      ],
    }));
    const result = await publishOfferChangesAction("quote", {});
    expect(result.publicPath).toMatch(/^\/proposal\//);
  });
});
