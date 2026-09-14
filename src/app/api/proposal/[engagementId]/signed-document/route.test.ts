import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  headersGet: vi.fn(),
  resolvePublicBrand: vi.fn(),
  quoteFindFirst: vi.fn(),
  pdf: vi.fn(),
}));

vi.mock("next/headers", () => ({
  headers: async () => ({ get: mocks.headersGet }),
}));
vi.mock("@/lib/brands/resolve", () => ({ resolvePublicBrand: mocks.resolvePublicBrand }));
vi.mock("@/lib/prisma", () => ({
  prisma: { quote: { findFirst: mocks.quoteFindFirst } },
}));
vi.mock("@/lib/agreements/signedPdf", () => ({
  createSignedProposalPdf: mocks.pdf,
}));

import { GET } from "./route";

const brand = { id: "brand", name: "Southwest", slug: "firm", status: "ACTIVE", theme: null, toolLinks: [] };

function signedRow(overrides: Record<string, unknown> = {}) {
  return {
    id: "quote",
    status: "sent",
    expiresAt: null,
    offerCode: "OFF-1",
    engagement: {
      brandId: "brand",
      signedAt: new Date(),
      agreementText: "Agreement",
      signerName: "Alex",
      clientName: "Alex",
      onboardingData: {},
      agreementTextHash: "hash",
      signerTitle: "Owner",
      billingContactEmail: "alex@example.test",
      signerIpAddress: null,
      signerUserAgent: null,
    },
    ...overrides,
  };
}

const call = () => GET(new Request("https://firm.example.test/api/proposal/token/signed-document"), {
  params: Promise.resolve({ engagementId: "token" }),
});

beforeEach(() => {
  vi.resetAllMocks();
  mocks.headersGet.mockReturnValue("firm.example.test");
  mocks.resolvePublicBrand.mockResolvedValue(brand);
  mocks.pdf.mockResolvedValue(new Uint8Array([1, 2, 3]));
});

describe("signed proposal PDF gate", () => {
  it("returns 404 for a suspended brand without generating a PDF", async () => {
    mocks.resolvePublicBrand.mockResolvedValue(null);
    expect((await call()).status).toBe(404);
    expect(mocks.pdf).not.toHaveBeenCalled();
  });

  it("returns 404 for a disabled domain without generating a PDF", async () => {
    mocks.resolvePublicBrand.mockResolvedValue(null);
    expect((await call()).status).toBe(404);
    expect(mocks.pdf).not.toHaveBeenCalled();
  });

  it("allows an expired signed quote through receipt access", async () => {
    mocks.quoteFindFirst.mockResolvedValue(signedRow({ expiresAt: new Date(0) }));
    expect((await call()).status).toBe(200);
    expect(mocks.pdf).toHaveBeenCalled();
  });

  it("returns 404 for a revoked token without generating a PDF", async () => {
    mocks.quoteFindFirst.mockResolvedValue(null);
    expect((await call()).status).toBe(404);
    expect(mocks.pdf).not.toHaveBeenCalled();
  });

  it("returns 404 when unsigned without generating a PDF", async () => {
    mocks.quoteFindFirst.mockResolvedValue(signedRow({
      engagement: { brandId: "brand", signedAt: null, agreementText: "Agreement", signerName: "Alex" },
    }));
    expect((await call()).status).toBe(404);
    expect(mocks.pdf).not.toHaveBeenCalled();
  });
});
