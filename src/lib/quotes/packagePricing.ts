/**
 * Pure package-pricing core for the offers builder (Spec 02 / P1).
 *
 * Moved verbatim out of `ProposalCreationWorkspaceDemo.tsx` (no behaviour
 * change): per-package pricing configs, the ceil-to-$5 rounding, the monthly
 * breakdown, the tier pricer, the derived complexity level, and the grow
 * override (grow = ceil5(maintain x 1.5)). No React here, so the company
 * bundle pricer and unit tests can reuse it without rendering anything.
 *
 * `PackageId` intentionally repeats the three literals from
 * `proposalPackageNames.ts` instead of importing that UI module: the two
 * unions are structurally identical, so any drift fails to compile at the
 * call sites that pass one where the other is expected.
 *
 * Spec 03 imports the complexity-drivers contract (`complexityDrivers.ts`),
 * which itself imports this module's constants for tier scaling — a cycle
 * that is safe because both sides only call across it inside functions,
 * never at module-eval time.
 */
import {
  complexityGrowMonthlyTotal,
  hasComplexitySelection,
  normalizeComplexitySelection,
  priceComplexityDrivers,
  type ComplexityDriverDefaultsPatch,
  type ComplexityPriceResult,
} from "./complexityDrivers";
export type PackageId = "grow" | "improve" | "maintain";

export type CountValue = number | "";

export type DemoComplexityLevel = "standard" | "complex" | "advanced";

export type ThresholdAmount = Array<{ min: number; amount: number }>;

export interface DemoPricingConfig {
  recurringPerProperty: number;
  recurringPerEntity: number;
  recurringComplexity: Record<DemoComplexityLevel, number>;
  transactionBandMonthly: Record<"0-99" | "100-499" | "500-999" | "1000+" | "unknown", number>;
  staffingPerPerson: number;
  reconciliationThresholds: ThresholdAmount;
  platformThresholds: ThresholdAmount;
  passThroughThresholds: ThresholdAmount;
  mixedBooksMonthly: number;
  nonReBusinessMonthly: number;
  complexOperationsMonthly: number;
  multiOperationMonthly: number;
  backlogPerProperty: number;
  backlogPerEntity: number;
  catchUpComplexityMultiplier: Record<DemoComplexityLevel, number>;
}

/** Pricing-relevant slice of the builder assessment (structural: the full AssessmentState satisfies it). */
export interface PackagePricingInputs {
  /** Spec 03 main-company (or synthetic per-company) complexity selection, raw. Absent = legacy pricing. */
  complexity?: unknown;
  /** Spec 03 options-template complexity driver defaults applied to the proposal (sparse patch). */
  complexityDriverDefaults?: unknown;
  /** Spec 03 presence inputs for existing-line drivers. Omitted = present (legacy "Included" behaviour). */
  offerSalesTaxFiling?: boolean;
  offerProjectTracking?: boolean;
  bookSetType: string;
  realEstateOperations: string[];
  transactionBand: string;
  numberOfProperties: CountValue;
  numberOfEntities: CountValue;
  employeesCount: CountValue;
  contractorsCount: CountValue;
  bankAccountsCount: CountValue;
  creditCardsCount: CountValue;
  unconnectedBankAccountsCount: CountValue;
  unconnectedCreditCardsCount: CountValue;
  paymentPlatforms: string[];
  zeroBalancePlatformCount: CountValue;
  loansCount: CountValue;
  vehicleNotesCount: CountValue;
  linesOfCreditCount: CountValue;
  unconnectedLinesOfCreditCount: CountValue;
  historicalCleanupPeriods: Array<{ purchasedOrSoldPropertiesCount?: CountValue }>;
  cleanupPurchasedOrSoldPropertiesCount: CountValue;
  discretionaryMultiplier: number;
}

/** Per-package price book (id + base monthly + tuning), without any presentation fields. */
export interface PackagePricingSpec {
  id: PackageId;
  monthlyPrice: number;
  pricing: DemoPricingConfig;
}

