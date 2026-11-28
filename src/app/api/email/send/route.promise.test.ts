import { beforeEach, describe, expect, it, vi } from "vitest";
import { isQuoteFrozen } from "@/lib/quotes/isQuoteFrozen";
const mocks = vi.hoisted(() => ({ quote: vi.fn(), update: vi.fn(), send: vi.fn(), lock: vi.fn() }));
vi.mock("@/lib/brands/staff", () => ({ requireStaffBrandOrThrow: async () => ({ brand: { id: "brand" }, membership: { id: "member" } }) }));
vi.mock("@/lib/prisma", () => ({ prisma: { $transaction: (fn: (tx: unknown) => unknown) => fn({ quote: { findFirst: mocks.quote, update: mocks.update } }) } }));
vi.mock("@/lib/emailConnections/send", () => ({ sendFromMembership: mocks.send, EmailConnectionMissingError: class extends Error {}, EmailConnectionRegionInvalidError: class extends Error {} }));
vi.mock("@/lib/quotes/mutationLock", () => ({ lockQuoteMutation: mocks.lock, QuoteMutationConflictError: class extends Error {} }));
import { POST } from "./route";
import { hashPromiseText } from "@/lib/quotes/promiseCheck";

const call = (bodyText: string) => POST(new Request("https://example.test/api/email/send", {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({ to: "client@example.test", subject: "Offer", bodyText, offerId: "quote" }),
}));

beforeEach(() => {
  vi.clearAllMocks();
  mocks.send.mockResolvedValue({ fromAddress: "staff@example.test", provider: "zoho" });
  // The route trusts the lock's rechecked row: mirror the real guard.
  mocks.lock.mockImplementation(async () => {
    const row = await mocks.quote();
    if (!row) throw new Error("Offer not found.");
    if (isQuoteFrozen(row)) throw new Error("Accepted, signed or paid offers are frozen.");
    return row;
  });
});

describe("proposal email promise block", () => {
  it("refuses a 24/7 cover body before delivery", async () => {
    mocks.quote.mockResolvedValue({
      id: "quote",
      status: "sent",
      snapshotJson: { assessment: { introBody: "Clean books." } },
    });
    const response = await call("Hi there, call us 24/7 for bookkeeping help: https://example.test/p/abc");
    expect(response.status).toBe(409);
    expect(await response.json()).toMatchObject({ error: expect.stringContaining("finalize") });
    expect(mocks.send).not.toHaveBeenCalled();
  });

  it("refuses flagged snapshot text even with a clean body", async () => {
    mocks.quote.mockResolvedValue({
      id: "quote",
      status: "sent",
      snapshotJson: { assessment: { introBody: "We guarantee results." } },
    });
    const response = await call("Proposal follow-up");
    expect(response.status).toBe(409);
    expect(mocks.send).not.toHaveBeenCalled();
  });

  it("scans the published snapshot, not just the cleaned draft", async () => {
    mocks.quote.mockResolvedValue({
      id: "quote",
      status: "sent",
      snapshotJson: { assessment: { introBody: "Clean books." } },
      publishedSnapshotJson: { assessment: { introBody: "We guarantee results." } },
    });
    const response = await call("Proposal follow-up");
    expect(response.status).toBe(409);
    expect(mocks.send).not.toHaveBeenCalled();
  });

  it("sends a cleaned republish even when the draft is still flagged", async () => {
    mocks.quote.mockResolvedValue({
      id: "quote",
      status: "sent",
      firstSentAt: new Date(),
      snapshotJson: { assessment: { introBody: "We guarantee results." } },
      publishedSnapshotJson: { assessment: { introBody: "Clean books." } },
    });
    const response = await call("Proposal follow-up");
    expect(response.status).toBe(200);
    expect(mocks.send).toHaveBeenCalledOnce();
  });

  it("sends when the flagged body is confirmed", async () => {
    const bodyText = "Hi there, call us 24/7 for help.";
    const { normalizeCoverTextForScan } = await import("@/app/(app)/offers/builder/coverLetterState");
    const normalized = normalizeCoverTextForScan(`Offer\n\n${bodyText}`);
    mocks.quote.mockResolvedValue({
      id: "quote",
      status: "sent",
      firstSentAt: new Date(),
      snapshotJson: {
        assessment: { introBody: "Clean books." },
        promiseConfirmations: [
          { where: "Cover email", phrase: "24/7", textHash: hashPromiseText(normalized), confirmedAt: "2026-11-27T00:00:00Z" },
        ],
      },
    });
    const response = await call(bodyText);
    expect(response.status).toBe(200);
    expect(mocks.send).toHaveBeenCalledOnce();
  });
});
