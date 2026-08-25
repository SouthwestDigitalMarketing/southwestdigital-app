import type {
  BaseAmountMultiplierRuleConfig,
  BillingType,
  CleanupBaseAmountRuleConfig,
  ComplexityAmountRuleConfig,
  ComplexityLevel,
  FlatRuleConfig,
  PackageForPricing,
  PerUnitRuleConfig,
  QuoteInputs,
  QuoteLineItemData,
  QuoteTotals,
  TieredRuleConfig,
  UrgencyAmountRuleConfig,
  UrgencyLevel,
} from "./types";

export function transactionVolume(input: QuoteInputs["transaction_volume_estimate"]): number {
  if (typeof input === "number") return input;
  if (input === "low") return 50;
  if (input === "medium") return 150;
  if (input === "high") return 400;
  return 100;
}

function parseMonthIndex(raw: string | undefined): number | null {
  if (!raw) return null;
  const [year, month] = raw.split("-").map(Number);
  if (!Number.isFinite(year) || !Number.isFinite(month) || month < 1 || month > 12) {
    return null;
  }
  return year * 12 + (month - 1);
}

export function resolveCleanupMonths(inputs: QuoteInputs): number {
  const startIndex = parseMonthIndex(inputs.cleanup_start_month);
  const endIndex = parseMonthIndex(inputs.cleanup_end_month);

  if (startIndex !== null && endIndex !== null && endIndex >= startIndex) {
    return endIndex - startIndex + 1;
  }

  return Math.max(0, inputs.cleanup_period_months ?? 0);
}

export function resolveComplexityLevel(input: QuoteInputs["complexity_level"]): ComplexityLevel {
  if (input === "complex" || input === "advanced") return input;
  return "standard";
}

export function resolveUrgencyLevel(input: QuoteInputs["urgency_level"]): UrgencyLevel {
  if (input === "expedited" || input === "rush") return input;
  return "standard";
}

function amountForMappedLevel<TLevel extends string>(
  config: Partial<Record<TLevel, number>>,
  level: TLevel,
): number {
  return Number(config[level] ?? 0);
}

function applyClamp(amount: number, minPrice: number | null, maxPrice: number | null): number {
  let next = amount;
  if (minPrice !== null && next < minPrice) next = minPrice;
  if (maxPrice !== null && next > maxPrice) next = maxPrice;
  return next;
}

export function applyRule(
  ruleType: string,
  configJson: unknown,
  minPrice: number | null,
  maxPrice: number | null,
  inputs: QuoteInputs,
): number {
  const config = (configJson ?? {}) as Record<string, unknown>;
  const cleanupMonths = resolveCleanupMonths(inputs);
  const complexityLevel = resolveComplexityLevel(inputs.complexity_level);
  const urgencyLevel = resolveUrgencyLevel(inputs.urgency_level);
  let amount = 0;

  switch (ruleType) {
    case "base_amount_multiplier": {
      const c = config as BaseAmountMultiplierRuleConfig;
      amount = (inputs.base_amount ?? 0) * Number(c.multiplier ?? 1);
      break;
    }
    case "flat": {
      const c = config as FlatRuleConfig;
      amount = Number(c.amount ?? 0);
      break;
    }
    case "per_property": {
      const c = config as PerUnitRuleConfig;
      amount = Number(c.rate_per_unit ?? 0) * (inputs.number_of_properties ?? 0);
      break;
    }
    case "per_entity": {
      const c = config as PerUnitRuleConfig;
      amount = Number(c.rate_per_unit ?? 0) * (inputs.number_of_entities ?? 0);
      break;
    }
    case "per_transaction": {
      const c = config as PerUnitRuleConfig;
      amount = Number(c.rate_per_unit ?? 0) * transactionVolume(inputs.transaction_volume_estimate);
      break;
    }
    case "per_cleanup_month": {
      const c = config as PerUnitRuleConfig;
      amount = Number(c.rate_per_unit ?? 0) * cleanupMonths;
      break;
    }
    case "cleanup_from_base_amount": {
      const c = config as CleanupBaseAmountRuleConfig;
      amount = (inputs.base_amount ?? 0) * cleanupMonths * Number(c.multiplier ?? 1);
      break;
    }
    case "complexity_flat": {
      const c = config as ComplexityAmountRuleConfig;
      amount = amountForMappedLevel(c, complexityLevel);
      break;
    }
    case "complexity_multiplier": {
      const c = config as ComplexityAmountRuleConfig;
      amount = (inputs.base_amount ?? 0) * amountForMappedLevel(c, complexityLevel);
      break;
    }
    case "urgency_flat": {
      const c = config as UrgencyAmountRuleConfig;
      amount = amountForMappedLevel(c, urgencyLevel);
      break;
    }
    case "urgency_multiplier": {
      const c = config as UrgencyAmountRuleConfig;
      amount = (inputs.base_amount ?? 0) * amountForMappedLevel(c, urgencyLevel);
      break;
    }
    case "tiered": {
      const c = config as TieredRuleConfig;
      const dimension =
        c.dimension === "properties"
          ? (inputs.number_of_properties ?? 0)
          : c.dimension === "entities"
            ? (inputs.number_of_entities ?? 0)
            : c.dimension === "cleanup_months"
              ? cleanupMonths
              : transactionVolume(inputs.transaction_volume_estimate);
      const tier = c.tiers.find((entry) => dimension >= entry.min && dimension <= entry.max);
      amount = tier ? Number(tier.price) : 0;
      break;
    }
    default:
      amount = 0;
  }

  return applyClamp(amount, minPrice, maxPrice);
}