export interface PackagePricingSummary {
  packageId: PackageId;
  complexityLevel: DemoComplexityLevel;
  monthly: number;
  catchUpBase: number;
  assessmentOneTimeAdjustments: number;
  totalOneTimeBeforeManual: number;
  totalOneTime: number;
  /**
   * Spec 03 priced complexity lines for this tier. Present ONLY when the
   * assessment carries a complexity selection with at least one checked
   * driver — legacy pricing objects never gain this key, so golden
   * snapshots stay byte-identical.
   */
  complexity?: ComplexityPriceResult;
}

export interface MonthlyRateBreakdownItem {
  label: string;
  amount: number;
}

export const GROW_PRICE_MULTIPLIER_FROM_MAINTAIN = 1.5;

export const CLEANUP_PURCHASED_OR_SOLD_PROPERTY_COST = 200;

export const PACKAGE_PRICING: Record<PackageId, PackagePricingSpec> = {
  grow: {
    id: "grow",
    monthlyPrice: 250,
    pricing: {
      recurringPerProperty: 50,
      recurringPerEntity: 175,
      recurringComplexity: { standard: 0, complex: 275, advanced: 600 },
      transactionBandMonthly: { "0-99": 0, "100-499": 120, "500-999": 260, "1000+": 480, unknown: 0 },
      staffingPerPerson: 60,
      reconciliationThresholds: [
        { min: 6, amount: 90 },
        { min: 12, amount: 180 },
        { min: 20, amount: 320 },
      ],
      platformThresholds: [
        { min: 1, amount: 70 },
        { min: 3, amount: 140 },
      ],
      passThroughThresholds: [
        { min: 1, amount: 85 },
        { min: 3, amount: 170 },
      ],
      mixedBooksMonthly: 225,
      nonReBusinessMonthly: 325,
      complexOperationsMonthly: 190,
      multiOperationMonthly: 110,
      backlogPerProperty: 40,
      backlogPerEntity: 100,
      catchUpComplexityMultiplier: { standard: 0, complex: 0.2, advanced: 0.35 },
    },
  },
  improve: {
    id: "improve",
    monthlyPrice: 250,
    pricing: {
      recurringPerProperty: 50,
      recurringPerEntity: 125,
      recurringComplexity: { standard: 0, complex: 200, advanced: 450 },
      transactionBandMonthly: { "0-99": 0, "100-499": 90, "500-999": 200, "1000+": 360, unknown: 0 },
      staffingPerPerson: 45,
      reconciliationThresholds: [
        { min: 6, amount: 70 },
        { min: 12, amount: 140 },
        { min: 20, amount: 260 },
      ],
      platformThresholds: [
        { min: 1, amount: 55 },
        { min: 3, amount: 110 },
      ],
      passThroughThresholds: [
        { min: 1, amount: 65 },
        { min: 3, amount: 140 },
      ],
      mixedBooksMonthly: 175,
      nonReBusinessMonthly: 250,
      complexOperationsMonthly: 150,
      multiOperationMonthly: 90,
      backlogPerProperty: 30,
      backlogPerEntity: 75,
      catchUpComplexityMultiplier: { standard: 0, complex: 0.15, advanced: 0.25 },
    },
  },
  maintain: {
    id: "maintain",
    monthlyPrice: 250,
    pricing: {
      recurringPerProperty: 50,
      recurringPerEntity: 100,
      recurringComplexity: { standard: 0, complex: 150, advanced: 350 },
      transactionBandMonthly: { "0-99": 0, "100-499": 70, "500-999": 150, "1000+": 280, unknown: 0 },
      staffingPerPerson: 35,
      reconciliationThresholds: [
        { min: 6, amount: 50 },
        { min: 12, amount: 110 },
        { min: 20, amount: 200 },
      ],
      platformThresholds: [
        { min: 1, amount: 40 },
        { min: 3, amount: 80 },
      ],
      passThroughThresholds: [
        { min: 1, amount: 50 },
        { min: 3, amount: 110 },
      ],
      mixedBooksMonthly: 130,
      nonReBusinessMonthly: 200,
      complexOperationsMonthly: 120,
      multiOperationMonthly: 70,
      backlogPerProperty: 20,
      backlogPerEntity: 50,
      catchUpComplexityMultiplier: { standard: 0, complex: 0.1, advanced: 0.2 },
    },
  },
};

