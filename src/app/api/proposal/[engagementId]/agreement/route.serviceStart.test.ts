import { beforeEach, describe, expect, it, vi } from "vitest";
import { buildProposalCheckoutSummary } from "@/lib/engagements/proposalCheckout";
import { firstMonthFullText, serviceStartText } from "@/lib/quotes/serviceStart";

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
vi.mock("@/lib/prisma", () => {
  const tx = {
    quote: { findFirst: async () => ({ id: "quote" }) },
    engagement: { updateMany: mocks.update },
  };
  return {
    prisma: {
      engagement: { findUnique: mocks.engagement, updateMany: mocks.update },
      brand: { findUnique: mocks.brand },
      $transaction: (fn: (client: typeof tx) => unknown) => fn(tx),
    },
  };
});
// The quote row lock is covered by mutationLock tests; here it always passes.
vi.mock("@/lib/quotes/mutationLock", () => ({
  lockQuoteMutation: async () => ({ id: "quote" }),
  QuoteMutationConflictError: class QuoteMutationConflictError extends Error {},
}));

import { GET } from "./route";

function checkoutFor(extraAssessment: Record<string, unknown>) {
  return buildProposalCheckoutSummary(
    {
      assessment: {
        annualSavingsPercent: 20,
        waiveOnboardingFee: false,
        onboardingFeeOverride: 500,
        historicalCleanupPeriods: [],
        additionalOptions: [],
        ...extraAssessment,
      },
      pricing: {
        maintain: { monthly: 300 },
        improve: { monthly: 450 },
        grow: { monthly: 600 },
      },
    },
    {
      tier: "maintain",
      hasTwelveMonthAgreement: false,
      selectedCleanupPeriodKeys: [],
      selectedAdditionalOptionIds: [],
    },
  );
}

function engagementRow(assessment: Record<string, unknown>, services: Record<string, unknown>) {
  return {
    brandId: "brand",
    productKind: "bookkeeping",
    updatedAt: new Date("2026-01-01T00:00:00Z"),
    clientName: "Example LLC",
    primaryContactName: "Alex Example",
    primaryContactEmail: "alex@example.test",
    onboardingFee: 500,
    onboardingData: {
      proposalBuilderState: {
        assessment: { additionalOptions: [], bonuses: [], ...assessment },
        services: { ...services, selectedTier: "maintain", selectedTierLabel: "Maintain" },
      },
    },
    agreementText: null,
    signedAt: null,
    signerName: null,
    signerTitle: null,
    onboardingFeeStatus: "REQUIRED",
    agreementManagerStatus: "ACTIVE",
    agreementCancellationRequestedAt: null,
    agreementCancellationReason: null,
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
  mocks.brand.mockResolvedValue({ name: "Southwest" });
  mocks.update.mockResolvedValue({ count: 1 });
});

describe("public proposal agreement API (spec 06 start month and credit carry-over)", () => {
  it("states the frozen start month, the full first month, and the remainder line", async () => {
    const checkout = checkoutFor({
      firstPaymentCredit: 1200,
      firstPaymentCreditReason: "Credit for October work already paid",
      serviceStartMonth: "2026-12",
    });
    expect(checkout.creditRemaining).toBe(400);
    mocks.engagement.mockResolvedValue(engagementRow(
      { firstPaymentCreditReason: "Credit for October work already paid" },
      JSON.parse(JSON.stringify(checkout)),
    ));
    const body = await (await call()).json();
    expect(body.text).toContain(serviceStartText("2026-12"));
    expect(body.text).toContain(firstMonthFullText());
    expect(body.text).not.toContain("confirm your service start date");
    expect(body.text).toContain("Credit for October work already paid: -$800.00");
    expect(body.text).toContain(
      "Remaining credit of $400.00 (Credit for October work already paid) will be applied to your next invoice.",
    );
  });

  it("labels a fully-applied credit from the stored assessment reason", async () => {
    const checkout = checkoutFor({
      firstPaymentCredit: 200,
      firstPaymentCreditReason: "Credit for October work already paid",
    });
    expect(checkout.creditRemaining).toBeUndefined();
    mocks.engagement.mockResolvedValue(engagementRow(
      { firstPaymentCreditReason: "Credit for October work already paid" },
      JSON.parse(JSON.stringify(checkout)),
    ));
    const body = await (await call()).json();
    expect(body.text).toContain("Credit for October work already paid: -$200.00");
    expect(body.text).not.toContain("Remaining credit");
  });

  it("renders legacy text without a start month or credit reason", async () => {
    const checkout = checkoutFor({});
    mocks.engagement.mockResolvedValue(engagementRow({}, JSON.parse(JSON.stringify(checkout))));
    const body = await (await call()).json();
    expect(body.text).not.toContain("Service starts");
    expect(body.text).not.toContain(firstMonthFullText());
    expect(body.text).not.toContain("Remaining credit");
    expect(body.text).toContain("confirm your service start date");
  });
});
