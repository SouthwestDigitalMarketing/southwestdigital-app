import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  findPublishedPublicQuote,
  hasPublicProposalAccess,
  quoteAllowsPublicCapability,
  type PublicProposalCapability,
  type PublicProposalQuote,
} from "./publicProposalAccess";

const mocks = vi.hoisted(() => ({ brand: vi.fn(), quote: vi.fn() }));
vi.mock("@/lib/prisma", () => ({ prisma: { quote: { findFirst: mocks.quote } } }));
vi.mock("@/lib/brands/resolve", () => ({ resolvePublicBrand: mocks.brand }));

const ALL: readonly PublicProposalCapability[] = ["read", "select", "sign", "pay", "receipt"];

const request = () => new Request("https://firm.example.test/api/proposal/engagement/sign", {
  headers: { "x-proposal-token": "public-token" },
});

function quote(overrides: Partial<PublicProposalQuote> = {}): PublicProposalQuote {
  return {
    id: "quote",
    status: "sent",
    expiresAt: null,
    engagement: { brandId: "brand", signedAt: null },
    ...overrides,
  };
}

function allowed(row: PublicProposalQuote) {
  return Object.fromEntries(ALL.map((capability) => [capability, quoteAllowsPublicCapability(row, capability)]));
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.brand.mockResolvedValue({ id: "brand" });
  mocks.quote.mockResolvedValue(quote());
});

describe("public proposal capabilities", () => {
  it("scopes a published token to the resolved host brand and engagement", async () => {
    expect(await hasPublicProposalAccess(request(), "engagement", "read")).toBe(true);
    expect(mocks.quote).toHaveBeenCalledWith(expect.objectContaining({
      where: {
        brandId: "brand",
        engagementId: "engagement",
        publicToken: "public-token",
        publishedAt: { not: null },
      },
    }));
  });

  it("denies a missing token without querying business data", async () => {
    expect(await hasPublicProposalAccess(new Request("https://firm.example.test"), "engagement", "read")).toBe(false);
    expect(mocks.brand).not.toHaveBeenCalled();
    expect(mocks.quote).not.toHaveBeenCalled();
  });

  it("denies an inactive or unverified host", async () => {
    mocks.brand.mockResolvedValue(null);
    expect(await hasPublicProposalAccess(request(), "engagement", "read")).toBe(false);
    expect(mocks.quote).not.toHaveBeenCalled();
  });

  it("denies a suspended brand", async () => {
    mocks.brand.mockResolvedValue(null);
    expect(await hasPublicProposalAccess(request(), "engagement", "read")).toBe(false);
    expect(await hasPublicProposalAccess(request(), "engagement", "receipt")).toBe(false);
    expect(mocks.quote).not.toHaveBeenCalled();
  });

  it("denies a disabled domain", async () => {
    mocks.brand.mockResolvedValue(null);
    expect(await hasPublicProposalAccess(request(), "engagement", "read")).toBe(false);
    expect(await hasPublicProposalAccess(request(), "engagement", "receipt")).toBe(false);
    expect(mocks.quote).not.toHaveBeenCalled();
  });

  it("denies a cross-brand engagement even with a matching token", async () => {
    mocks.quote.mockResolvedValue(quote({ engagement: { brandId: "other-brand", signedAt: new Date() } }));
    expect(await hasPublicProposalAccess(request(), "engagement", "read")).toBe(false);
    expect(await hasPublicProposalAccess(request(), "engagement", "receipt")).toBe(false);
  });

  it("denies an expired quote for read, select, sign, and pay", async () => {
    const expired = quote({ expiresAt: new Date(0) });
    mocks.quote.mockResolvedValue(expired);
    expect(await hasPublicProposalAccess(request(), "engagement", "read")).toBe(false);
    expect(await hasPublicProposalAccess(request(), "engagement", "select")).toBe(false);
    expect(await hasPublicProposalAccess(request(), "engagement", "sign")).toBe(false);
    expect(await hasPublicProposalAccess(request(), "engagement", "pay")).toBe(false);
  });

  it("allows receipt for an expired signed quote", async () => {
    mocks.quote.mockResolvedValue(quote({
      expiresAt: new Date(0),
      engagement: { brandId: "brand", signedAt: new Date() },
    }));
    expect(await hasPublicProposalAccess(request(), "engagement", "receipt")).toBe(true);
  });

  it("denies a revoked token", async () => {
    mocks.quote.mockResolvedValue(null);
    expect(await hasPublicProposalAccess(request(), "engagement", "read")).toBe(false);
    expect(await hasPublicProposalAccess(request(), "engagement", "receipt")).toBe(false);
  });

  it("allows read/select/sign on a live unsigned published quote and denies pay and receipt", () => {
    expect(allowed(quote())).toEqual({
      read: true,
      select: true,
      sign: true,
      pay: false,
      receipt: false,
    });
  });

  it("allows read/sign/pay/receipt on a live signed quote and denies select", () => {
    expect(allowed(quote({ engagement: { brandId: "brand", signedAt: new Date() } }))).toEqual({
      read: true,
      select: false,
      sign: true,
      pay: true,
      receipt: true,
    });
  });

  it("denies pay on an expired signed quote", () => {
    expect(quoteAllowsPublicCapability(
      quote({
        expiresAt: new Date(0),
        engagement: { brandId: "brand", signedAt: new Date() },
      }),
      "pay",
    )).toBe(false);
  });

  it("allows receipt and denies read/select/sign/pay when a signed quote is archived", () => {
    expect(allowed(quote({
      status: "archived",
      engagement: { brandId: "brand", signedAt: new Date() },
    }))).toEqual({
      read: false,
      select: false,
      sign: false,
      pay: false,
      receipt: true,
    });
  });

  it("denies receipt after the public token is revoked", async () => {
    mocks.quote.mockResolvedValue(null);
    expect(await hasPublicProposalAccess(request(), "engagement", "receipt")).toBe(false);
  });

  it("treats rejected as withdrawn for live capabilities while receipt still works when signed", () => {
    expect(allowed(quote({
      status: "rejected",
      engagement: { brandId: "brand", signedAt: new Date() },
    }))).toEqual({
      read: false,
      select: false,
      sign: false,
      pay: false,
      receipt: true,
    });
  });

  it("allows GET agreement via read or receipt", async () => {
    mocks.quote.mockResolvedValue(quote({
      expiresAt: new Date(0),
      engagement: { brandId: "brand", signedAt: new Date() },
    }));
    expect(await hasPublicProposalAccess(request(), "engagement", ["read", "receipt"])).toBe(true);
    mocks.quote.mockResolvedValue(quote({ expiresAt: new Date(0) }));
    expect(await hasPublicProposalAccess(request(), "engagement", ["read", "receipt"])).toBe(false);
  });

  it("findPublishedPublicQuote skips the quote query when the host brand is missing", async () => {
    mocks.brand.mockResolvedValue(null);
    expect(await findPublishedPublicQuote({ hostname: "firm.example.test", token: "public-token" })).toBeNull();
    expect(mocks.quote).not.toHaveBeenCalled();
  });
});