export function roundUpToNearestIncrement(value: number, increment = 5) {
  if (!Number.isFinite(value) || increment <= 0) return value;
  return Math.ceil(value / increment) * increment;
}

export function countValue(value: CountValue) {
  return typeof value === "number" ? value : 0;
}

const TRANSACTION_BAND_SCORES: Array<{ value: string; score: number }> = [
  { value: "", score: 0 },
  { value: "0-99", score: 0 },
  { value: "100-499", score: 1 },
  { value: "500-999", score: 2 },
  { value: "1000+", score: 3 },
  { value: "unknown", score: 0 },
];

export function transactionBandScore(band: string) {
  return TRANSACTION_BAND_SCORES.find((option) => option.value === band)?.score ?? 0;
}

export function amountForThreshold(value: number, thresholds: ThresholdAmount) {
  return thresholds.reduce((current, threshold) => {
    return value >= threshold.min ? threshold.amount : current;
  }, 0);
}

export function hasComplexRealEstateOperations(assessment: PackagePricingInputs) {
  return (
    assessment.realEstateOperations.includes("short-term-rentals") ||
    assessment.realEstateOperations.includes("flips") ||
    assessment.realEstateOperations.includes("development")
  );
}

export function reconciliationAccountCount(assessment: PackagePricingInputs) {
  return (
    countValue(assessment.bankAccountsCount) +
    countValue(assessment.creditCardsCount) +
    countValue(assessment.unconnectedBankAccountsCount) +
    countValue(assessment.unconnectedCreditCardsCount) +
    countValue(assessment.loansCount) +
    countValue(assessment.vehicleNotesCount) +
    countValue(assessment.linesOfCreditCount) +
    countValue(assessment.unconnectedLinesOfCreditCount)
  );
}

export function paymentPlatformComplexityCount(assessment: PackagePricingInputs) {
  return (
    effectiveKnownPlatforms(assessment).filter((platform) => platform !== "unknown").length +
    countValue(assessment.zeroBalancePlatformCount)
  );
}

export function knownRealEstateOperationCount(assessment: PackagePricingInputs) {
  return assessment.realEstateOperations.filter((operation) => operation !== "unknown").length;
}

export function knownPaymentPlatformCount(assessment: PackagePricingInputs) {
  return effectiveKnownPlatforms(assessment).filter((platform) => platform !== "unknown").length;
}

/**
 * Spec 03 payout-channel guard (lead ruling: a store's own payout channel
 * listed both as store and as a payment platform counts ONCE, store wins,
 * with a hint). The channel is NEVER guessed from the store name: the
 * online-store / pos-system driver carries an explicit optional
 * `payoutPlatform` (the checklist "Payouts come through" select lists the
 * platforms already on the assessment). Pricing excludes exactly that
 * platform from the platform count; without a choice the platform stays
 * charged even when the names look alike (a genuinely separate Stripe
 * account must never be swallowed by a name match).
 *
 * Returns the claimed platform values listed on the assessment
 * (online-store claim first, so the store wins), each once. `unknown` and
 * empty claims never match.
 */
export function payoutChannelExclusions(input: {
  paymentPlatforms: readonly unknown[];
  complexity: unknown;
}): string[] {
  const platforms = Array.isArray(input.paymentPlatforms) ? input.paymentPlatforms : [];
  const selection = normalizeComplexitySelection(input.complexity);
  const excluded: string[] = [];
  for (const id of ["online_store", "pos_system"] as const) {
    const driver = selection.drivers[id];
    if (driver.checked !== true || !driver.payoutPlatform) continue;
    const claim = driver.payoutPlatform;
    if (claim === "unknown") continue;
    if (!platforms.includes(claim)) continue;
    if (!excluded.includes(claim)) excluded.push(claim);
  }
  return excluded;
}

/**
 * First counted-once payout channel (the store wins), or null. The
 * checklist uses this for its counted-once hint; pricing excludes the full
 * `payoutChannelExclusions` list.
 */
export function onlineStorePayoutOverlap(input: {
  paymentPlatforms: readonly unknown[];
  complexity: unknown;
}): string | null {
  return payoutChannelExclusions(input)[0] ?? null;
}

