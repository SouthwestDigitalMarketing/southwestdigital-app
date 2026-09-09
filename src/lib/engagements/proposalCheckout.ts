import { createHash } from "node:crypto";
import { proposalIncludedServices, proposalServiceAddOns } from "@/lib/quotes/proposalServices";
import { proposalPaymentSchedule } from "@/lib/quotes/paymentSchedule";

const TIER_IDS = ["maintain", "improve", "grow"] as const;
export type ProposalCheckoutTier = (typeof TIER_IDS)[number];

export type ProposalCheckoutSelection = {
  tier: ProposalCheckoutTier;
  hasTwelveMonthAgreement: boolean;
  selectedCleanupPeriodKeys: string[];
  selectedAdditionalOptionIds: string[];
};

export type ProposalCheckoutSummary = ProposalCheckoutSelection & {
  tierLabel: string;
  baseMonthlyTotal: number;
  recurringMonthlyTotal: number;
  cleanupTotal: number;
  onboardingFee: number;
  oneTimeTotal: number;
  amountDueNow: number;
  // Absent on older selections, whose accepted amounts must remain unchanged.
  paymentScheduleVersion?: 2;
  cleanupMonths?: number;
  cleanupMonthlyRate?: number;
  additionalOneTimeTotal?: number;
  includedServices?: { name: string; description: string }[];
  chargeKind: "onboarding" | "first_month" | "cleanup" | "onboarding_and_first_month" | "onboarding_and_cleanup" | "onboarding_and_discovery";
  selectionHash: string;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function finiteNumber(value: unknown, fallback = 0) {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function money(value: number) {
  return Math.round(Math.max(0, value) * 100) / 100;
}

function uniqueStrings(value: unknown) {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.filter((item): item is string => typeof item === "string" && item.length > 0))];
}

export function isProposalCheckoutTier(value: unknown): value is ProposalCheckoutTier {
  return typeof value === "string" && TIER_IDS.includes(value as ProposalCheckoutTier);
}

export function parseProposalCheckoutSelection(value: unknown): ProposalCheckoutSelection | null {
  if (!isRecord(value) || !isProposalCheckoutTier(value.tier)) return null;
  return {
    tier: value.tier,
    hasTwelveMonthAgreement: value.hasTwelveMonthAgreement === true,
    selectedCleanupPeriodKeys: uniqueStrings(value.selectedCleanupPeriodKeys),
    selectedAdditionalOptionIds: uniqueStrings(value.selectedAdditionalOptionIds),
  };
}

export function parseStoredProposalCheckout(value: unknown): ProposalCheckoutSummary | null {
  if (!isRecord(value)) return null;
  const selection = parseProposalCheckoutSelection(value);
  if (!selection) return null;
  const chargeKinds = new Set<ProposalCheckoutSummary["chargeKind"]>([
    "onboarding",
    "first_month",
    "cleanup",
    "onboarding_and_first_month",
    "onboarding_and_cleanup",
    "onboarding_and_discovery",
  ]);
  const chargeKind = typeof value.chargeKind === "string" && chargeKinds.has(value.chargeKind as ProposalCheckoutSummary["chargeKind"])
    ? value.chargeKind as ProposalCheckoutSummary["chargeKind"]
    : null;
  if (!chargeKind || typeof value.selectionHash !== "string") return null;
  const numericKeys = [
    "baseMonthlyTotal",
    "recurringMonthlyTotal",
    "cleanupTotal",
    "onboardingFee",
    "oneTimeTotal",
    "amountDueNow",
  ] as const;
  if (numericKeys.some((key) => typeof value[key] !== "number" || !Number.isFinite(value[key]) || value[key] < 0)) {
    return null;
  }
  if (value.paymentScheduleVersion !== undefined && value.paymentScheduleVersion !== 2) return null;
  if (value.paymentScheduleVersion === 2 && ["cleanupMonths", "cleanupMonthlyRate", "additionalOneTimeTotal"].some(
    (key) => typeof value[key] !== "number" || !Number.isFinite(value[key]) || value[key] < 0,
  )) return null;
  return {
    ...selection,
    tierLabel: typeof value.tierLabel === "string" ? value.tierLabel : selection.tier,
    baseMonthlyTotal: value.baseMonthlyTotal as number,
    recurringMonthlyTotal: value.recurringMonthlyTotal as number,
    cleanupTotal: value.cleanupTotal as number,
    onboardingFee: value.onboardingFee as number,
    oneTimeTotal: value.oneTimeTotal as number,
    amountDueNow: value.amountDueNow as number,
    chargeKind,
    selectionHash: value.selectionHash,
    ...(value.paymentScheduleVersion === 2 ? {
      paymentScheduleVersion: 2 as const,
      cleanupMonths: value.cleanupMonths as number,
      cleanupMonthlyRate: value.cleanupMonthlyRate as number,
      additionalOneTimeTotal: value.additionalOneTimeTotal as number,
      includedServices: Array.isArray(value.includedServices) ? value.includedServices.filter(isRecord)
        .filter((item) => typeof item.name === "string" && typeof item.description === "string")
        .map((item) => ({ name: item.name as string, description: item.description as string })) : [],
    } : {}),
  };
}

