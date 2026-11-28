import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  PRIVATE_SENTINEL,
  sentinelBookkeepingSnapshot,
  sentinelCatalogRows,
} from "@/lib/quotes/publicProposalSentinel";

const mocks = vi.hoisted(() => ({
  access: vi.fn(),
  engagement: vi.fn(),
  update: vi.fn(),
  txQuote: vi.fn(),
  catalog: vi.fn(),
  capabilities: vi.fn(),
  waiver: vi.fn(),
  lock: vi.fn(),
}));

vi.mock("@/lib/engagements/publicProposalAccess", () => ({
  hasPublicProposalAccess: mocks.access,
  publicProposalNotFound: () => Response.json({}, { status: 404 }),
}));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    engagement: { findUnique: mocks.engagement, updateMany: mocks.update },
    catalogService: { findMany: mocks.catalog },
    $transaction: (fn: (tx: unknown) => unknown) => fn({
      quote: { findFirst: mocks.txQuote },
      engagement: { updateMany: mocks.update },
    }),
  },
}));
vi.mock("@/lib/quotes/mutationLock", () => ({
  lockQuoteMutation: mocks.lock,
  QuoteMutationConflictError: class extends Error {},
}));
vi.mock("@/lib/database/schemaCapabilities", () => ({
  getSchemaCapabilities: mocks.capabilities,
}));
vi.mock("@/lib/discounts/resolveOnboardingWaiver", () => ({
  resolveOnboardingWaiverForEngagement: mocks.waiver,
}));

import { POST } from "./route";

function engagementRow() {
  return {
    onboardingData: {},
    updatedAt: new Date("2026-01-01T00:00:00Z"),
    brandId: "brand",
    onboardingFeeStatus: "REQUIRED",
    signedAt: null,
    agreementManagerStatus: "ACTIVE",
    quotes: [{
      publishedSnapshotJson: sentinelBookkeepingSnapshot(),
      revisions: [{ snapshotJson: sentinelBookkeepingSnapshot() }],
    }],
  };
}

const call = () => POST(
  new Request("https://firm.example.test/api/proposal/eng/select", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-proposal-token": "token",
      "x-hostname": "firm.example.test",
    },
    body: JSON.stringify({
      tier: "improve",
      hasTwelveMonthAgreement: false,
      selectedCleanupPeriodKeys: [],
      selectedAdditionalOptionIds: ["reports"],
    }),
  }),
  { params: Promise.resolve({ engagementId: "eng" }) },
);

beforeEach(() => {
  vi.resetAllMocks();
  mocks.access.mockResolvedValue(true);
  mocks.engagement.mockResolvedValue(engagementRow());
  mocks.txQuote.mockResolvedValue({ id: "quote" });
  mocks.lock.mockResolvedValue({ id: "quote" });
  mocks.update.mockResolvedValue({ count: 1 });
  mocks.catalog.mockResolvedValue(sentinelCatalogRows);
  mocks.capabilities.mockResolvedValue({
    proposalCatalog: true,
    catalogProductKind: true,
  });
  mocks.waiver.mockResolvedValue(false);
});

describe("public proposal select API", () => {
  it("refuses a frozen signed selection without writing", async () => {
    mocks.engagement.mockResolvedValue({ ...engagementRow(), status: "SIGNED", signedAt: new Date() });
    const response = await call();
    expect(response.status).toBe(409);
    expect(await response.json()).toEqual(expect.objectContaining({ error: expect.stringContaining("cannot be changed") }));
    expect(mocks.update).not.toHaveBeenCalled();
  });
  it("POST select checkout omits assessment notes and catalog internalDescription", async () => {
    const response = await call();
    expect(response.status).toBe(200);
    const body = await response.json() as { ok?: boolean; checkout?: Record<string, unknown> };
    expect(JSON.stringify(body)).not.toContain(PRIVATE_SENTINEL);
    expect(body.ok).toBe(true);
    expect(body.checkout).toEqual(expect.objectContaining({
      tier: "improve",
      selectedAdditionalOptionIds: ["reports"],
    }));
    const included = body.checkout?.includedServices as Array<{ name: string; description: string }> | undefined;
    expect(included?.some((item) => item.description.includes(PRIVATE_SENTINEL))).toBeFalsy();
    expect(included).toEqual(
      expect.arrayContaining([expect.objectContaining({ name: "Portal", description: "" })]),
    );
  });
});

