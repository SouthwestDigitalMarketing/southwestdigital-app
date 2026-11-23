import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/analytics/ga4", () => ({
  hasGA4Credentials: () => true,
  getTrafficTrend: vi.fn(async (propertyId: string) =>
    propertyId === "501531577" ? [{ sessions: 140 }, { sessions: 0 }] : [{ sessions: 17 }],
  ),
}));
vi.mock("@/lib/companyMetrics", () => ({ COMPANY_BRANDS: ["bookkeeping-conroe", "real-estate-bookkeeper"] }));

const { computeInternalChanges } = await import("./internal");
import type { PrismaClient } from "@prisma/client";
const asDb = (fake: unknown) => fake as unknown as PrismaClient;

const db = (overrides: Record<string, unknown> = {}) => ({
  proposalViewEvent: { findMany: vi.fn(async () => []) },
  quote: { findMany: vi.fn(async () => []) },
  engagement: { findMany: vi.fn(async () => []) },
  brand: { findMany: vi.fn(async () => []) },
  ...overrides,
});

describe("computeInternalChanges", () => {
  beforeEach(() => vi.clearAllMocks());
  it("names viewed, accepted, signed and paid items", async () => {
    const fake = db({
      brand: {
        findMany: vi.fn(async () => [
          { slug: "bookkeeping-conroe", theme: { ga4PropertyId: "501531577" } },
          { slug: "real-estate-bookkeeper", theme: { ga4PropertyId: "543546215" } },
        ]),
      },
      proposalViewEvent: {
        findMany: vi.fn(async () => [
          { occurredAt: new Date(), quote: { client: { name: "Acme" }, brandId: "b" } },
          { occurredAt: new Date(), quote: { client: { name: "Acme" }, brandId: "b" } },
        ]),
      },
      quote: {
        findMany: vi.fn(async () => [{ status: "accepted", updatedAt: new Date(), client: { name: "Acme" } }]),
      },
      engagement: {
        findMany: vi
          .fn()
          .mockResolvedValueOnce([{ status: "SIGNED", updatedAt: new Date(), clientName: "SJ Equity" }])
          .mockResolvedValue([{ status: "DEPOSIT_PAID", updatedAt: new Date(), clientName: "Rodan" }]),
      },
    });
    const result = await computeInternalChanges(asDb(fake), new Date());
    expect(result.changes.map((change) => change.text)).toEqual([
      "2 proposal views (Acme)",
      "Acme: proposal accepted",
      "SJ Equity: GSA signed",
      "Rodan: first month paid",
      "Traffic refreshed: 157 sessions last 30d",
    ]);
    expect(result.ga4).toEqual({ bkc: 140, treb: 17, combined: 157 });
  });
  it("reports zero traffic when no brand has a GA4 property", async () => {
    const result = await computeInternalChanges(asDb(db()), null);
    expect(result.changes).toEqual([{ kind: "ga4", text: "Traffic refreshed: 0 sessions last 30d" }]);
    expect(result.ga4).toEqual({ bkc: 0, treb: 0, combined: 0 });
  });
});
