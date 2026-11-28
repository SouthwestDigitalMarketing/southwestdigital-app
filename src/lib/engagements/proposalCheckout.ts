import { createHash } from "node:crypto";
import { effectiveAssessment } from "@/app/(app)/offers/builder/effectiveAssessment";
import type { AssessmentState } from "@/app/(app)/offers/builder/ProposalCreationWorkspaceDemo";
import {
  resolveBundlePricingOptions,
  resolveCompanyBundleForTier,
} from "@/lib/quotes/companyBundle";
import {
  buildCleanupInstallments,
  cleanupMonthsFromSelectedPeriods,
  readCleanupInstallments as readStoredCleanupInstallments,
  readCleanupPlan as readStoredCleanupPlan,
  refreshCleanupPlanAtSelection,
  type CleanupInstallment,
  type CleanupPlan,
} from "@/lib/quotes/cleanupPlan";
import { staffDateKey } from "@/lib/quotes/staffDates";
import {
  creditCarryover,
  isServiceStartMonth,
  resolveServiceStartMonth,
} from "@/lib/quotes/serviceStart";
import { proposalIncludedServices, proposalServiceAddOns } from "@/lib/quotes/proposalServices";
import { toPublicDesktopMigration } from "@/lib/quotes/desktopMigration";
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
  /** Spec 03 complexity cleanup weight inside cleanupTotal; absent when none applies. */
  complexityCleanupAdd?: number;
  /** Months of recurring service covered by today's payment: 1, or 12 on a prepaid annual term. */
  prepaidMonths?: number;
  /**
   * Spec 04 wrap-up plan, stored only when the published snapshot carried
   * `assessment.cleanupPlan` and cleanup months were selected. Absent on
   * legacy checkouts, whose stored terms stay byte-identical.
   */
  cleanupPlan?: CleanupPlan;
  /**
   * Installment schedule for the stored cleanup total (sums to
   * `cleanupTotal`, complexity add included). Frozen at selection time —
   * never recomputed on read, so signed terms cannot drift.
   */
  cleanupInstallments?: CleanupInstallment[];
  /** Credit for money already paid, deducted from amountDueNow. Absent when there is none. */
  creditApplied?: number;
  amountDueBeforeCredit?: number;
  /**
   * Spec 06 start month ("YYYY-MM"): the explicit staff month, the Spec 04
   * wrap-up month when a cleanup plan was selected (an explicit month is
   * ignored then), or the frozen Chicago default for the selection date.
   * Always present on round-2 checkouts; absent on legacy checkouts, whose
   * stored terms stay byte-identical.
   */
  serviceStartMonth?: string;
  /**
   * Spec 06 remainder when the first-payment credit exceeded today's amount.
   * Applied only against the next Donna-sent invoice. Absent unless the
   * remainder is above zero (legacy: absent).
   */
  creditRemaining?: number;
  creditRemainingReason?: string;
  /**
   * Client-readable reason for the first-payment credit. Stored whenever a
   * credit with a reason exists (even fully applied), so a later waiver
   * that creates a remainder keeps it. Absent on legacy checkouts.
   */
  firstPaymentCreditReason?: string;
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

/**
 * Stored Spec 04 wrap-up plans are frozen client terms: parse accepts them
 * only when every field is well-formed, otherwise the keys are dropped (the
 * checkout still parses — it just reads as a legacy no-plan checkout). The
 * strict validators are shared with the agreement reader and the receipt.
 */
function parseStoredCleanupPlan(value: unknown): CleanupPlan | null {
  return readStoredCleanupPlan(value);
}

