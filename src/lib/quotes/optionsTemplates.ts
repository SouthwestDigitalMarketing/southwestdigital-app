import type { BundlePricingOptions } from "@/lib/quotes/companyBundle";

export const OPTIONS_TEMPLATE_SNAPSHOT_VERSION = 1;

export type OptionsTemplatePackageId = "grow" | "improve" | "maintain";

export type OptionsTemplateAdditionalOption = {
  id: string;
  name: string;
  description: string;
  monthlyPrice: number;
  showInProposal: boolean;
  archived: boolean;
  billingCadence?: "monthly" | "one-time";
  includedPlacement?: "main" | "included";
  packageIds?: OptionsTemplatePackageId[];
  required?: boolean;
  realEstateSpecific?: boolean;
};

export type OptionsTemplateBonus = {
  id: string;
  name: string;
  description: string;
  archived: boolean;
  realEstateSpecific?: boolean;
  billingCadence?: "monthly" | "one-time";
  includedPlacement?: "main" | "included";
  defaultPackageIds?: OptionsTemplatePackageId[];
  addOnPrice?: number;
  addOnPackageIds?: OptionsTemplatePackageId[];
};

export type OptionsTemplateSnapshot = {
  version: typeof OPTIONS_TEMPLATE_SNAPSHOT_VERSION;
  productKind: "bookkeeping";
  optionsCatalogOrder: string[];
  additionalOptions: OptionsTemplateAdditionalOption[];
  bonuses: OptionsTemplateBonus[];
  bonusPackageSelections: Record<string, OptionsTemplatePackageId[]>;
  /**
   * Spec 02 brand-level defaults for BundlePricingOptions. Additive and
   * optional so snapshots written before Spec 02 (which omit it) still parse
   * at version 1. Each field is optional too: an omitted field (in
   * particular `newFileSetupCharge`, which new seeds leave out) falls
   * through to the brand catalog price and then the proposed default at
   * resolution time. When a template is applied to a proposal it lands on
   * the assessment as `bundlePricingDefaults`; a per-proposal
   * `bundlePricingOptions` override on the assessment wins over it.
   */
  bundlePricingDefaults?: Partial<BundlePricingOptions>;
};

export type OptionsTemplateAssessmentSlice = {
  optionsCatalogOrder: string[];
  additionalOptions: OptionsTemplateAdditionalOption[];
  bonuses: OptionsTemplateBonus[];
  bonusPackageSelections: Record<string, OptionsTemplatePackageId[]>;
  bundlePricingDefaults?: Partial<BundlePricingOptions>;
};

const VALID_PACKAGES: readonly OptionsTemplatePackageId[] = ["grow", "improve", "maintain"];
const MONTHLY_BOOKKEEPING_NAME = "Monthly QuickBooks Bookkeeping";
const MONTHLY_BOOKKEEPING_DESCRIPTION =
  "Recurring categorization and reconciliation for the QuickBooks accounts included in your plan, using the information and access available to us.";
const DOCUMENT_ORGANIZATION_NAME = "Bookkeeping Document Organization";
const DOCUMENT_ORGANIZATION_DESCRIPTION =
  "We organize the documents you provide as part of the bookkeeping process.";

function isPackageId(value: unknown): value is OptionsTemplatePackageId {
  return typeof value === "string" && (VALID_PACKAGES as readonly string[]).includes(value);
}

function finiteChargeOrUndefined(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? Math.max(0, value) : undefined;
}

/**
 * Canonical Spec 02 bundle defaults for storage. Finite values are kept
 * (discount clamped to 0–100, charges floored at 0); anything else stays
 * UNSET so resolution can fall through to the catalog and then the proposed
 * defaults. A stored 150 is kept as-is: it counts as explicitly set.
 */
export function sanitizeBundlePricingDefaults(value: unknown): Partial<BundlePricingOptions> {
  const source = (value && typeof value === "object" ? value : {}) as Partial<BundlePricingOptions>;
  const partial: Partial<BundlePricingOptions> = {};
  if (typeof source.additionalCompanyDiscountPct === "number" &&
    Number.isFinite(source.additionalCompanyDiscountPct)) {
    partial.additionalCompanyDiscountPct = Math.min(100, Math.max(0, source.additionalCompanyDiscountPct));
  }
  const location = finiteChargeOrUndefined(source.locationMonthlyCharge);
  if (location !== undefined) partial.locationMonthlyCharge = location;
  const setup = finiteChargeOrUndefined(source.newFileSetupCharge);
  if (setup !== undefined) partial.newFileSetupCharge = setup;
  return partial;
}

