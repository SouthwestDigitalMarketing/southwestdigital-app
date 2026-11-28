import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({
  staff: vi.fn(),
  quote: vi.fn(),
  contact: vi.fn(),
  transaction: vi.fn(),
  quoteClientCreate: vi.fn(),
  quoteUpdate: vi.fn(),
}));
vi.mock("@/lib/quotes/access", () => ({ requireQuoteStaffOrThrow: mocks.staff }));
vi.mock("@/lib/prisma", () => ({
  prisma: { quote: { findFirst: mocks.quote }, $transaction: mocks.transaction },
}));
vi.mock("@/lib/tenancy/context", () => ({
  withBrandDataTransaction: (_ctx: unknown, fn: (tx: unknown) => unknown) =>
    fn({ contact: { findFirst: mocks.contact } }),
}));
vi.mock("@/lib/database/schemaCapabilities", () => ({
  getSchemaCapabilities: async () => ({ quoteRevisions: false, quoteEngagement: false }),
}));
vi.mock("@/lib/quotes/mutationLock", () => ({ lockQuoteMutation: vi.fn() }));
vi.mock("@/lib/quotes/supersedeReplaced", () => ({ supersedeReplacedQuoteOnWrite: vi.fn() }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
import { reassignQuoteContactAction } from "./actions";

const form = () => {
  const data = new FormData();
  data.set("id", "quote");
  data.set("contactId", "contact");
  return data;
};

const riskySnapshot = { assessment: { introBody: "We guarantee same-day results." } };
const cleanSnapshot = { assessment: { introBody: "Clean books, clear answers." } };

const quoteRow = (snapshot: unknown, publishedAt: Date | null) => ({
  id: "quote",
  status: "draft",
  engagement: null,
  clientId: "client",
  engagementId: null,
  snapshotJson: snapshot,
  publishedAt,
  publicToken: publishedAt ? "token" : null,
  client: { name: "Client", email: "c@x.test", company: "Co" },
});

beforeEach(() => {
  vi.clearAllMocks();
  mocks.staff.mockResolvedValue({ brand: { id: "brand" }, dataContext: {} });
  mocks.contact.mockResolvedValue({
    id: "contact",
    name: "New Contact",
    firstName: "New",
    lastName: "Contact",
    email: "new@x.test",
    phoneE164: null,
    phoneNumber: null,
    company: "Co",
    roleTitle: null,
  });
  mocks.quoteClientCreate.mockResolvedValue({ id: "client-2" });
  mocks.quoteUpdate.mockResolvedValue({});
  mocks.transaction.mockImplementation(async (fn: (tx: unknown) => unknown) => fn({
    quote: { update: mocks.quoteUpdate },
    quoteClient: { create: mocks.quoteClientCreate },
  }));
});

describe("reassign promise block", () => {
  it("refuses a republish while flagged wording is unconfirmed, before any write", async () => {
    mocks.quote.mockResolvedValue(quoteRow(riskySnapshot, new Date()));
    await expect(reassignQuoteContactAction(form())).rejects.toThrow(/finalize/);
    expect(mocks.transaction).not.toHaveBeenCalled();
  });

  it("republishes a clean snapshot without complaint", async () => {
    mocks.quote.mockResolvedValue(quoteRow(cleanSnapshot, new Date()));
    await reassignQuoteContactAction(form());
    expect(mocks.transaction).toHaveBeenCalled();
  });

  it("leaves a draft-only reassign ungated", async () => {
    mocks.quote.mockResolvedValue(quoteRow(riskySnapshot, null));
    await reassignQuoteContactAction(form());
    expect(mocks.transaction).toHaveBeenCalled();
  });
});
