import { describe, expect, it } from "vitest";
import {
  includedServicePackages,
  proposalServiceAddOns,
  serviceIsApplicable,
} from "./proposalServices";
import { buildProposalCheckoutSummary } from "../engagements/proposalCheckout";
import { toPublicBookkeepingProposal } from "./publicProposal";
import {
  buildOptionsTemplateSnapshot,
  type OptionsTemplateBonus,
} from "./optionsTemplates";

const bonus: OptionsTemplateBonus = {
  id: "reporting",
  name: "Reporting",
  description: "Reports",
  archived: false,
  billingCadence: "one-time",
  defaultPackageIds: ["improve", "grow"],
  addOnPackageIds: ["maintain", "improve", "grow"],
  addOnPrice: 65,
};
const assessment = {
  servicesInitialized: true,
  annualSavingsPercent: 20,
  waiveOnboardingFee: true,
  bonuses: [bonus],
  additionalOptions: [],
  bonusPackageSelections: {},
  optionsCatalogOrder: ["reporting"],
};
const snapshot = {
  assessment,
  pricing: {
    maintain: { monthly: 300 },
    improve: { monthly: 450 },
    grow: { monthly: 600 },
  },
};

describe("shared service rules", () => {
  it("preserves a saved gap and honors an explicitly empty selection", () => {
    expect(
      includedServicePackages(
        { bonusPackageSelections: { reporting: ["maintain", "grow"] } },
        bonus,
      ),
    ).toEqual(["maintain", "grow"]);
    expect(
      includedServicePackages(
        { bonusPackageSelections: { reporting: [] } },
        bonus,
      ),
    ).toEqual([]);
  });
  it("never offers a paid add-on in a tier where it is included", () => {
    expect(proposalServiceAddOns(assessment)).toEqual([
      expect.objectContaining({
        id: "reporting",
        packageIds: ["maintain"],
        monthlyPrice: 65,
      }),
    ]);
  });
  it.each(["monthly", "one-time"] as const)(
    "charges a hybrid %s add-on once, only in the eligible tier",
    (billingCadence) => {
      const published = {
        ...snapshot,
        assessment: { ...assessment, bonuses: [{ ...bonus, billingCadence }] },
      };
      const selection = {
        tier: "maintain" as const,
        hasTwelveMonthAgreement: true,
        selectedCleanupPeriodKeys: [],
        selectedAdditionalOptionIds: ["reporting", "reporting"],
      };
      const checkout = buildProposalCheckoutSummary(published, selection);
      expect(checkout.selectedAdditionalOptionIds).toEqual(["reporting"]);
      expect(checkout.recurringMonthlyTotal).toBe(
        billingCadence === "monthly" ? 305 : 240,
      );
      expect(checkout.oneTimeTotal).toBe(
        billingCadence === "one-time" ? 65 : 0,
      );
      expect(checkout.amountDueNow).toBe(305);
      const included = buildProposalCheckoutSummary(published, {
        ...selection,
        tier: "improve",
      });
      expect(included.selectedAdditionalOptionIds).toEqual([]);
      expect(included.amountDueNow).toBe(360);
    },
  );
  it("charges one-time add-ons with cleanup without advancing the recurring bill", () => {
    const checkout = buildProposalCheckoutSummary(
      {
        ...snapshot,
        assessment: {
          ...assessment,
          historicalCleanupPeriods: [
            { year: 2026, startMonth: 1, endMonth: 2 },
          ],
        },
      },
      {
        tier: "maintain",
        hasTwelveMonthAgreement: false,
        selectedCleanupPeriodKeys: ["2026-1-2", "2026-1-2"],
        selectedAdditionalOptionIds: ["reporting"],
      },
    );
    expect(checkout.cleanupTotal).toBe(600);
    expect(checkout.amountDueNow).toBe(65);
    expect(checkout.recurringMonthlyTotal).toBe(300);
  });
  it("rejects unavailable optional tiers even when the browser submits their IDs", () => {
    const published = {
      ...snapshot,
      assessment: {
        ...assessment,
        bonuses: [],
        additionalOptions: [
          {
            id: "grow-only",
            monthlyPrice: 900,
            showInProposal: true,
            packageIds: ["grow"],
          },
          {
            id: "none",
            monthlyPrice: 900,
            showInProposal: true,
            packageIds: [],
          },
          { id: "legacy", monthlyPrice: 10, showInProposal: true },
        ],
      },
    };
    const checkout = buildProposalCheckoutSummary(published, {
      tier: "maintain",
      hasTwelveMonthAgreement: false,
      selectedCleanupPeriodKeys: [],
      selectedAdditionalOptionIds: ["grow-only", "none", "legacy", "legacy"],
    });
    expect(checkout.selectedAdditionalOptionIds).toEqual(["legacy"]);
    expect(checkout.recurringMonthlyTotal).toBe(310);
  });
  it.each([
    { archived: true },
    { applicable: false },
    { addOnPrice: -1 },
    { addOnPrice: NaN },
    { addOnPrice: Infinity },
  ])("excludes invalid or unavailable services: %j", (changes) => {
    expect(
      proposalServiceAddOns({
        ...assessment,
        bonuses: [{ ...bonus, ...changes }],
      }),
    ).toEqual([]);
  });
  it("uses frozen applicability and retains legacy real estate guards", () => {
    expect(serviceIsApplicable({}, { id: "property-reporting-setup" })).toBe(
      false,
    );
    expect(
      serviceIsApplicable(
        {},
        { id: "property-reporting-setup", applicable: true },
      ),
    ).toBe(true);
    expect(
      serviceIsApplicable(
        {},
        { id: "property-reporting-setup", realEstateSpecific: false },
      ),
    ).toBe(true);
  });
  it("preserves eligibility, cadence and price through templates and the public allowlist", () => {
    const templated = buildOptionsTemplateSnapshot(assessment);
    const published = toPublicBookkeepingProposal({
      ...snapshot,
      assessment: { ...assessment, ...templated },
    });
    expect(published.assessment.servicesInitialized).toBe(true);
    expect(proposalServiceAddOns(published.assessment)).toEqual(
      proposalServiceAddOns(assessment),
    );
  });
});