/**
 * Shopify suggestion hint (no pricing effect): the store name contains
 * "shopify" and Stripe is listed as a payment platform, but no payout
 * channel is chosen. The checklist suggests choosing Stripe when the
 * store really pays out through it — it never excludes on its own.
 */
export function shopifyPayoutSuggestion(input: {
  paymentPlatforms: readonly unknown[];
  complexity: unknown;
}): boolean {
  const platforms = Array.isArray(input.paymentPlatforms) ? input.paymentPlatforms : [];
  if (!platforms.includes("stripe")) return false;
  const selection = normalizeComplexitySelection(input.complexity);
  const store = selection.drivers.online_store;
  if (store.checked !== true || !store.name || !/shopify/i.test(store.name)) return false;
  if (store.payoutPlatform) return false;
  const pos = selection.drivers.pos_system;
  if (pos.checked === true && pos.payoutPlatform === "stripe") return false;
  return true;
}

/** Payment platforms minus counted-once payout channels (legacy: unchanged). */
function effectiveKnownPlatforms(assessment: PackagePricingInputs): string[] {
  const excluded = payoutChannelExclusions({
    paymentPlatforms: assessment.paymentPlatforms,
    complexity: assessment.complexity,
  });
  return excluded.length > 0
    ? assessment.paymentPlatforms.filter((platform) => !excluded.includes(platform))
    : assessment.paymentPlatforms;
}

/**
 * Spec 03 presence for existing-line drivers, from the assessment slice the
 * pipeline already carries. Omitted add-on flags default to present (the
 * contract's legacy "Included" behaviour); the books-type and staffing lines
 * derive from the pricing inputs themselves, so synthetic per-company inputs
 * (no headcount, no books type) honestly report those lines absent.
 */
function complexityExistingPresence(assessment: PackagePricingInputs): {
  salesTaxAddon: boolean;
  projectTrackingAddon: boolean;
  mixedBooks: boolean;
  staffingHeadcount: number;
} {
  return {
    salesTaxAddon: assessment.offerSalesTaxFiling ?? true,
    projectTrackingAddon: assessment.offerProjectTracking ?? true,
    mixedBooks: assessment.bookSetType === "mixed-books",
    staffingHeadcount: countValue(assessment.employeesCount) + countValue(assessment.contractorsCount),
  };
}

/**
 * The one additive Spec 03 hook: null when the assessment carries no
 * complexity selection (legacy path, byte-identical), otherwise the priced
 * result for this tier. New-driver monthlies add into the base monthly;
 * grow tier pricing flows through the existing grow override downstream.
 */
function priceComplexityForInputs(
  packageId: PackageId,
  assessment: PackagePricingInputs,
  cleanupMonths: number,
): ComplexityPriceResult | null {
  if (!hasComplexitySelection(assessment.complexity)) return null;
  return priceComplexityDrivers(normalizeComplexitySelection(assessment.complexity), {
    packageId,
    // Sanitized inside `resolveComplexityDriverDefaults`; the cast only
    // bridges the unknown-typed assessment slice.
    defaults: assessment.complexityDriverDefaults as ComplexityDriverDefaultsPatch | undefined,
    cleanupMonths,
    existing: complexityExistingPresence(assessment),
  });
}

export function derivedPricingComplexityLevel(assessment: PackagePricingInputs): DemoComplexityLevel {
  const txScore = transactionBandScore(assessment.transactionBand);
  const headcount = countValue(assessment.employeesCount) + countValue(assessment.contractorsCount);
  const reconciliationCount = reconciliationAccountCount(assessment);
  const platformComplexity = paymentPlatformComplexityCount(assessment);
  const hasComplexOperations = hasComplexRealEstateOperations(assessment);

  let score = 0;
  score += txScore;
  if (countValue(assessment.numberOfProperties) >= 10) score += 2;
  else if (countValue(assessment.numberOfProperties) >= 4) score += 1;
  if (countValue(assessment.numberOfEntities) >= 3) score += 2;
  else if (countValue(assessment.numberOfEntities) >= 2) score += 1;
  if (headcount >= 8) score += 2;
  else if (headcount >= 3) score += 1;
  if (reconciliationCount >= 16) score += 2;
  else if (reconciliationCount >= 8) score += 1;
  if (platformComplexity >= 4) score += 2;
  else if (platformComplexity >= 2) score += 1;
  if (hasComplexOperations) score += 2;
  else if (knownRealEstateOperationCount(assessment) >= 2) score += 1;
  if (assessment.bookSetType === "mixed-books") score += 2;
  if (assessment.bookSetType === "other-business") score += 1;

  if (score >= 9) return "advanced";
  if (score >= 4) return "complex";
  return "standard";
}