function defaultPackageLabel(scenario: string, packageName: string): string {
  if (scenario === "HISTORICAL_CLEANUP") return "Historical Cleanup Investment";
  if (scenario === "HOURLY_WORK") return "Hourly Bookkeeping Work";
  return packageName || "Monthly Bookkeeping";
}

function defaultRuleLabel(ruleType: string): string {
  switch (ruleType) {
    case "base_amount_multiplier":
      return "Base Package Investment";
    case "flat":
      return "Base Package Investment";
    case "per_property":
      return "Property Count Adjustment";
    case "per_entity":
      return "Entity Count Adjustment";
    case "per_transaction":
      return "Transaction Volume Adjustment";
    case "per_cleanup_month":
      return "Cleanup Month Adjustment";
    case "cleanup_from_base_amount":
      return "Historical Cleanup Investment";
    case "complexity_flat":
    case "complexity_multiplier":
      return "Complexity Adjustment";
    case "urgency_flat":
    case "urgency_multiplier":
      return "Rush Service Adjustment";
    case "tiered":
      return "Tiered Pricing Adjustment";
    default:
      return "Pricing Adjustment";
  }
}

export function cleanupDescription(inputs: QuoteInputs): string | null {
  const cleanupMonths = resolveCleanupMonths(inputs);
  if (!cleanupMonths) return null;

  if (inputs.cleanup_start_month && inputs.cleanup_end_month) {
    return `${inputs.cleanup_start_month} through ${inputs.cleanup_end_month} (${cleanupMonths} months)`;
  }

  return `Approx. ${cleanupMonths}-month cleanup period`;
}

export function createLegacyUrgencyAdjustment(
  lineItems: QuoteLineItemData[],
  urgencyLevel: UrgencyLevel,
): QuoteLineItemData | null {
  if (urgencyLevel === "standard") return null;

  const recurringSubtotal = lineItems
    .filter((item) => item.billingType === "recurring")
    .reduce((sum, item) => sum + item.amount, 0);
  const oneTimeSubtotal = lineItems
    .filter((item) => item.billingType === "one_time")
    .reduce((sum, item) => sum + item.amount, 0);

  const targetBillingType: BillingType =
    recurringSubtotal > 0 ? "recurring" : oneTimeSubtotal > 0 ? "one_time" : "recurring";
  const subtotal = targetBillingType === "recurring" ? recurringSubtotal : oneTimeSubtotal;

  if (subtotal <= 0) return null;

  const multiplier = urgencyLevel === "expedited" ? 1.15 : 1.3;
  const diff = Math.round(subtotal * multiplier) - subtotal;
  if (diff <= 0) return null;

  return {
    label: urgencyLevel === "expedited" ? "Expedited Service Adjustment" : "Rush Service Adjustment",
    description:
      urgencyLevel === "expedited"
        ? "Legacy urgency adjustment applied to the current package subtotal."
        : "Legacy rush adjustment applied to the current package subtotal.",
    amount: diff,
    billingType: targetBillingType,
  };
}

