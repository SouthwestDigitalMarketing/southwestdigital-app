import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  HOURLY_PUBLIC_PROP_KEYS,
  PRIVATE_SENTINEL,
  sentinelBookkeepingSnapshot,
  sentinelCatalogRows,
  sentinelHourlySnapshot,
} from "@/lib/quotes/publicProposalSentinel";

const mocks = vi.hoisted(() => ({
  headersGet: vi.fn(),
  auth: vi.fn(),
  resolvePublicBrand: vi.fn(),
  getBrandAccessDecision: vi.fn(),
  getSchemaCapabilities: vi.fn(),
  quoteFindFirst: vi.fn(),
  quoteUpdateMany: vi.fn(),
  quoteRevisionFindFirst: vi.fn(),
  brandDiscountFindMany: vi.fn(),
  engagementFindFirst: vi.fn(),
  catalogServiceFindMany: vi.fn(),
  ensureQuoteEngagement: vi.fn(),
}));

vi.mock("next/headers", () => ({
  headers: async () => ({ get: mocks.headersGet }),
}));
vi.mock("next/navigation", () => ({
  notFound: () => {
    throw new Error("NEXT_NOT_FOUND");
  },
  redirect: (url: string) => {
    throw new Error(`NEXT_REDIRECT:${url}`);
  },
}));
vi.mock("@/auth", () => ({ auth: mocks.auth }));
vi.mock("@/lib/brands/resolve", () => ({ resolvePublicBrand: mocks.resolvePublicBrand }));
vi.mock("@/lib/brands/repository", () => ({ getBrandAccessDecision: mocks.getBrandAccessDecision }));
vi.mock("@/lib/database/schemaCapabilities", () => ({ getSchemaCapabilities: mocks.getSchemaCapabilities }));
vi.mock("@/lib/engagements/fromOffer", () => ({ ensureQuoteEngagement: mocks.ensureQuoteEngagement }));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    quote: { findFirst: mocks.quoteFindFirst, updateMany: mocks.quoteUpdateMany },
    quoteRevision: { findFirst: mocks.quoteRevisionFindFirst },
    brandDiscount: { findMany: mocks.brandDiscountFindMany },
    engagement: { findFirst: mocks.engagementFindFirst },
    catalogService: { findMany: mocks.catalogServiceFindMany },
  },
}));

import PublicProposalPage from "./page";

const brand = {
  id: "brand",
  slug: "firm",
  name: "Southwest",
  status: "ACTIVE",
  theme: { accentColor: "#d79b3b" },
  toolLinks: [],
};

function quoteRow(snapshot: unknown) {
  return {
    id: "quote",
    publishedSnapshotJson: snapshot,
    publishedAt: new Date("2026-01-01T00:00:00Z"),
    firstViewedAt: new Date("2026-01-02T00:00:00Z"),
    firstSentAt: new Date("2026-01-01T00:00:00Z"),
    sentAt: new Date("2026-01-01T00:00:00Z"),
    lastSentAt: new Date("2026-01-01T00:00:00Z"),
    status: "sent",
    offerCode: "OFF-1",
    engagementId: "eng",
    expiresAt: null,
    engagement: { signedAt: null },
  };
}

async function renderPage(snapshot: unknown) {
  mocks.headersGet.mockReturnValue("firm.example.test");
  mocks.resolvePublicBrand.mockResolvedValue(brand);
  mocks.getSchemaCapabilities.mockResolvedValue({
    quoteRevisions: true,
    quoteEngagement: true,
    proposalCatalog: true,
    catalogProductKind: true,
    proposalPackageDefaults: true,
    agreementTemplates: true,
  });
  mocks.quoteFindFirst.mockResolvedValue(quoteRow(snapshot));
  mocks.quoteRevisionFindFirst.mockResolvedValue({ snapshotJson: snapshot });
  mocks.brandDiscountFindMany.mockResolvedValue([]);
  mocks.engagementFindFirst.mockResolvedValue({
    status: "active",
    isTestProposal: false,
    signedAt: null,
    onboardingData: {},
    agreementText: "Public hourly agreement",
  });
  mocks.catalogServiceFindMany.mockResolvedValue(sentinelCatalogRows);
  return PublicProposalPage({
    params: Promise.resolve({ token: "token" }),
    searchParams: Promise.resolve({}),
  });
}

beforeEach(() => {
  vi.resetAllMocks();
});

