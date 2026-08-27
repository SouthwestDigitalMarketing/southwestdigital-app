export type QuoteStatus = "draft" | "sent" | "accepted" | "expired";
export type BillingType = "one_time" | "recurring";
export type InclusionType = "included" | "optional" | "excluded";
export type ComplexityLevel = "standard" | "complex" | "advanced";
export type UrgencyLevel = "standard" | "expedited" | "rush";
export type RuleType =
  | "base_amount_multiplier"
  | "flat"
  | "per_property"
  | "per_entity"
  | "per_transaction"
  | "per_cleanup_month"
  | "cleanup_from_base_amount"
  | "tiered"
  | "complexity_flat"
  | "complexity_multiplier"
  | "urgency_flat"
  | "urgency_multiplier"
  | "custom";

export type QuoteInputs = {
  number_of_properties?: number;
  number_of_entities?: number;
  transaction_volume_estimate?: "low" | "medium" | "high" | number;
  urgency_level?: UrgencyLevel;
  complexity_level?: ComplexityLevel;
  cleanup_start_month?: string;
  cleanup_end_month?: string;
  cleanup_period_months?: number;
  base_amount?: number;
  notes?: string;
};

export type QuoteLineItemData = {
  label: string;
  description?: string | null;
  amount: number;
  billingType: BillingType;
};

export type QuoteSnapshotClient = {
  id: string;
  name: string;
  email: string;
  company: string | null;
};

export type QuoteSnapshotPackage = {
  id: string;
  key: string;
  name: string;
  scenario: string;
  tier: number;
  summary: string;
  descriptionLong: string | null;
  supportLabel: string;
  supportIncludes: string;
  supportStars: number;
  highlightLabel: string | null;
  billingType: string;
  whyItMatters: string[];
};

export type QuoteSnapshotService = {
  id: string;
  name: string;
  description: string | null;
  category: string;
  inclusionType: InclusionType;
  notes: string | null;
};

export type QuoteSnapshotFeature = {
  id: string;
  kind: string;
  shortLabel: string;
  longDescription: string | null;
  displayOrder: number;
};

export type QuoteTotals = {
  oneTime: number;
  recurring: number;
  onboardingFee: number;
};

export type QuoteSnapshot = {
  version: 1;
  generatedAt: string;
  client: QuoteSnapshotClient;
  package: QuoteSnapshotPackage;
  services: QuoteSnapshotService[];
  features: QuoteSnapshotFeature[];
  inputs: QuoteInputs;
  lineItems: QuoteLineItemData[];
  totals: QuoteTotals;
};

export type BuildQuoteResult = {
  quoteId: string;
  slug: string;
  totals: QuoteTotals;
  lineItems: QuoteLineItemData[];
};

export type PackageForPricing = {
  name: string;
  scenario: string;
  billingType: string;
  priceMode: string;
  priceValue: unknown;
  onboardingFee: unknown;
  pricingRules: Array<{
    name: string;
    description: string | null;
    ruleType: string;
    configJson: unknown;
    minPrice: unknown;
    maxPrice: unknown;
    billingType: string;
  }>;
};

export type PackagePreview = {
  packageId: string;
  key: string;
  name: string;
  summary: string;
  scenario: string;
  tier: number;
  highlightLabel: string | null;
  supportLabel: string;
  supportStars: number;
  features: Array<{ kind: string; shortLabel: string }>;
  lineItems: QuoteLineItemData[];
  totals: QuoteTotals;
};

export type FlatRuleConfig = { amount: number };
export type BaseAmountMultiplierRuleConfig = { multiplier?: number };
export type PerUnitRuleConfig = { rate_per_unit: number };
export type CleanupBaseAmountRuleConfig = { multiplier?: number };
export type TieredRuleConfig = {
  tiers: Array<{ min: number; max: number; price: number }>;
  dimension: "properties" | "transactions" | "entities" | "cleanup_months";
};
export type ComplexityAmountRuleConfig = Partial<Record<ComplexityLevel, number>>;
export type UrgencyAmountRuleConfig = Partial<Record<UrgencyLevel, number>>;