/**
 * Parse the manager's bundle-defaults text inputs. A blank input DELETES its
 * key so the field falls back down the resolution chain (catalog, then the
 * proposed defaults) — it never saves `Number("")` (0). A non-blank input
 * must be a finite non-negative number. Returns null when any non-blank
 * input is invalid.
 */
export function parseBundlePricingDefaultsInputs(values: {
  discountPct: string;
  locationCharge: string;
  setupCharge: string;
}): Partial<BundlePricingOptions> | null {
  const parsed: Partial<BundlePricingOptions> = {};
  const fields = [
    ["discountPct", "additionalCompanyDiscountPct"],
    ["locationCharge", "locationMonthlyCharge"],
    ["setupCharge", "newFileSetupCharge"],
  ] as const;
  for (const [inputKey, optionKey] of fields) {
    const raw = values[inputKey].trim();
    if (raw === "") continue;
    const value = Number(raw);
    if (!Number.isFinite(value) || value < 0) return null;
    parsed[optionKey] = optionKey === "additionalCompanyDiscountPct" ? Math.min(100, value) : value;
  }
  return parsed;
}

function sanitizePackageIds(value: unknown): OptionsTemplatePackageId[] {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.filter(isPackageId))];
}

function sanitizeAdditionalOption(raw: unknown): OptionsTemplateAdditionalOption | null {
  if (!raw || typeof raw !== "object") return null;
  const record = raw as Record<string, unknown>;
  if (typeof record.id !== "string" || record.id.length === 0) return null;
  return {
    id: record.id,
    name: typeof record.name === "string" ? record.name : "",
    description: typeof record.description === "string" ? record.description : "",
    monthlyPrice:
      typeof record.monthlyPrice === "number" && Number.isFinite(record.monthlyPrice)
        ? record.monthlyPrice
        : 0,
    showInProposal: record.showInProposal !== false,
    archived: record.archived === true,
    includedPlacement: record.includedPlacement === "main" || record.includedPlacement === "included"
      ? record.includedPlacement : undefined,
    billingCadence: record.billingCadence === "monthly" || record.billingCadence === "one-time"
      ? record.billingCadence
      : undefined,
    packageIds: Array.isArray(record.packageIds) ? sanitizePackageIds(record.packageIds) : undefined,
    required: record.required === true ? true : undefined,
    realEstateSpecific: record.realEstateSpecific === true ? true : undefined,
  };
}

function sanitizeBonus(raw: unknown): OptionsTemplateBonus | null {
  if (!raw || typeof raw !== "object") return null;
  const record = raw as Record<string, unknown>;
  if (typeof record.id !== "string" || record.id.length === 0) return null;
  const billingCadence =
    record.billingCadence === "monthly" || record.billingCadence === "one-time"
      ? record.billingCadence
      : undefined;
  const bonus: OptionsTemplateBonus = {
    id: record.id,
    name: typeof record.name === "string" ? record.name : "",
    description: typeof record.description === "string" ? record.description : "",
    archived: record.archived === true,
    realEstateSpecific: record.realEstateSpecific === true ? true : undefined,
    billingCadence,
    includedPlacement: record.includedPlacement === "main" || record.includedPlacement === "included"
      ? record.includedPlacement : undefined,
    defaultPackageIds: Array.isArray(record.defaultPackageIds)
      ? sanitizePackageIds(record.defaultPackageIds)
      : undefined,
    addOnPrice:
      typeof record.addOnPrice === "number" && Number.isFinite(record.addOnPrice)
        ? Math.max(0, record.addOnPrice)
        : undefined,
    addOnPackageIds: Array.isArray(record.addOnPackageIds)
      ? sanitizePackageIds(record.addOnPackageIds)
      : undefined,
  };
  const hasLegacyAuditClaim =
    bonus.id === "document-organization" &&
    (/audit[- ]ready/i.test(bonus.name) ||
      bonus.description === "Use one organized process for sending records, resolving missing items, and keeping supporting documents connected to the books." ||
      bonus.description === "We replace paper files and loose digital files with one clear system. The client uploads records to the portal. We organize them and link them to the right items in the books.");
  if (hasLegacyAuditClaim) {
    return {
      ...bonus,
      name: DOCUMENT_ORGANIZATION_NAME,
      description: DOCUMENT_ORGANIZATION_DESCRIPTION,
    };
  }
  const hasLegacyMonthlyClaim =
    bonus.id === "monthly-bookkeeping" &&
    bonus.description === "We categorize transactions, reconcile accounts, complete the monthly close, and deliver a clear Balance Sheet and Profit & Loss statement.";
  if (hasLegacyMonthlyClaim) {
    return {
      ...bonus,
      name: MONTHLY_BOOKKEEPING_NAME,
      description: MONTHLY_BOOKKEEPING_DESCRIPTION,
    };
  }
  return bonus;
}

