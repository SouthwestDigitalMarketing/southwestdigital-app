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
  catalog: vi.fn(),
  capabilities: vi.fn(),
  waiver: vi.fn(),
}));

vi.mock("@/lib/engagements/publicProposalAccess", () => ({
  hasPublicProposalAccess: mocks.access,
  publicProposalNotFound: () => Response.json({}, { status: 404 }),
}));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    engagement: { findUnique: mocks.engagement, updateMany: mocks.update },
    catalogService: { findMany: mocks.catalog },
  },
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
  mocks.update.mockResolvedValue({ count: 1 });
  mocks.catalog.mockResolvedValue(sentinelCatalogRows);
  mocks.capabilities.mockResolvedValue({
    proposalCatalog: true,
    catalogProductKind: true,
  });
  mocks.waiver.mockResolvedValue(false);
});

describe("public proposal select API", () => {
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
