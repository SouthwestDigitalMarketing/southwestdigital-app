import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { buildProposalCheckoutSummary } from "@/lib/engagements/proposalCheckout";

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

  it("receipt page shows the wrap-up plan only when the stored checkout has one", async () => {
    const withPlan = buildProposalCheckoutSummary({
      assessment: {
        annualSavingsPercent: 20,
        waiveOnboardingFee: false,
        onboardingFeeOverride: null,
        historicalCleanupPeriods: [
          { year: 2026, startMonth: 1, endMonth: 3 },
          { year: 2025, startMonth: 11, endMonth: 12 },
        ],
        cleanupPlan: {
          caughtUpThrough: "2026-03",
          startDate: "2026-02-14",
          wrapUpDate: "2026-05-14",
          wrapUpSource: "default",
          paymentPlan: "monthly",
        },
        additionalOptions: [],
      },
      pricing: {
        maintain: { monthly: 300 },
        improve: { monthly: 450 },
        grow: { monthly: 600 },
      },
    }, {
      tier: "improve",
      hasTwelveMonthAgreement: false,
      selectedCleanupPeriodKeys: ["2026-1-3", "2025-11-12"],
      selectedAdditionalOptionIds: [],
      // M3: the stored plan is frozen at selection time (start = selection +
      // 14 days, default wrap-up recomputed), never the stale builder dates.
    }, { todayISO: "2026-02-01" });
    mocks.quoteFindFirst.mockResolvedValue(signedReceiptRow({
      engagement: {
        brandId: "brand",
        clientName: "Alex",
        status: "SIGNED",
        onboardingFeeStatus: "REQUIRED",
        onboardingData: {
          proposalAcceptance: { selection: JSON.parse(JSON.stringify(withPlan)) },
        },
        agreementText: "Signed agreement",
        agreementTextHash: "hash",
        signerName: "Alex Example",
        signerTitle: "Owner",
        billingContactEmail: "alex@example.test",
        signedAt: new Date("2026-01-02T00:00:00Z"),
        agreementManagerStatus: "ACTIVE",
        isTestProposal: false,
      },
    }));
    const el = await openReceipt();
    const markup = renderToStaticMarkup(el as never);
    expect(markup).toContain("Your agreed payment schedule");
    expect(markup).toContain("We will have your books caught up through March 2026 by April 15, 2026.");
    expect(markup).toContain("Monthly service and billing begin on April 15, 2026 or when cleanup is complete, whichever comes first.");
    expect(markup).toContain("Cleanup is paid in 2 monthly installments of $750.00.");
    expect(markup).toContain("If cleanup runs past the wrap-up date");
  });

  it("receipt page names the $150 fee only when the signed agreement charges it", async () => {
    const withPlan = buildProposalCheckoutSummary({
      assessment: {
        annualSavingsPercent: 20,
        waiveOnboardingFee: false,
        onboardingFeeOverride: null,
        historicalCleanupPeriods: [
          { year: 2026, startMonth: 1, endMonth: 3 },
        ],
        cleanupPlan: {
          caughtUpThrough: "2026-03",
          startDate: "2026-02-14",
          wrapUpDate: "2026-05-14",
          wrapUpSource: "default",
          paymentPlan: "monthly",
        },
        additionalOptions: [],
      },
      pricing: {
        maintain: { monthly: 300 },
        improve: { monthly: 450 },
        grow: { monthly: 600 },
      },
    }, {
      tier: "maintain",
      hasTwelveMonthAgreement: false,
      selectedCleanupPeriodKeys: ["2026-1-3"],
      selectedAdditionalOptionIds: [],
    }, { todayISO: "2026-02-01" });
    async function markupForAgreementText(agreementText: string) {
      mocks.quoteFindFirst.mockResolvedValue(signedReceiptRow({
        engagement: {
          brandId: "brand",
          clientName: "Alex",
          status: "SIGNED",
          onboardingFeeStatus: "REQUIRED",
          onboardingData: {
            proposalAcceptance: { selection: JSON.parse(JSON.stringify(withPlan)) },
          },
          agreementText,
          agreementTextHash: "hash",
          signerName: "Alex Example",
          signerTitle: "Owner",
          billingContactEmail: "alex@example.test",
          signedAt: new Date("2026-01-02T00:00:00Z"),
          agreementManagerStatus: "ACTIVE",
          isTestProposal: false,
        },
      }));
      return renderToStaticMarkup(await openReceipt() as never);
    }
    const withFee = await markupForAgreementText(
      "Terms. If documents are not received within 30 days of payment, a $150/month file-maintenance fee applies to keep the engagement open. Signed.",
    );
    expect(withFee).toContain("replaces the $150 file-maintenance fee");
    const withoutFee = await markupForAgreementText("Custom terms with no maintenance fee. Signed.");
    expect(withoutFee).not.toContain("$150 file-maintenance fee");
    expect(withoutFee).toContain("replaces any file-maintenance fee");
  });

  it("receipt page itemizes the complexity add so the estimate adds up", async () => {
    const withComplexity = buildProposalCheckoutSummary({
      assessment: {
        annualSavingsPercent: 20,
        waiveOnboardingFee: false,
        onboardingFeeOverride: null,
        historicalCleanupPeriods: [
          { year: 2026, startMonth: 1, endMonth: 3 },
          { year: 2025, startMonth: 11, endMonth: 12 },
        ],
        cleanupPlan: {
          caughtUpThrough: "2026-03",
          startDate: "2026-02-14",
          wrapUpDate: "2026-05-14",
          wrapUpSource: "default",
          paymentPlan: "monthly",
        },
        additionalOptions: [],
      },
      pricing: {
        maintain: {
          monthly: 300,
          complexity: { lines: [], monthlyTotal: 0, cleanupPerMonthTotal: 65, cleanupTotal: 325 },
        },
        improve: { monthly: 450 },
        grow: { monthly: 600 },
      },
    }, {
      tier: "improve",
      hasTwelveMonthAgreement: false,
      selectedCleanupPeriodKeys: ["2026-1-3", "2025-11-12"],
      selectedAdditionalOptionIds: [],
    }, { todayISO: "2026-02-01" });
    mocks.quoteFindFirst.mockResolvedValue(signedReceiptRow({
      engagement: {
        brandId: "brand",
        clientName: "Alex",
        status: "SIGNED",
        onboardingFeeStatus: "REQUIRED",
        onboardingData: {
          proposalAcceptance: { selection: JSON.parse(JSON.stringify(withComplexity)) },
        },
        agreementText: "Signed agreement",
        agreementTextHash: "hash",
        signerName: "Alex Example",
        signerTitle: "Owner",
        billingContactEmail: "alex@example.test",
        signedAt: new Date("2026-01-02T00:00:00Z"),
        agreementManagerStatus: "ACTIVE",
        isTestProposal: false,
      },
    }));
    const el = await openReceipt();
    const markup = renderToStaticMarkup(el as never);
    // 5 months × $300 base + $325 complexity add = $1,825 frozen total.
    expect(markup).toContain("Cleanup estimate: 5 months × $300.00 = $1,500.00.");
    expect(markup).toContain("Complexity adjustment: $325.00. Estimated Cleanup Total: $1,825.00.");
  });

  it("receipt page omits the wrap-up plan for legacy stored checkouts", async () => {
    mocks.quoteFindFirst.mockResolvedValue(signedReceiptRow());
    const el = await openReceipt();
    const markup = renderToStaticMarkup(el as never);
    expect(markup).toContain("Signed proposal record");
    expect(markup).not.toContain("caught up through");
    expect(markup).not.toContain("wrap-up date");
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

  it("itemizes the complexity cleanup add so the estimate equation adds up", async () => {
    mocks.quoteFindFirst.mockResolvedValue(signedReceiptRow({
      engagement: {
        ...signedReceiptRow().engagement,
        onboardingData: {
          proposalAcceptance: {
            selection: {
              tier: "maintain",
              tierLabel: "Maintain",
              hasTwelveMonthAgreement: false,
              selectedCleanupPeriodKeys: ["2026-1-3"],
              selectedAdditionalOptionIds: [],
              baseMonthlyTotal: 300,
              recurringMonthlyTotal: 300,
              cleanupTotal: 1095,
              onboardingFee: 560,
              oneTimeTotal: 560,
              amountDueNow: 560,
              chargeKind: "onboarding_and_discovery",
              selectionHash: "hash",
              paymentScheduleVersion: 2,
              cleanupMonths: 3,
              cleanupMonthlyRate: 300,
              additionalOneTimeTotal: 0,
              complexityCleanupAdd: 195,
              includedServices: [],
            },
          },
        },
      },
    }));
    const html = renderToStaticMarkup(await openReceipt());
    expect(html).toContain("Cleanup estimate: 3 months × $300.00 = $900.00.");
    expect(html).toContain("Complexity adjustment: $195.00. Estimated Cleanup Total: $1,095.00.");
  });

  it("receipt initial payment carries the sized migration total exactly once", async () => {
    const withMigration = buildProposalCheckoutSummary({
      assessment: {
        annualSavingsPercent: 20,
        waiveOnboardingFee: false,
        onboardingFeeOverride: null,
        historicalCleanupPeriods: [],
        additionalOptions: [{
          id: "migration",
          name: "QuickBooks Desktop to Online Migration",
          description: "Legacy flat row.",
          monthlyPrice: 640,
          showInProposal: true,
          archived: false,
          billingCadence: "one-time" as const,
          packageIds: ["maintain", "improve", "grow"] as const,
          required: true,
        }],
        desktopMigration: { choice: "full_history", historyYears: 2 },
      },
      pricing: {
        maintain: { monthly: 300 },
        improve: { monthly: 450 },
        grow: { monthly: 600 },
        desktopMigration: {
          lines: [
            { label: "Desktop migration — full history base", amount: 640 },
            { label: "Full history — 2 years × $150", amount: 300 },
            { label: "Trial-balance tie-out (included)", amount: 0 },
          ],
          total: 940,
        },
      },
    }, {
      tier: "maintain",
      hasTwelveMonthAgreement: false,
      selectedCleanupPeriodKeys: [],
      selectedAdditionalOptionIds: [],
    });
    // The suppressed flat $640 never stacks: the stored one-time total is
    // the sized migration alone.
    expect(withMigration.additionalOneTimeTotal).toBe(940);
    mocks.quoteFindFirst.mockResolvedValue(signedReceiptRow({
      engagement: {
        ...signedReceiptRow().engagement,
        onboardingData: {
          proposalAcceptance: { selection: JSON.parse(JSON.stringify(withMigration)) },
        },
        agreementText: "QuickBooks Desktop to Online Migration — Full history: $940.00 (one-time). Signed.",
      },
    }));
    const html = renderToStaticMarkup(await openReceipt());
    // First month $300 + onboarding $500 + sized migration $940, due today.
    expect(html).toContain("Initial payment: $1,740.00.");
  });

  it("shows the remainder frozen at acceptance so the next invoice applies it", async () => {
    const withCarry = buildProposalCheckoutSummary({
      assessment: {
        annualSavingsPercent: 20,
        waiveOnboardingFee: false,
        onboardingFeeOverride: 500,
        historicalCleanupPeriods: [],
        additionalOptions: [],
        firstPaymentCredit: 1200,
        firstPaymentCreditReason: "Credit for October work already paid",
        serviceStartMonth: "2026-12",
      },
      pricing: {
        maintain: { monthly: 300 },
        improve: { monthly: 450 },
        grow: { monthly: 600 },
      },
    }, {
      tier: "maintain",
      hasTwelveMonthAgreement: false,
      selectedCleanupPeriodKeys: [],
      selectedAdditionalOptionIds: [],
    });
    expect(withCarry.creditRemaining).toBe(400);
    mocks.quoteFindFirst.mockResolvedValue(signedReceiptRow({
      engagement: {
        ...signedReceiptRow().engagement,
        onboardingData: {
          proposalAcceptance: {
            creditRemaining: withCarry.creditRemaining,
            creditRemainingReason: withCarry.creditRemainingReason,
            selection: JSON.parse(JSON.stringify(withCarry)),
          },
        },
      },
    }));
    const html = renderToStaticMarkup(await openReceipt());
    expect(html).toContain("Initial payment: $0.00.");
    expect(html).toContain(
      "Remaining credit of $400.00 (Credit for October work already paid) will be applied to your next invoice.",
    );
  });

  it("falls back to the stored checkout remainder when the acceptance carries none", async () => {
    const withCarry = buildProposalCheckoutSummary({
      assessment: {
        annualSavingsPercent: 20,
        waiveOnboardingFee: false,
        onboardingFeeOverride: 500,
        historicalCleanupPeriods: [],
        additionalOptions: [],
        firstPaymentCredit: 1200,
        firstPaymentCreditReason: "Credit for October work already paid",
      },
      pricing: {
        maintain: { monthly: 300 },
        improve: { monthly: 450 },
        grow: { monthly: 600 },
      },
    }, {
      tier: "maintain",
      hasTwelveMonthAgreement: false,
      selectedCleanupPeriodKeys: [],
      selectedAdditionalOptionIds: [],
    });
    mocks.quoteFindFirst.mockResolvedValue(signedReceiptRow({
      engagement: {
        ...signedReceiptRow().engagement,
        onboardingData: {
          proposalAcceptance: { selection: JSON.parse(JSON.stringify(withCarry)) },
        },
      },
    }));
    const html = renderToStaticMarkup(await openReceipt());
    expect(html).toContain(
      "Remaining credit of $400.00 (Credit for October work already paid) will be applied to your next invoice.",
    );
  });

  it("omits the remainder line for legacy receipts without a carry-over", async () => {
    mocks.quoteFindFirst.mockResolvedValue(signedReceiptRow());
    const html = renderToStaticMarkup(await openReceipt());
    expect(html).not.toContain("Remaining credit");
  });

  it("renders the legacy cleanup equation without complexity lines when the add is absent", async () => {
    mocks.quoteFindFirst.mockResolvedValue(signedReceiptRow({
      engagement: {
        ...signedReceiptRow().engagement,
        onboardingData: {
          proposalAcceptance: {
            selection: {
              tier: "maintain",
              tierLabel: "Maintain",
              hasTwelveMonthAgreement: false,
              selectedCleanupPeriodKeys: ["2026-1-3"],
              selectedAdditionalOptionIds: [],
              baseMonthlyTotal: 300,
              recurringMonthlyTotal: 300,
              cleanupTotal: 900,
              onboardingFee: 560,
              oneTimeTotal: 560,
              amountDueNow: 560,
              chargeKind: "onboarding_and_discovery",
              selectionHash: "hash",
              paymentScheduleVersion: 2,
              cleanupMonths: 3,
              cleanupMonthlyRate: 300,
              additionalOneTimeTotal: 0,
              includedServices: [],
            },
          },
        },
      },
    }));
    const html = renderToStaticMarkup(await openReceipt());
    expect(html).toContain("Cleanup estimate: 3 months × $300.00 = $900.00.");
    expect(html).not.toContain("Complexity adjustment");
    expect(html).not.toContain("Estimated Cleanup Total");
  });
});
