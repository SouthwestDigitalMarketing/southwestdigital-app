import { createHash } from "node:crypto";

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
  chargeKind: "onboarding" | "first_month" | "cleanup" | "onboarding_and_first_month" | "onboarding_and_cleanup";
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

  const additionalOptions = Array.isArray(assessment.additionalOptions)
    ? assessment.additionalOptions.filter(isRecord)
    : [];
  const availableAdditionalOptions = new Map(
    additionalOptions
      .filter((option) => option.showInProposal === true && option.archived !== true && option.applicable !== false)
      .filter((option) => typeof option.id === "string")
      .map((option) => [option.id as string, option]),
  );
  const selectedAdditionalOptionIds = selection.selectedAdditionalOptionIds.filter((id) => availableAdditionalOptions.has(id));
  const additionalMonthlyTotal = selectedAdditionalOptionIds.reduce(
    (total, id) => total + finiteNumber(availableAdditionalOptions.get(id)?.monthlyPrice),
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
  const selectedCleanupPeriodKeys = selection.selectedCleanupPeriodKeys.filter((key) => availablePeriods.has(key));
  const selectedCleanupMonths = selectedCleanupPeriodKeys.reduce((total, key) => {
    const period = availablePeriods.get(key);
    return total + (period ? period.endMonth - period.startMonth + 1 : 0);
  }, 0);
  const maintainMonthly = money(finiteNumber(maintainPricing.monthly));
  const cleanupTotal = money(maintainMonthly * selectedCleanupMonths);

  const waived = assessment.waiveOnboardingFee === true || assessment.onboardingFeeOverride === 0;
  const override = assessment.onboardingFeeOverride;
  const onboardingFee = waived
    ? 0
    : money(
        typeof override === "number" && Number.isFinite(override)
          ? override
          : 500 + selectedCleanupMonths * 20,
      );
  const oneTimeTotal = money(cleanupTotal + onboardingFee);
  const amountDueNow = money(
    cleanupTotal > 0
      ? cleanupTotal + onboardingFee
      : onboardingFee + recurringMonthlyTotal,
  );
  const chargeKind: ProposalCheckoutSummary["chargeKind"] = cleanupTotal > 0
    ? onboardingFee > 0 ? "onboarding_and_cleanup" : "cleanup"
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
    chargeKind: (checkout.cleanupTotal > 0 ? "cleanup" : "first_month") as ProposalCheckoutSummary["chargeKind"],
  };
  return {
    ...waived,
    selectionHash: createHash("sha256").update(JSON.stringify(waived)).digest("hex"),
  };
}
