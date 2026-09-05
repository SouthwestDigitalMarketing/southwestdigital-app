import { beforeEach, describe, expect, it, vi } from "vitest";
import { hasPublicProposalAccess } from "./publicProposalAccess";

const mocks = vi.hoisted(() => ({ brand: vi.fn(), quote: vi.fn() }));
vi.mock("@/lib/prisma", () => ({ prisma: { quote: { findFirst: mocks.quote } } }));
vi.mock("@/lib/brands/resolve", () => ({ resolvePublicBrand: mocks.brand }));
const request = () => new Request("https://firm.example.test/api/proposal/engagement/sign", { headers: { "x-proposal-token": "public-token" } });
const quote = () => ({ id: "quote", status: "sent", expiresAt: null, engagement: { brandId: "brand", signedAt: null as Date | null } });

beforeEach(() => {
  vi.clearAllMocks();
  mocks.brand.mockResolvedValue({ id: "brand" });
  mocks.quote.mockResolvedValue(quote());
});

describe("public proposal capabilities", () => {
  it("scopes a published token to the resolved host brand and engagement", async () => {
    expect(await hasPublicProposalAccess(request(), "engagement")).toBe(true);
    expect(mocks.quote).toHaveBeenCalledWith(expect.objectContaining({ where: {
      brandId: "brand", engagementId: "engagement", publicToken: "public-token", publishedAt: { not: null },
    } }));
  });
  it("denies a missing token without querying business data", async () => {
    expect(await hasPublicProposalAccess(new Request("https://firm.example.test"), "engagement")).toBe(false);
    expect(mocks.quote).not.toHaveBeenCalled();
  });
  it("denies an inactive or unverified host", async () => {
    mocks.brand.mockResolvedValue(null);
    expect(await hasPublicProposalAccess(request(), "engagement")).toBe(false);
    expect(mocks.quote).not.toHaveBeenCalled();
  });
  it("denies a cross-brand engagement even with a matching token", async () => {
    mocks.quote.mockResolvedValue({ ...quote(), engagement: { brandId: "other-brand", signedAt: new Date() } });
    expect(await hasPublicProposalAccess(request(), "engagement", "agreement")).toBe(false);
  });
  it.each(["archived", "completed"])("blocks new checkout for %s quotes", async (status) => {
    mocks.quote.mockResolvedValue({ ...quote(), status });
    expect(await hasPublicProposalAccess(request(), "engagement")).toBe(false);
  });
  it("blocks expired checkout while preserving signed records and reconciliation", async () => {
    const expired = { ...quote(), expiresAt: new Date(0) };
    mocks.quote.mockResolvedValue(expired);
    expect(await hasPublicProposalAccess(request(), "engagement", "agreement")).toBe(false);
    expired.engagement.signedAt = new Date();
    expect(await hasPublicProposalAccess(request(), "engagement")).toBe(false);
    expect(await hasPublicProposalAccess(request(), "engagement", "agreement")).toBe(true);
    expect(await hasPublicProposalAccess(request(), "engagement", "reconcile")).toBe(true);
  });
});