function parseStoredCleanupInstallments(value: unknown): CleanupInstallment[] | null {
  return readStoredCleanupInstallments(value);
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
    ...(typeof value.creditApplied === "number" && Number.isFinite(value.creditApplied) && value.creditApplied > 0
      && typeof value.amountDueBeforeCredit === "number" && Number.isFinite(value.amountDueBeforeCredit) ? {
      creditApplied: value.creditApplied,
      amountDueBeforeCredit: value.amountDueBeforeCredit,
    } : {}),
    // Spec 06 start month: a malformed stored month reads as legacy (absent).
    ...(typeof value.serviceStartMonth === "string" && isServiceStartMonth(value.serviceStartMonth) ? {
      serviceStartMonth: value.serviceStartMonth,
    } : {}),
    // Spec 06 carry-over: only a positive remainder parses; a stray reason
    // without an amount reads as no carry-over. Malformed values never fail
    // the checkout — it still parses as a legacy no-carry-over checkout.
    ...(() => {
      if (typeof value.creditRemaining !== "number" || !Number.isFinite(value.creditRemaining) || value.creditRemaining <= 0) {
        return {};
      }
      return {
        creditRemaining: value.creditRemaining,
        ...(typeof value.creditRemainingReason === "string" ? { creditRemainingReason: value.creditRemainingReason } : {}),
      };
    })(),
    ...(typeof value.firstPaymentCreditReason === "string" && value.firstPaymentCreditReason.length > 0 ? {
      firstPaymentCreditReason: value.firstPaymentCreditReason,
    } : {}),
    ...(typeof value.complexityCleanupAdd === "number" && Number.isFinite(value.complexityCleanupAdd) && value.complexityCleanupAdd > 0 ? {
      complexityCleanupAdd: value.complexityCleanupAdd,
    } : {}),
    ...(value.paymentScheduleVersion === 2 ? {
      paymentScheduleVersion: 2 as const,
      cleanupMonths: value.cleanupMonths as number,
      cleanupMonthlyRate: value.cleanupMonthlyRate as number,
      additionalOneTimeTotal: value.additionalOneTimeTotal as number,
      // Absent on checkouts stored before prepaid annual terms existed; those were billed monthly.
      prepaidMonths: typeof value.prepaidMonths === "number" && Number.isFinite(value.prepaidMonths) && value.prepaidMonths > 0
        ? value.prepaidMonths
        : 1,
      includedServices: Array.isArray(value.includedServices) ? value.includedServices.filter(isRecord)
        .filter((item) => typeof item.name === "string" && typeof item.description === "string")
        .map((item) => ({ name: item.name as string, description: item.description as string })) : [],
      // Spec 04 wrap-up plan + frozen installments: only on checkouts stored
      // with a plan and cleanup months. Anything malformed reads as legacy.
      ...(() => {
        if (typeof value.cleanupMonths !== "number" || value.cleanupMonths <= 0) return {};
        const cleanupPlan = parseStoredCleanupPlan(value.cleanupPlan);
        const cleanupInstallments = parseStoredCleanupInstallments(value.cleanupInstallments);
        if (!cleanupPlan || !cleanupInstallments) return {};
        return { cleanupPlan, cleanupInstallments };
      })(),
    } : {}),
  };
}

export interface BundleCheckoutAmounts {
  /** Monthly obligation for the selected tier: the tier's bundleMonthly. */
  bundleMonthly: number;
  /** One-time new-file setup charges, due today alongside onboarding. */
  setupTotal: number;
}

/**
 * Spec 02 bundle amounts for a published snapshot. Returns null for legacy
 * proposals so they price exactly as today.
 *
 * The monthly obligation is the tier's bundleMonthly, already baked into
 * published pricing by the snapshot wiring — read from the snapshot's one
 * bundle object and verified against the published monthly. When they
 * disagree the snapshot predates the bundle wiring (or was hand-edited), so
 * the recomputed bundleMonthly wins over a stale published number.
 */
export function resolveBundleCheckoutAmounts(
  publishedSnapshot: unknown,
  tier: ProposalCheckoutTier,
): BundleCheckoutAmounts | null {
  if (!isRecord(publishedSnapshot)) return null;
  const assessment = isRecord(publishedSnapshot.assessment) ? publishedSnapshot.assessment : {};
  const pricing = isRecord(publishedSnapshot.pricing) ? publishedSnapshot.pricing : {};
  const tierPricing = isRecord(pricing[tier]) ? pricing[tier] : {};
  const publishedMonthly = money(finiteNumber(tierPricing.monthly));
  const resolved = resolveCompanyBundleForTier({
    pricing,
    packageId: tier,
    companies: assessment.companies,
    baseAssessment: effectiveAssessment(assessment as unknown as AssessmentState),
    options: resolveBundlePricingOptions(assessment),
  });
  if (!resolved) return null;
  return {
    bundleMonthly: resolved.bundleMonthly === publishedMonthly ? publishedMonthly : resolved.bundleMonthly,
    setupTotal: resolved.setupTotal,
  };
}