export function buildOptionsTemplateSnapshot(
  slice: OptionsTemplateAssessmentSlice,
): OptionsTemplateSnapshot {
  const additionalOptions = slice.additionalOptions
    .map(sanitizeAdditionalOption)
    .filter((item): item is OptionsTemplateAdditionalOption => item !== null);
  const bonuses = slice.bonuses
    .map(sanitizeBonus)
    .filter((item): item is OptionsTemplateBonus => item !== null);
  const bonusPackageSelections = Object.fromEntries(
    Object.entries(slice.bonusPackageSelections)
      .filter(([id]) => typeof id === "string" && id.length > 0)
      .map(([id, value]) => [id, sanitizePackageIds(value)]),
  );
  const optionsCatalogOrder = Array.isArray(slice.optionsCatalogOrder)
    ? [...new Set(slice.optionsCatalogOrder.filter((id): id is string => typeof id === "string" && id.length > 0))]
    : [];
  return {
    version: OPTIONS_TEMPLATE_SNAPSHOT_VERSION,
    productKind: "bookkeeping",
    optionsCatalogOrder,
    additionalOptions,
    bonuses,
    bonusPackageSelections,
    bundlePricingDefaults: sanitizeBundlePricingDefaults(slice.bundlePricingDefaults),
  };
}

export function parseOptionsTemplateSnapshot(raw: unknown): OptionsTemplateSnapshot | null {
  if (!raw || typeof raw !== "object") return null;
  const record = raw as Record<string, unknown>;
  if (record.version !== OPTIONS_TEMPLATE_SNAPSHOT_VERSION) return null;
  if (record.productKind !== "bookkeeping") return null;
  return buildOptionsTemplateSnapshot({
    optionsCatalogOrder: Array.isArray(record.optionsCatalogOrder)
      ? (record.optionsCatalogOrder.filter((id): id is string => typeof id === "string") as string[])
      : [],
    additionalOptions: Array.isArray(record.additionalOptions)
      ? (record.additionalOptions
          .map(sanitizeAdditionalOption)
          .filter((item): item is OptionsTemplateAdditionalOption => item !== null) as OptionsTemplateAdditionalOption[])
      : [],
    bonuses: Array.isArray(record.bonuses)
      ? (record.bonuses
          .map(sanitizeBonus)
          .filter((item): item is OptionsTemplateBonus => item !== null) as OptionsTemplateBonus[])
      : [],
    bonusPackageSelections:
      record.bonusPackageSelections && typeof record.bonusPackageSelections === "object"
        ? Object.fromEntries(
            Object.entries(record.bonusPackageSelections as Record<string, unknown>).map(([id, value]) => [
              id,
              sanitizePackageIds(value),
            ]),
          )
        : {},
    bundlePricingDefaults: sanitizeBundlePricingDefaults(record.bundlePricingDefaults),
  });
}

export type OptionsTemplateReconcileResult = {
  slice: OptionsTemplateAssessmentSlice;
  skippedIds: string[];
};

export function reconcileOptionsTemplateSnapshot(
  snapshot: OptionsTemplateSnapshot,
  catalogOfferKeys: readonly string[],
): OptionsTemplateReconcileResult {
  const validKeys = new Set(catalogOfferKeys);
  const isValid = (id: string) => validKeys.size === 0 || validKeys.has(id);

  const additionalOptions = snapshot.additionalOptions.filter((item) => isValid(item.id));
  const bonuses = snapshot.bonuses.filter((item) => isValid(item.id));
  const kept = new Set<string>([
    ...additionalOptions.map((item) => item.id),
    ...bonuses.map((item) => item.id),
  ]);
  const optionsCatalogOrder = snapshot.optionsCatalogOrder.filter((id) => kept.has(id));
  const bonusPackageSelections = Object.fromEntries(
    Object.entries(snapshot.bonusPackageSelections).filter(([id]) => kept.has(id)),
  );

  const skippedIds = [
    ...snapshot.additionalOptions.filter((item) => !isValid(item.id)).map((item) => item.id),
    ...snapshot.bonuses.filter((item) => !isValid(item.id)).map((item) => item.id),
  ];

  return {
    slice: {
      optionsCatalogOrder,
      additionalOptions,
      bonuses,
      bonusPackageSelections,
      // Brand-level bundle defaults are not catalog items, so reconciliation
      // never drops them — they always travel with the slice.
      bundlePricingDefaults: sanitizeBundlePricingDefaults(snapshot.bundlePricingDefaults),
    },
    skippedIds,
  };
}