export function getMonthlyRateBreakdown(
  pkg: PackagePricingSpec,
  assessment: PackagePricingInputs,
  complexityLevel: DemoComplexityLevel,
) {
  const propertyCount = countValue(assessment.numberOfProperties);
  const entityCount = countValue(assessment.numberOfEntities);
  const headcount = countValue(assessment.employeesCount) + countValue(assessment.contractorsCount);
  const reconciliationCount = reconciliationAccountCount(assessment);
  const platformCount = knownPaymentPlatformCount(assessment);
  const passThroughCount = countValue(assessment.zeroBalancePlatformCount);
  const hasComplexOperations = hasComplexRealEstateOperations(assessment);
  const multipleOperations = knownRealEstateOperationCount(assessment) >= 2;
  const transactionBandMonthly = assessment.transactionBand
    ? pkg.pricing.transactionBandMonthly[
        assessment.transactionBand as keyof DemoPricingConfig["transactionBandMonthly"]
      ]
    : 0;
  const staffingAmount = headcount * pkg.pricing.staffingPerPerson;
  const reconciliationAmount = amountForThreshold(
    reconciliationCount,
    pkg.pricing.reconciliationThresholds,
  );
  const platformAmount = amountForThreshold(platformCount, pkg.pricing.platformThresholds);
  const passThroughAmount = amountForThreshold(
    passThroughCount,
    pkg.pricing.passThroughThresholds,
  );
  const booksTypeAmount =
    assessment.bookSetType === "mixed-books"
      ? pkg.pricing.mixedBooksMonthly
      : assessment.bookSetType === "other-business"
        ? pkg.pricing.nonReBusinessMonthly
        : 0;
  const operationsAmount = hasComplexOperations
    ? pkg.pricing.complexOperationsMonthly
    : !hasComplexOperations && multipleOperations
      ? pkg.pricing.multiOperationMonthly
      : 0;
  // Spec 03: new-driver monthlies add into the base monthly. Null on legacy
  // assessments (no selection), so the total below is unchanged for them.
  const complexity = priceComplexityForInputs(pkg.id, assessment, 0);
  const complexityMonthly = complexity?.monthlyTotal ?? 0;
  const baseMonthly =
    pkg.monthlyPrice +
    propertyCount * pkg.pricing.recurringPerProperty +
    entityCount * pkg.pricing.recurringPerEntity +
    pkg.pricing.recurringComplexity[complexityLevel] +
    transactionBandMonthly +
    staffingAmount +
    reconciliationAmount +
    platformAmount +
    passThroughAmount +
    booksTypeAmount +
    operationsAmount +
    complexityMonthly;
  const multiplierDeltaAmount =
    Math.round((baseMonthly * assessment.discretionaryMultiplier - baseMonthly) * 100) / 100;

  const baseItems: MonthlyRateBreakdownItem[] = [
    { label: "Base monthly package", amount: pkg.monthlyPrice },
    {
      label: `${propertyCount} properties`,
      amount: propertyCount * pkg.pricing.recurringPerProperty,
    },
    {
      label: `${entityCount} additional entities`,
      amount: entityCount * pkg.pricing.recurringPerEntity,
    },
    {
      label: `Complexity (${complexityLevel})`,
      amount: pkg.pricing.recurringComplexity[complexityLevel],
    },
    { label: "Transaction volume", amount: transactionBandMonthly },
    { label: "Staffing", amount: staffingAmount },
    { label: "Reconciliation load", amount: reconciliationAmount },
    { label: "Connected platforms", amount: platformAmount },
    { label: "Pass-through accounts", amount: passThroughAmount },
    { label: "Books type adjustment", amount: booksTypeAmount },
    { label: "Operations adjustment", amount: operationsAmount },
    // Spec 03: one breakdown row per charged driver ("Why this price" names
    // the same labels). Included/waiting existing-line drivers price $0 and
    // stay out of the breakdown. Legacy: no items, list identical.
    ...(complexity?.lines ?? [])
      .filter((line) => line.monthly > 0)
      .map((line) => ({ label: `Complexity — ${line.label}`, amount: line.monthly })),
  ].filter((item) => item.amount > 0);

  const adjustmentItems: MonthlyRateBreakdownItem[] = [
    {
      label: `Discretionary multiplier (${assessment.discretionaryMultiplier.toFixed(2)}x)`,
      amount: multiplierDeltaAmount,
    },
  ].filter((item) => item.amount !== 0);

  return { baseItems, adjustmentItems };
}