describe("select API with a company bundle", () => {
  const bundleCompanies = [
    { id: "main", name: "Main Co", ownQboFile: true, fileStatus: "existing", locationsCount: 0, propertiesCount: 0, accounts: [] },
    { id: "b", name: "B Co", ownQboFile: true, fileStatus: "new_file", locationsCount: 0, propertiesCount: 0, accounts: [] },
  ];

  function bundleEngagementRow() {
    return {
      ...engagementRow(),
      quotes: [{
        // Bundle monthlies baked by the P1 snapshot wiring (empty files, defaults).
        publishedSnapshotJson: null,
        revisions: [{
          snapshotJson: {
            assessment: {
              annualSavingsPercent: 20,
              historicalCleanupPeriods: [],
              additionalOptions: [],
              companies: bundleCompanies,
            },
            pricing: {
              maintain: { monthly: 450 },
              improve: { monthly: 450 },
              grow: { monthly: 675 },
            },
          },
        }],
      }],
    };
  }

  function selectTier(tier: string) {
    return POST(
      new Request("https://firm.example.test/api/proposal/eng/select", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-proposal-token": "token",
          "x-hostname": "firm.example.test",
        },
        body: JSON.stringify({
          tier,
          hasTwelveMonthAgreement: false,
          selectedCleanupPeriodKeys: [],
          selectedAdditionalOptionIds: [],
        }),
      }),
      { params: Promise.resolve({ engagementId: "eng" }) },
    );
  }

  it("charges the published bundle monthly with setup due today", async () => {
    mocks.engagement.mockResolvedValue(bundleEngagementRow());
    const response = await selectTier("maintain");
    expect(response.status).toBe(200);
    const body = await response.json() as { ok?: boolean; checkout?: Record<string, number> };
    expect(body.checkout?.baseMonthlyTotal).toBe(450);
    expect(body.checkout?.recurringMonthlyTotal).toBe(450);
    expect(body.checkout?.additionalOneTimeTotal).toBe(150);
    expect(body.checkout?.onboardingFee).toBe(500);
    expect(body.checkout?.amountDueNow).toBe(1100);
  });

  it("reads the selected tier from the snapshot bundle object", async () => {
    const { buildCompanyBundleSnapshot, DEFAULT_BUNDLE_PRICING_OPTIONS } =
      await import("@/lib/quotes/companyBundle");
    const stored = {
      annualSavingsPercent: 20,
      historicalCleanupPeriods: [],
      additionalOptions: [],
      companies: bundleCompanies,
    };
    const companyBundle = buildCompanyBundleSnapshot({
      companies: bundleCompanies,
      baseAssessment: stored,
      options: DEFAULT_BUNDLE_PRICING_OPTIONS,
    });
    mocks.engagement.mockResolvedValue({
      ...engagementRow(),
      quotes: [{
        publishedSnapshotJson: null,
        revisions: [{
          snapshotJson: {
            assessment: stored,
            pricing: {
              maintain: { monthly: 450 },
              improve: { monthly: 450 },
              grow: { monthly: 675 },
              companyBundle,
            },
          },
        }],
      }],
    });
    const response = await selectTier("grow");
    expect(response.status).toBe(200);
    const body = await response.json() as { ok?: boolean; checkout?: Record<string, number> };
    expect(body.checkout?.baseMonthlyTotal).toBe(675);
    expect(body.checkout?.additionalOneTimeTotal).toBe(150);
    expect(body.checkout?.amountDueNow).toBe(500 + 150 + 675);
  });

  it("leaves a legacy selection identical (no setup, published monthly)", async () => {
    const response = await selectTier("maintain");
    expect(response.status).toBe(200);
    // The default engagement row is the legacy sentinel snapshot (no bundle).
    const body = await response.json() as { ok?: boolean; checkout?: Record<string, number> };
    expect(body.checkout?.additionalOneTimeTotal).toBe(0);
  });
});