function createRuleLineItem(
  rule: PackageForPricing["pricingRules"][number],
  inputs: QuoteInputs,
): QuoteLineItemData | null {
  const amount = applyRule(
    rule.ruleType,
    rule.configJson,
    rule.minPrice ? Number(rule.minPrice) : null,
    rule.maxPrice ? Number(rule.maxPrice) : null,
    inputs,
  );

  if (amount <= 0) return null;

  const billingType: BillingType = rule.billingType === "one_time" ? "one_time" : "recurring";

  return {
    label: rule.name.trim() || defaultRuleLabel(rule.ruleType),
    description: rule.description?.trim() || null,
    amount,
    billingType,
  };
}

export function basePackageAmount(
  priceMode: string,
  priceValue: number | null | undefined,
  baseAmount: number,
): number {
  if (priceValue === null || priceValue === undefined) return 0;
  if (priceMode === "FIXED") return Number(priceValue);
  return Math.round(baseAmount * Number(priceValue));
}

export function computeQuoteLineItems(
  pkg: PackageForPricing,
  inputs: QuoteInputs,
): { lineItems: QuoteLineItemData[]; totals: QuoteTotals } {
  const lineItems: QuoteLineItemData[] = [];

  if (pkg.pricingRules.length > 0) {
    for (const rule of pkg.pricingRules) {
      const lineItem = createRuleLineItem(rule, inputs);
      if (lineItem) lineItems.push(lineItem);
    }

    const hasExplicitUrgencyRule = pkg.pricingRules.some(
      (rule) => rule.ruleType === "urgency_flat" || rule.ruleType === "urgency_multiplier",
    );
    if (!hasExplicitUrgencyRule) {
      const legacyUrgencyAdjustment = createLegacyUrgencyAdjustment(
        lineItems,
        resolveUrgencyLevel(inputs.urgency_level),
      );
      if (legacyUrgencyAdjustment) lineItems.push(legacyUrgencyAdjustment);
    }
  } else {
    const billingType: BillingType = pkg.billingType === "one_time" ? "one_time" : "recurring";
    const amount = basePackageAmount(
      pkg.priceMode,
      pkg.priceValue != null ? Number(pkg.priceValue) : null,
      inputs.base_amount ?? 0,
    );

    if (amount > 0) {
      lineItems.push({
        label: defaultPackageLabel(pkg.scenario, pkg.name),
        description: pkg.scenario === "HISTORICAL_CLEANUP" ? cleanupDescription(inputs) : null,
        amount,
        billingType,
      });
    }

    const legacyUrgencyAdjustment = createLegacyUrgencyAdjustment(
      lineItems,
      resolveUrgencyLevel(inputs.urgency_level),
    );
    if (legacyUrgencyAdjustment) lineItems.push(legacyUrgencyAdjustment);
  }

  const onboardingFeeAmt = pkg.onboardingFee ? Number(pkg.onboardingFee) : 0;
  if (onboardingFeeAmt > 0) {
    lineItems.push({
      label: "Onboarding & Setup",
      description: "One-time setup fee",
      amount: onboardingFeeAmt,
      billingType: "one_time",
    });
  }

  const totals: QuoteTotals = {
    oneTime: lineItems
      .filter((item) => item.billingType === "one_time")
      .reduce((sum, item) => sum + item.amount, 0),
    recurring: lineItems
      .filter((item) => item.billingType === "recurring")
      .reduce((sum, item) => sum + item.amount, 0),
    onboardingFee: onboardingFeeAmt,
  };

  return { lineItems, totals };
}