export function buildPackagePricing(
  pkg: PackagePricingSpec,
  assessment: PackagePricingInputs,
  cleanupMonths: number,
  manualAdjustmentAmount: number,
): PackagePricingSummary {
  const complexityLevel = derivedPricingComplexityLevel(assessment);
  const propertyCount = countValue(assessment.numberOfProperties);
  const entityCount = countValue(assessment.numberOfEntities);
  const reconciliationCount = reconciliationAccountCount(assessment);
  const hasYearSpecificPropertyCounts = assessment.historicalCleanupPeriods.some(
    (period) => period.purchasedOrSoldPropertiesCount !== undefined,
  );
  const cleanupPurchasedOrSoldPropertiesCount = hasYearSpecificPropertyCounts
    ? assessment.historicalCleanupPeriods.reduce(
        (total, period) => total + countValue(period.purchasedOrSoldPropertiesCount ?? 0),
        0,
      )
    : countValue(assessment.cleanupPurchasedOrSoldPropertiesCount);
  const hasComplexOperations = hasComplexRealEstateOperations(assessment);
  const multipleOperations = knownRealEstateOperationCount(assessment) >= 2;
  const transactionBandMonthly = assessment.transactionBand
    ? pkg.pricing.transactionBandMonthly[
        assessment.transactionBand as keyof DemoPricingConfig["transactionBandMonthly"]
      ]
    : 0;
  // Spec 03: the one additive hook (null on legacy assessments, so the math
  // below is unchanged for them). The same result rides on the summary so
  // snapshots carry the priced lines per tier.
  const complexity = priceComplexityForInputs(pkg.id, assessment, cleanupMonths);
  const baseMonthly =
    pkg.monthlyPrice +
    propertyCount * pkg.pricing.recurringPerProperty +
    entityCount * pkg.pricing.recurringPerEntity +
    pkg.pricing.recurringComplexity[complexityLevel] +
    transactionBandMonthly +
    (countValue(assessment.employeesCount) + countValue(assessment.contractorsCount)) *
      pkg.pricing.staffingPerPerson +
    amountForThreshold(reconciliationCount, pkg.pricing.reconciliationThresholds) +
    amountForThreshold(knownPaymentPlatformCount(assessment), pkg.pricing.platformThresholds) +
    amountForThreshold(countValue(assessment.zeroBalancePlatformCount), pkg.pricing.passThroughThresholds) +
    (assessment.bookSetType === "mixed-books"
      ? pkg.pricing.mixedBooksMonthly
      : assessment.bookSetType === "other-business"
        ? pkg.pricing.nonReBusinessMonthly
        : 0) +
    (hasComplexOperations ? pkg.pricing.complexOperationsMonthly : 0) +
    (!hasComplexOperations && multipleOperations ? pkg.pricing.multiOperationMonthly : 0) +
    // New-driver monthlies add into the base monthly; grow flows through the
    // existing grow override below.
    (complexity?.monthlyTotal ?? 0);
  const monthly = roundUpToNearestIncrement(baseMonthly * assessment.discretionaryMultiplier);

  const catchUpBase = monthly * cleanupMonths;
  const assessmentOneTimeAdjustments =
    propertyCount * pkg.pricing.backlogPerProperty +
    entityCount * pkg.pricing.backlogPerEntity +
    cleanupPurchasedOrSoldPropertiesCount * CLEANUP_PURCHASED_OR_SOLD_PROPERTY_COST +
    Math.round(catchUpBase * pkg.pricing.catchUpComplexityMultiplier[complexityLevel]);
  const totalOneTimeBeforeManual = roundUpToNearestIncrement(
    catchUpBase + assessmentOneTimeAdjustments,
  );

  // The priced lines for this tier ride on the summary so the published
  // snapshot, the public payload and the agreement read them instead of
  // recomputing. The key is spread in ONLY when a selection exists — legacy
  // summaries keep their exact shape.
  return {
    packageId: pkg.id,
    complexityLevel,
    monthly,
    catchUpBase,
    assessmentOneTimeAdjustments,
    totalOneTimeBeforeManual,
    totalOneTime: roundUpToNearestIncrement(totalOneTimeBeforeManual + manualAdjustmentAmount),
    ...(complexity ? { complexity } : {}),
  };
}

