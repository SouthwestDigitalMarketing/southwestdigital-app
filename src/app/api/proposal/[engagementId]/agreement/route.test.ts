import { beforeEach, describe, expect, it, vi } from "vitest";
import { buildProposalCheckoutSummary } from "@/lib/engagements/proposalCheckout";
import { catalogCopyFromRows, toPublicBookkeepingProposal } from "@/lib/quotes/publicProposal";
import {
  PRIVATE_SENTINEL,
  sentinelBookkeepingSnapshot,
  sentinelCatalogRows,
} from "@/lib/quotes/publicProposalSentinel";

const mocks = vi.hoisted(() => ({
  access: vi.fn(),
  engagement: vi.fn(),
  brand: vi.fn(),
  update: vi.fn(),
}));

vi.mock("@/lib/engagements/publicProposalAccess", () => ({
  hasPublicProposalAccess: mocks.access,
  publicProposalNotFound: () => Response.json({}, { status: 404 }),
}));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    engagement: { findUnique: mocks.engagement, updateMany: mocks.update },
    brand: { findUnique: mocks.brand },
  },
}));

import { GET } from "./route";

const checkout = buildProposalCheckoutSummary(
  toPublicBookkeepingProposal(
    sentinelBookkeepingSnapshot(),
    catalogCopyFromRows(sentinelCatalogRows),
  ),
  {
    tier: "improve",
    hasTwelveMonthAgreement: false,
    selectedCleanupPeriodKeys: [],
    selectedAdditionalOptionIds: [],
  },
);

function engagementRow() {
  return {
    brandId: "brand",
    updatedAt: new Date("2026-01-01T00:00:00Z"),
    clientName: "Example LLC",
    primaryContactName: "Alex Example",
    primaryContactEmail: "alex@example.test",
    onboardingFee: 500,
    onboardingData: {
      proposalBuilderState: {
        assessment: {
          assessmentNotes: PRIVATE_SENTINEL,
          additionalOptions: [],
          bonuses: [],
        },
        services: {
          ...checkout,
          stripePaymentIntentId: PRIVATE_SENTINEL,
          secret: PRIVATE_SENTINEL,
        },
      },
    },
    agreementText: "Public agreement text",
    signedAt: null,
    signerName: null,
    signerTitle: null,
    onboardingFeeStatus: "REQUIRED",
    agreementManagerStatus: "ACTIVE",
    agreementCancellationRequestedAt: null,
    agreementCancellationReason: PRIVATE_SENTINEL,
    isTestProposal: false,
  };
}

const call = () => GET(
  new Request("https://firm.example.test/api/proposal/eng/agreement", {
    headers: { "x-proposal-token": "token", "x-hostname": "firm.example.test" },
  }),
  { params: Promise.resolve({ engagementId: "eng" }) },
);

beforeEach(() => {
  vi.resetAllMocks();
  mocks.access.mockResolvedValue(true);
  mocks.engagement.mockResolvedValue(engagementRow());
  mocks.brand.mockResolvedValue({ name: "Southwest" });
  mocks.update.mockResolvedValue({ count: 1 });
});

describe("public proposal agreement API", () => {
  it("GET agreement JSON omits assessment notes, cancellationReason, and raw checkout secrets", async () => {
    const response = await call();
    expect(response.status).toBe(200);
    const body = await response.json() as Record<string, unknown>;
    expect(JSON.stringify(body)).not.toContain(PRIVATE_SENTINEL);
    expect(body).not.toHaveProperty("cancellationReason");
    expect(body.checkout).toEqual(expect.objectContaining({
      tier: "improve",
      amountDueNow: expect.any(Number),
    }));
    expect(body.checkout).not.toHaveProperty("stripePaymentIntentId");
    expect(body.text).toBe("Public agreement text");
  });
});