export function buildProposalCheckoutSummary(
  publishedSnapshot: unknown,
  selection: ProposalCheckoutSelection,
  opts?: { todayISO?: string },
): ProposalCheckoutSummary {
  if (!isRecord(publishedSnapshot)) throw new Error("Published offer snapshot is missing.");
  const assessment = isRecord(publishedSnapshot.assessment) ? publishedSnapshot.assessment : {};
  const pricing = isRecord(publishedSnapshot.pricing) ? publishedSnapshot.pricing : {};
  const selectedTierPricing = pricing[selection.tier];
  const tierPricing: Record<string, unknown> = isRecord(selectedTierPricing) ? selectedTierPricing : {};
  const maintainPricing: Record<string, unknown> = isRecord(pricing.maintain) ? pricing.maintain : {};
  const bundle = resolveBundleCheckoutAmounts(publishedSnapshot, selection.tier);
  const baseMonthlyTotal = money(bundle ? bundle.bundleMonthly : finiteNumber(tierPricing.monthly));
  const isTestProposal = publishedSnapshot.isTestProposal === true || assessment.isTestProposal === true;

  // Test proposals intentionally have no recurring price. They still exercise
  // the full public selection/signing flow with a one-dollar charge.
  if (isTestProposal) {
    const normalized = {
      tier: selection.tier,
      hasTwelveMonthAgreement: selection.hasTwelveMonthAgreement,
      selectedCleanupPeriodKeys: [],
      selectedAdditionalOptionIds: [],
      tierLabel: selection.tier[0].toUpperCase() + selection.tier.slice(1),
      baseMonthlyTotal: 0,
      recurringMonthlyTotal: 0,
      cleanupTotal: 0,
      onboardingFee: 0,
      oneTimeTotal: 1,
      amountDueNow: 1,
      chargeKind: "onboarding" as const,
      paymentScheduleVersion: 2 as const,
      cleanupMonths: 0,
      cleanupMonthlyRate: 0,
      additionalOneTimeTotal: 0,
      includedServices: proposalIncludedServices(assessment, selection.tier),
    };
    const selectionHash = createHash("sha256").update(JSON.stringify(normalized)).digest("hex");
    return { ...normalized, selectionHash };
  }

  if (baseMonthlyTotal <= 0) throw new Error("The selected package does not have valid published pricing.");

  const annualSavingsPercent = Math.min(100, Math.max(0, finiteNumber(assessment.annualSavingsPercent, 20)));
  // On a 12-month agreement the discount covers every recurring line, add-ons
  // included, and the year is prepaid today.
  const annualDiscountMultiplier = selection.hasTwelveMonthAgreement
    ? 1 - annualSavingsPercent / 100
    : 1;

  const availableAdditionalOptions = new Map(
    proposalServiceAddOns(assessment)
      .filter((option) => option.packageIds.includes(selection.tier))
      .map((option) => [option.id, option]),
  );
  // Required add-ons are charged whether or not the client's selection lists them.
  const requiredAdditionalOptionIds = [...availableAdditionalOptions.values()]
    .filter((option) => option.required)
    .map((option) => option.id);
  const selectedAdditionalOptionIds = [...new Set([...selection.selectedAdditionalOptionIds, ...requiredAdditionalOptionIds])]
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
  // Spec 05: the sized migration total rides the snapshot's one priced
  // object (never recomputed). Legacy snapshots carry none and add zero.
  // The suppressed flat option can never stack: it is absent from
  // `availableAdditionalOptions` (proposalServiceAddOns), so the id filter
  // above drops it even when a stored selection still lists it.
  const storedMigration = toPublicDesktopMigration(
    isRecord(pricing) ? pricing.desktopMigration : null,
  );
  const migrationOneTimeTotal = storedMigration?.total ?? 0;
  const additionalOneTimeTotal = selectedAdditionalOptionIds.reduce(
    (total, id) => {
      const option = availableAdditionalOptions.get(id);
      return option?.billingCadence === "one-time"
        ? total + finiteNumber(option.monthlyPrice)
        : total;
    },
    // One-time new-file setup charges are due today alongside onboarding.
    (bundle ? bundle.setupTotal : 0) + migrationOneTimeTotal,
  );
  const recurringMonthlyTotal = money((baseMonthlyTotal + additionalMonthlyTotal) * annualDiscountMultiplier);

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
  // Spec 04: when the snapshot carries a wrap-up plan, the month count is the
  // sum of SELECTED periods (the count the client explicitly approves, via
  // the shared helper). Without a plan the legacy envelope count stays, so
  // proposals without a plan price exactly as today.
  const rawCleanupPlan = isRecord(assessment.cleanupPlan) ? assessment.cleanupPlan : null;
  const selectedCleanupMonths = rawCleanupPlan
    ? cleanupMonthsFromSelectedPeriods(
        periods.map((period, index) => ({
          id: typeof period.id === "string" && period.id.length > 0 ? period.id : `period-${index}`,
          year: finiteNumber(period.year),
          startMonth: finiteNumber(period.startMonth),
          endMonth: finiteNumber(period.endMonth),
        })),
        selection.selectedCleanupPeriodKeys,
      )
    : selectedCleanupPeriodKeys.reduce((total, key) => {
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
  // Spec 03: the complexity cleanup weight (commingling + loans/MCA) rides
  // the checkout cleanup estimate as its own add, read from the published
  // snapshot's maintain-tier lines — never recomputed. Only when the client
  // selected cleanup months; amountDueNow semantics are unchanged (the
  // estimate is never charged today).
  const publishedMaintain = isRecord(pricing.maintain) ? pricing.maintain : {};
  const publishedComplexity = isRecord(publishedMaintain.complexity) ? publishedMaintain.complexity : {};
  const complexityCleanupPerMonth = finiteNumber(publishedComplexity.cleanupPerMonthTotal);
  const complexityCleanupAdd = money(complexityCleanupPerMonth * selectedCleanupMonths);
  const { cleanupTotal, oneTimeTotal, amountDueNow, amountDueBeforeCredit, creditApplied, prepaidMonths } = proposalPaymentSchedule({
    cleanupMonths: selectedCleanupMonths, cleanupMonthlyRate: maintainMonthly,
    onboardingFee, additionalOneTimeTotal, recurringMonthlyTotal,
    annualPrepay: selection.hasTwelveMonthAgreement,
    creditApplied: money(finiteNumber(assessment.firstPaymentCredit)),
  });
  const cleanupTotalWithComplexity = money(cleanupTotal + complexityCleanupAdd);
  // Spec 04: store the wrap-up plan + frozen installments only when the
  // snapshot had a plan and months were selected. The plan is refreshed for
  // the selection date (M1 caught-up-through from the selected periods, M3
  // start = selection + 14 days with stale overrides reset and flagged)
  // and installments are cut from the stored cleanup total, complexity add
  // included. amountDueNow semantics are untouched — nothing for cleanup
  // is charged today.
  // Firm-Chicago calendar date anchors both the plan refresh and the Spec 06
  // start-month default, so the two can never disagree within one selection.
  const todayISO = opts?.todayISO ?? staffDateKey(new Date());
  const normalizedCleanupPlan = rawCleanupPlan && selectedCleanupMonths > 0
    ? refreshCleanupPlanAtSelection(rawCleanupPlan, {
        backlogMonths: selectedCleanupMonths,
        selectedKeys: selectedCleanupPeriodKeys,
        todayISO,
      })
    : null;
  const storedCleanupInstallments = normalizedCleanupPlan
    ? buildCleanupInstallments(Math.round(cleanupTotalWithComplexity * 100), normalizedCleanupPlan)
    : null;
  const chargeKind: ProposalCheckoutSummary["chargeKind"] = selectedCleanupMonths > 0
    ? "onboarding_and_discovery"
    : onboardingFee > 0 ? "onboarding_and_first_month" : "first_month";

  // Spec 06 carry-over: the capped deduction stays today's payment (math
  // unchanged); the excess is stored for the next invoice instead of dropped.
  const carry = creditCarryover({
    firstPaymentCredit: finiteNumber(assessment.firstPaymentCredit),
    amountDueBeforeCredit,
    reason: assessment.firstPaymentCreditReason,
  });
  // Spec 06 start month: always frozen at selection time. An explicit staff
  // month wins without cleanup; with a cleanup plan the wrap-up month always
  // wins (an explicit month is ignored); otherwise the Chicago default for
  // the selection date. Pre-selection surfaces never show a live default
  // (staleness rule) — the frozen checkout month is the single source after
  // selection. Legacy checkouts (stored before this shipped) carry no key.
  const hasExplicitStartMonth = isServiceStartMonth(assessment.serviceStartMonth);
  const resolvedStartMonth = resolveServiceStartMonth({
    hasCleanup: selectedCleanupMonths > 0,
    plan: normalizedCleanupPlan,
    startMonth: hasExplicitStartMonth ? (assessment.serviceStartMonth as string) : null,
  }, { todayISO });
  // Spec 06 credit reason: the client-readable reason rides the checkout
  // whenever a credit with a reason exists — even when fully applied with no
  // remainder — so a later waiver that creates a remainder keeps it.
  const storedCreditReason = typeof assessment.firstPaymentCreditReason === "string"
    ? assessment.firstPaymentCreditReason.trim()
    : "";
  const hasCreditWithReason = money(finiteNumber(assessment.firstPaymentCredit)) > 0 && storedCreditReason.length > 0;

  const normalized = {
    tier: selection.tier,
    hasTwelveMonthAgreement: selection.hasTwelveMonthAgreement,
    selectedCleanupPeriodKeys,
    selectedAdditionalOptionIds,
    tierLabel: selection.tier[0].toUpperCase() + selection.tier.slice(1),
    baseMonthlyTotal,
    recurringMonthlyTotal,
    cleanupTotal: cleanupTotalWithComplexity,
    onboardingFee,
    oneTimeTotal,
    amountDueNow,
    chargeKind,
    prepaidMonths,
    // Only present when a credit applies, so selections without one hash exactly as before.
    ...(creditApplied > 0 ? { creditApplied, amountDueBeforeCredit } : {}),
    // Spec 06: stored only when an excess remains (legacy: absent).
    // amountDueNow is unchanged — the capped deduction above is still today's
    // payment.
    ...(carry.creditRemaining > 0 ? {
      creditRemaining: carry.creditRemaining,
      creditRemainingReason: carry.creditRemainingReason,
    } : {}),
    // Spec 06 reason (legacy: absent unless a remainder carried one).
    ...(hasCreditWithReason ? { firstPaymentCreditReason: storedCreditReason } : {}),
    // Spec 06 start month, always frozen (legacy: absent).
    serviceStartMonth: resolvedStartMonth,
    // Only present when a complexity cleanup add applies (legacy: absent).
    ...(complexityCleanupAdd > 0 ? { complexityCleanupAdd } : {}),
    // Only present when the snapshot had a cleanupPlan and months were
    // selected (legacy: absent, so stored terms hash exactly as before).
    ...(normalizedCleanupPlan && storedCleanupInstallments
      ? { cleanupPlan: normalizedCleanupPlan, cleanupInstallments: storedCleanupInstallments }
      : {}),
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
  const beforeCredit = money((checkout.amountDueBeforeCredit ?? checkout.amountDueNow) - checkout.onboardingFee);
  // Spec 06: the gross credit is applied + remainder, so a waiver that
  // shrinks today's amount re-caps the deduction AND grows the carry-over
  // instead of dropping the difference. Legacy credit checkouts (no
  // remainder) re-cap exactly as before.
  const grossCredit = money((checkout.creditApplied ?? 0) + (checkout.creditRemaining ?? 0));
  const creditApplied = Math.min(grossCredit, beforeCredit);
  const creditRemaining = money(grossCredit - creditApplied);
  const waived = {
    ...checkout,
    onboardingFee: 0,
    oneTimeTotal: money(checkout.oneTimeTotal - checkout.onboardingFee),
    amountDueNow: money(beforeCredit - creditApplied),
    ...(checkout.creditApplied || checkout.creditRemaining ? {
      creditApplied,
      amountDueBeforeCredit: beforeCredit,
      ...(creditRemaining > 0 ? {
        creditRemaining,
        // Always written with a remainder ("" when the remainder was created
        // by this waiver and no reason was stored), so the acceptance chain
        // never loses the amount. A waiver-created remainder inherits the
        // carried credit reason when no remainder reason was stored.
        // firstPaymentCreditReason only when stored.
        creditRemainingReason: typeof checkout.creditRemainingReason === "string"
          ? checkout.creditRemainingReason
          : typeof checkout.firstPaymentCreditReason === "string"
            ? checkout.firstPaymentCreditReason
            : "",
        ...(typeof checkout.firstPaymentCreditReason === "string" && checkout.firstPaymentCreditReason
          ? { firstPaymentCreditReason: checkout.firstPaymentCreditReason }
          : {}),
      } : {}),
    } : {}),
    chargeKind: (checkout.paymentScheduleVersion === 2 && (checkout.cleanupMonths ?? 0) > 0
      ? "onboarding_and_discovery"
      : checkout.cleanupTotal > 0 ? "cleanup" : "first_month") as ProposalCheckoutSummary["chargeKind"],
  };
  return {
    ...waived,
    selectionHash: createHash("sha256").update(JSON.stringify(waived)).digest("hex"),
  };
}