/**
 * Grow override, extracted from the snapshot builder: grow is NOT priced
 * bottom-up — every grow figure is ceil5(maintain x 1.5). The grow
 * complexity figures come from the same rule via
 * `complexityGrowMonthlyTotal` (affirmed here so stored, published and
 * Why-tab figures agree with the charged grow monthly): monthly lines
 * already sum to that total by construction in `priceComplexityDrivers`,
 * and the cleanup total is the total-level ceil5(maintain cleanupTotal
 * x 1.5).
 */
export function applyGrowPriceOverride(
  packagePricing: Record<PackageId, PackagePricingSummary>,
): Record<PackageId, PackagePricingSummary> {
  const maintainPricing = packagePricing.maintain;
  const growComplexity = packagePricing.grow.complexity;
  const maintainComplexity = maintainPricing.complexity;
  const grow: PackagePricingSummary = {
    ...packagePricing.grow,
    monthly: roundUpToNearestIncrement(
      maintainPricing.monthly * GROW_PRICE_MULTIPLIER_FROM_MAINTAIN,
    ),
    catchUpBase: roundUpToNearestIncrement(
      maintainPricing.catchUpBase * GROW_PRICE_MULTIPLIER_FROM_MAINTAIN,
    ),
    assessmentOneTimeAdjustments: roundUpToNearestIncrement(
      maintainPricing.assessmentOneTimeAdjustments * GROW_PRICE_MULTIPLIER_FROM_MAINTAIN,
    ),
    totalOneTimeBeforeManual: roundUpToNearestIncrement(
      maintainPricing.totalOneTimeBeforeManual * GROW_PRICE_MULTIPLIER_FROM_MAINTAIN,
    ),
    totalOneTime: roundUpToNearestIncrement(
      maintainPricing.totalOneTime * GROW_PRICE_MULTIPLIER_FROM_MAINTAIN,
    ),
  };
  if (growComplexity && maintainComplexity) {
    grow.complexity = {
      ...growComplexity,
      monthlyTotal: complexityGrowMonthlyTotal(maintainComplexity.monthlyTotal),
      cleanupTotal: roundUpToNearestIncrement(
        maintainComplexity.cleanupTotal * GROW_PRICE_MULTIPLIER_FROM_MAINTAIN,
      ),
    };
  }
  return { ...packagePricing, grow };
}

/**
 * Zero/default pricing inputs: the base for synthetic per-company
 * assessments. A company's own accounts supply the band and counts; every
 * other driver stays at zero so one file's volume never leaks into another.
 */
export function emptyPackagePricingInputs(): PackagePricingInputs {
  return {
    bookSetType: "",
    realEstateOperations: [],
    transactionBand: "",
    numberOfProperties: 0,
    numberOfEntities: 0,
    employeesCount: 0,
    contractorsCount: 0,
    bankAccountsCount: 0,
    creditCardsCount: 0,
    unconnectedBankAccountsCount: 0,
    unconnectedCreditCardsCount: 0,
    paymentPlatforms: [],
    zeroBalancePlatformCount: 0,
    loansCount: 0,
    vehicleNotesCount: 0,
    linesOfCreditCount: 0,
    unconnectedLinesOfCreditCount: 0,
    historicalCleanupPeriods: [],
    cleanupPurchasedOrSoldPropertiesCount: 0,
    discretionaryMultiplier: 1,
  };
}
