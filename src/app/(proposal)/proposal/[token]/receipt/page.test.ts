import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  headersGet: vi.fn(),
  resolvePublicBrand: vi.fn(),
  quoteFindFirst: vi.fn(),
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
vi.mock("@/lib/brands/resolve", () => ({ resolvePublicBrand: mocks.resolvePublicBrand }));
vi.mock("@/lib/prisma", () => ({
  prisma: { quote: { findFirst: mocks.quoteFindFirst } },
}));
vi.mock("@/app/(app)/offers/builder/AgreementTextView", () => ({
  default: () => null,
}));

import ProposalReceiptPage from "./page";

const brand = {
  id: "brand",
  slug: "firm",
  name: "Southwest",
  status: "ACTIVE",
  theme: { accentColor: "#d79b3b" },
  toolLinks: [],
};

function signedReceiptRow(overrides: Record<string, unknown> = {}) {
  return {
    id: "quote",
    status: "sent",
    expiresAt: null,
    offerCode: "OFF-1",
    client: { name: "Alex", company: "Example" },
    engagement: {
      brandId: "brand",
      clientName: "Alex",
      status: "SIGNED",
      onboardingFeeStatus: "PAID",
      onboardingData: {},
      agreementText: "Signed agreement",
      agreementTextHash: "hash",
      signerName: "Alex Example",
      signerTitle: "Owner",
      billingContactEmail: "alex@example.test",
      signedAt: new Date("2026-01-02T00:00:00Z"),
      agreementManagerStatus: "ACTIVE",
      isTestProposal: false,
    },
    ...overrides,
  };
}

async function openReceipt() {
  mocks.headersGet.mockReturnValue("firm.example.test");
  return ProposalReceiptPage({ params: Promise.resolve({ token: "token" }) });
}

beforeEach(() => {
  vi.resetAllMocks();
  mocks.headersGet.mockReturnValue("firm.example.test");
  mocks.resolvePublicBrand.mockResolvedValue(brand);
});

describe("public proposal receipt page", () => {
  it("receipt page notFound for a suspended brand", async () => {
    mocks.resolvePublicBrand.mockResolvedValue(null);
    await expect(openReceipt()).rejects.toThrow("NEXT_NOT_FOUND");
    expect(mocks.quoteFindFirst).not.toHaveBeenCalled();
  });

  it("receipt page notFound for a disabled domain", async () => {
    mocks.resolvePublicBrand.mockResolvedValue(null);
    await expect(openReceipt()).rejects.toThrow("NEXT_NOT_FOUND");
    expect(mocks.quoteFindFirst).not.toHaveBeenCalled();
  });

  it("receipt page renders an expired signed quote", async () => {
    mocks.quoteFindFirst.mockResolvedValue(signedReceiptRow({ expiresAt: new Date(0) }));
    const el = await openReceipt();
    expect(el).toBeTruthy();
  });

  it("receipt page notFound for a revoked token", async () => {
    mocks.quoteFindFirst.mockResolvedValue(null);
    await expect(openReceipt()).rejects.toThrow("NEXT_NOT_FOUND");
  });

  it("receipt page notFound when unsigned", async () => {
    mocks.quoteFindFirst.mockResolvedValue(signedReceiptRow({
      expiresAt: new Date(0),
      engagement: {
        brandId: "brand",
        signedAt: null,
        agreementText: null,
      },
    }));
    await expect(openReceipt()).rejects.toThrow("NEXT_NOT_FOUND");
  });
});
