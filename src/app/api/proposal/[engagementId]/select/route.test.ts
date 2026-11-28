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
  it("treats a bare status marker as frozen even with no other acceptance signal", async () => {
    // Only engagement.status marks this row: no signedAt, no PAID, no
    // proposalAcceptance. The route select must fetch status for the freeze
    // check to see it in production (not just through this mock).
    mocks.engagement.mockResolvedValue({ ...engagementRow(), status: "accepted" });
    const response = await call();
    expect(response.status).toBe(409);
    expect(await response.json()).toEqual(expect.objectContaining({ error: expect.stringContaining("cannot be changed") }));
    expect(mocks.update).not.toHaveBeenCalled();
    expect(mocks.engagement).toHaveBeenCalledWith(expect.objectContaining({
      select: expect.objectContaining({
        status: true, signedAt: true, onboardingFeeStatus: true, onboardingData: true,
      }),
    }));
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

describe("select API with a complexity cleanup weight", () => {
  const complexitySnapshot = (complexity?: { cleanupPerMonthTotal: number }) => ({
    assessment: {
      annualSavingsPercent: 20,
      historicalCleanupPeriods: [{ id: "p1", year: 2026, startMonth: 1, endMonth: 3 }],
      additionalOptions: [],
    },
    pricing: {
      maintain: complexity
        ? { monthly: 300, complexity: { lines: [], monthlyTotal: 0, ...complexity, cleanupTotal: 325 } }
        : { monthly: 300 },
      improve: { monthly: 450 },
      grow: { monthly: 675 },
    },
  });

  function complexityEngagementRow(complexity?: { cleanupPerMonthTotal: number }) {
    return {
      ...engagementRow(),
      quotes: [{
        publishedSnapshotJson: null,
        revisions: [{ snapshotJson: complexitySnapshot(complexity) }],
      }],
    };
  }

  function selectMaintain(body: Record<string, unknown>) {
    return POST(
      new Request("https://firm.example.test/api/proposal/eng/select", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-proposal-token": "token",
          "x-hostname": "firm.example.test",
        },
        body: JSON.stringify({
          tier: "maintain",
          hasTwelveMonthAgreement: false,
          selectedCleanupPeriodKeys: ["2026-1-3"],
          selectedAdditionalOptionIds: [],
          ...body,
        }),
      }),
      { params: Promise.resolve({ engagementId: "eng" }) },
    );
  }

  it("stores the snapshot complexity cleanup add for cleanup months (real checkout build)", async () => {
    mocks.engagement.mockResolvedValue(complexityEngagementRow({ cleanupPerMonthTotal: 65 }));
    const response = await selectMaintain({});
    expect(response.status).toBe(200);
    const body = await response.json() as { ok?: boolean; checkout?: Record<string, unknown> };
    // 3 selected months: base 3 x 300 plus the 3 x 65 complexity weight.
    expect(body.checkout?.cleanupTotal).toBe(900 + 195);
    expect(body.checkout?.complexityCleanupAdd).toBe(195);
    expect(body.checkout?.cleanupMonthlyRate).toBe(300);
    // The stored services carry the same add.
    const stored = mocks.update.mock.calls[0]?.[0]?.data?.onboardingData?.proposalBuilderState?.services as Record<string, unknown> | undefined;
    expect(stored?.complexityCleanupAdd).toBe(195);
    expect(stored?.cleanupTotal).toBe(900 + 195);
  });

  it("stores no add for a legacy snapshot without complexity", async () => {
    mocks.engagement.mockResolvedValue(complexityEngagementRow());
    const response = await selectMaintain({});
    expect(response.status).toBe(200);
    const body = await response.json() as { ok?: boolean; checkout?: Record<string, unknown> };
    expect(body.checkout?.cleanupTotal).toBe(900);
    expect(body.checkout?.complexityCleanupAdd).toBeUndefined();
    const stored = mocks.update.mock.calls[0]?.[0]?.data?.onboardingData?.proposalBuilderState?.services as Record<string, unknown> | undefined;
    expect(stored?.complexityCleanupAdd).toBeUndefined();
  });

  it("stores no add when no cleanup months are selected", async () => {
    mocks.engagement.mockResolvedValue(complexityEngagementRow({ cleanupPerMonthTotal: 65 }));
    const response = await selectMaintain({ selectedCleanupPeriodKeys: [] });
    expect(response.status).toBe(200);
    const body = await response.json() as { ok?: boolean; checkout?: Record<string, unknown> };
    expect(body.checkout?.cleanupTotal).toBe(0);
    expect(body.checkout?.complexityCleanupAdd).toBeUndefined();
  });
});