async function openOffer(search: { staffPreview?: string } = {}) {
  mocks.headersGet.mockReturnValue("firm.example.test");
  return PublicProposalPage({
    params: Promise.resolve({ token: "token" }),
    searchParams: Promise.resolve(search),
  });
}

describe("public proposal page lifecycle", () => {
  beforeEach(() => {
    mocks.auth.mockResolvedValue(null);
    mocks.getBrandAccessDecision.mockResolvedValue({ allowed: false });
  });

  it("public offer page notFound for a suspended brand", async () => {
    mocks.resolvePublicBrand.mockResolvedValue(null);
    await expect(openOffer()).rejects.toThrow("NEXT_NOT_FOUND");
    expect(mocks.quoteFindFirst).not.toHaveBeenCalled();
  });

  it("public offer page notFound for a disabled domain", async () => {
    mocks.resolvePublicBrand.mockResolvedValue(null);
    await expect(openOffer()).rejects.toThrow("NEXT_NOT_FOUND");
    expect(mocks.quoteFindFirst).not.toHaveBeenCalled();
  });

  it("public offer page notFound for an expired unsigned quote", async () => {
    mocks.resolvePublicBrand.mockResolvedValue(brand);
    mocks.quoteFindFirst.mockResolvedValue({
      ...quoteRow(sentinelBookkeepingSnapshot()),
      expiresAt: new Date(0),
      engagement: { brandId: "brand", signedAt: null },
    });
    await expect(openOffer()).rejects.toThrow("NEXT_NOT_FOUND");
  });

  it("public offer page redirects an expired signed quote to receipt", async () => {
    mocks.resolvePublicBrand.mockResolvedValue(brand);
    mocks.quoteFindFirst.mockResolvedValue({
      ...quoteRow(sentinelBookkeepingSnapshot()),
      expiresAt: new Date(0),
      engagement: { brandId: "brand", signedAt: new Date() },
    });
    await expect(openOffer()).rejects.toThrow("NEXT_REDIRECT:/proposal/token/receipt");
  });

  it("public offer page notFound for a revoked token", async () => {
    mocks.resolvePublicBrand.mockResolvedValue(brand);
    mocks.quoteFindFirst.mockResolvedValue(null);
    await expect(openOffer()).rejects.toThrow("NEXT_NOT_FOUND");
  });

  it("staff preview does not revive a revoked token or suspended brand", async () => {
    mocks.auth.mockResolvedValue({
      user: { id: "staff", status: "ACTIVE", platformRole: "MEMBER" },
    });
    mocks.getBrandAccessDecision.mockResolvedValue({ allowed: true });
    mocks.resolvePublicBrand.mockResolvedValue(null);
    await expect(openOffer({ staffPreview: "1" })).rejects.toThrow("NEXT_NOT_FOUND");

    mocks.resolvePublicBrand.mockResolvedValue(brand);
    mocks.quoteFindFirst.mockResolvedValue(null);
    await expect(openOffer({ staffPreview: "1" })).rejects.toThrow("NEXT_NOT_FOUND");
  });
});

describe("public proposal page RSC payload", () => {
  it("bookkeeping public page RSC props omit sentinel internals", async () => {
    const el = await renderPage(sentinelBookkeepingSnapshot()) as { props: Record<string, unknown> };
    expect(JSON.stringify(el.props)).not.toContain(PRIVATE_SENTINEL);
    expect(el.props.publicProposal).toEqual(expect.objectContaining({
      contactInfo: expect.objectContaining({
        primaryContact: expect.objectContaining({ email: "alex@example.test" }),
      }),
    }));
  });

  it("hourly public page RSC props omit sentinel internals", async () => {
    const el = await renderPage(sentinelHourlySnapshot()) as { props: Record<string, unknown> };
    expect(JSON.stringify(el.props)).not.toContain(PRIVATE_SENTINEL);
    expect(el.props.contact).toEqual({ name: "Alex Example", email: "alex@example.test" });
    expect(Object.keys(el.props).sort()).toEqual([...HOURLY_PUBLIC_PROP_KEYS].sort());
  });

  it("bookkeeping public page does not pass Partial assessment keys outside the DTO", async () => {
    const el = await renderPage(sentinelBookkeepingSnapshot()) as { props: Record<string, unknown> };
    expect(el.props.publicProposal).toBeDefined();
    expect(el.props).not.toHaveProperty("initialAssessment");
    expect(el.props).not.toHaveProperty("initialContactInfo");
    expect(el.props).not.toHaveProperty("publishedPricing");
    expect(el.props.live).toBe(true);
  });
});