export function buildProposalCheckoutSummary(
  publishedSnapshot: unknown,
  selection: ProposalCheckoutSelection,
): ProposalCheckoutSummary {
  if (!isRecord(publishedSnapshot)) throw new Error("Published offer snapshot is missing.");
  const assessment = isRecord(publishedSnapshot.assessment) ? publishedSnapshot.assessment : {};
  const pricing = isRecord(publishedSnapshot.pricing) ? publishedSnapshot.pricing : {};
  const selectedTierPricing = pricing[selection.tier];
  const tierPricing: Record<string, unknown> = isRecord(selectedTierPricing) ? selectedTierPricing : {};
  const maintainPricing: Record<string, unknown> = isRecord(pricing.maintain) ? pricing.maintain : {};
  const baseMonthlyTotal = money(finiteNumber(tierPricing.monthly));
  if (baseMonthlyTotal <= 0) throw new Error("The selected package does not have valid published pricing.");

  const annualSavingsPercent = Math.min(100, Math.max(0, finiteNumber(assessment.annualSavingsPercent, 20)));
  const discountedBaseMonthly = selection.hasTwelveMonthAgreement
    ? baseMonthlyTotal * (1 - annualSavingsPercent / 100)
    : baseMonthlyTotal;

  const availableAdditionalOptions = new Map(
    proposalServiceAddOns(assessment)
      .filter((option) => option.packageIds.includes(selection.tier))
      .map((option) => [option.id, option]),
  );
  const selectedAdditionalOptionIds = [...new Set(selection.selectedAdditionalOptionIds)]
    .filter((id) => availableAdditionalOptions.has(id));
  const additionalMonthlyTotal = selectedAdditionalOptionIds.reduce(
    (total, id) => {
      const option = availableAdditionalOptions.get(id);
      return option?.billingCadence === "one-time"
        ? total
        : total + finiteNumber(option?.monthlyPrice);
    },
    0,
  );
  const additionalOneTimeTotal = selectedAdditionalOptionIds.reduce(
    (total, id) => {
      const option = availableAdditionalOptions.get(id);
      return option?.billingCadence === "one-time"
        ? total + finiteNumber(option.monthlyPrice)
        : total;
    },
    0,
  );
  const recurringMonthlyTotal = money(discountedBaseMonthly + additionalMonthlyTotal);

  const periods = Array.isArray(assessment.historicalCleanupPeriods)
    ? assessment.historicalCleanupPeriods.filter(isRecord)
    : [];
  const availablePeriods = new Map<string, { startMonth: number; endMonth: number }>(
    periods.flatMap((period) => {
      const year = finiteNumber(period.year);
      const startMonth = finiteNumber(period.startMonth);
      const endMonth = finiteNumber(period.endMonth);
      if (!year || startMonth < 1 || endMonth < startMonth || endMonth > 12) return [];
      return [[`${year}-${startMonth}-${endMonth}`, { startMonth, endMonth }] as const];
    }),
  );
  const selectedCleanupPeriodKeys = [...new Set(selection.selectedCleanupPeriodKeys)].filter((key) => availablePeriods.has(key));
  const selectedCleanupMonths = selectedCleanupPeriodKeys.reduce((total, key) => {
    const period = availablePeriods.get(key);
    return total + (period ? period.endMonth - period.startMonth + 1 : 0);
  }, 0);
  const maintainMonthly = money(finiteNumber(maintainPricing.monthly));

  const waived = assessment.waiveOnboardingFee === true || assessment.onboardingFeeOverride === 0;
  const override = assessment.onboardingFeeOverride;
  const onboardingFee = waived
    ? 0
    : money(
        typeof override === "number" && Number.isFinite(override)
          ? override
          : 500 + selectedCleanupMonths * 20,
      );
  const { cleanupTotal, oneTimeTotal, amountDueNow } = proposalPaymentSchedule({
    cleanupMonths: selectedCleanupMonths, cleanupMonthlyRate: maintainMonthly,
    onboardingFee, additionalOneTimeTotal, recurringMonthlyTotal,
  });
  const chargeKind: ProposalCheckoutSummary["chargeKind"] = selectedCleanupMonths > 0
    ? "onboarding_and_discovery"
    : onboardingFee > 0 ? "onboarding_and_first_month" : "first_month";

  const normalized = {
    tier: selection.tier,
    hasTwelveMonthAgreement: selection.hasTwelveMonthAgreement,
    selectedCleanupPeriodKeys,
    selectedAdditionalOptionIds,
    tierLabel: selection.tier[0].toUpperCase() + selection.tier.slice(1),
    baseMonthlyTotal,
    recurringMonthlyTotal,
    cleanupTotal,
    onboardingFee,
    oneTimeTotal,
    amountDueNow,
    chargeKind,
    paymentScheduleVersion: 2 as const,
    cleanupMonths: selectedCleanupMonths,
    cleanupMonthlyRate: maintainMonthly,
    additionalOneTimeTotal: money(additionalOneTimeTotal),
    includedServices: proposalIncludedServices(assessment, selection.tier),
  };
  const selectionHash = createHash("sha256").update(JSON.stringify(normalized)).digest("hex");
  return { ...normalized, selectionHash };
}

export function resolveAmountDueNow(input: {
  checkout: Pick<ProposalCheckoutSummary, "amountDueNow" | "onboardingFee">;
  onboardingWaived: boolean;
  isTestProposal: boolean;
}) {
  if (input.isTestProposal) return 1;
  return money(
    input.checkout.amountDueNow - (input.onboardingWaived ? input.checkout.onboardingFee : 0),
  );
}

export function applyOnboardingWaiver(checkout: ProposalCheckoutSummary): ProposalCheckoutSummary {
  if (checkout.onboardingFee <= 0) return checkout;
  const waived = {
    ...checkout,
    onboardingFee: 0,
    oneTimeTotal: money(checkout.oneTimeTotal - checkout.onboardingFee),
    amountDueNow: money(checkout.amountDueNow - checkout.onboardingFee),
    chargeKind: (checkout.paymentScheduleVersion === 2 && (checkout.cleanupMonths ?? 0) > 0
      ? "onboarding_and_discovery"
      : checkout.cleanupTotal > 0 ? "cleanup" : "first_month") as ProposalCheckoutSummary["chargeKind"],
  };
  return {
    ...waived,
    selectionHash: createHash("sha256").update(JSON.stringify(waived)).digest("hex"),
  };
}
