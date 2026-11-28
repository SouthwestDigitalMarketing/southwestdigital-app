/**
 * Spec 02 company bundle pricing (P1 pricing core + integration fixes).
 *
 * Model:
 * - `assessment.companies[]` is canonical when present; `assessment.accounts`
 *   mirrors `companies[0].accounts` so Spec 01 code (effective counts, volume
 *   clause, public inventory) keeps working untouched.
 * - The main company (index 0) prices exactly like today's builder package
 *   price from the main (effective) assessment, except the legacy
 *   `numberOfEntities` per-entity charge is NOT applied when a bundle is
 *   present — the bundle replaces it, so there is no double charge.
 *   The main row is ALWAYS priced as the main file, even when its own
 *   `ownQboFile` flag is false: only non-main rows use that flag to choose
 *   between an owned file and a location-like tag. A solo main company with
 *   `ownQboFile: false` therefore still prices at the full main monthly.
 * - Each additional company with `ownQboFile: true` prices as its own small
 *   proposal from its own accounts AND its own `propertiesCount` (the same
 *   per-property rules `packagePricing` applies to the main assessment:
 *   `recurringPerProperty` monthly; backlog follows the same inputs), minus
 *   the bundle discount, rounded UP to $5 like builder prices. No other
 *   driver is inherited from the main company. Payroll and other per-company
 *   drivers arrive with spec 03; `complexity` stays reserved until then.
 * - A company with `ownQboFile: false` is a location-like tag: no standalone
 *   price, and tags alone never activate the bundle (adding a tag keeps the
 *   legacy per-entity charge). Locations are charged only via the main
 *   company's `locationsCount` x `locationMonthlyCharge`.
 * - `fileStatus: "new_file"` adds a one-time setup charge per company, whose
 *   default resolves per-proposal override -> options-template
 *   `bundlePricingDefaults` -> brand catalog `new-quickbooks-file` price
 *   (when > 0) -> $150.
 *   `"desktop_to_online"` is flagged only (Spec 05 prices it) and costs 0
 *   here, but every such company emits a priced-separately marker line so
 *   spec 05 has something to key on.
 *
 * One bundle object: the builder snapshot publishes
 * `pricing.companyBundle` = per-tier BundlePricing (grow/improve/maintain)
 * when a bundle is active. Preview, the public payload (per-tier
 * whitelisted map), the agreement route (selected tier) and checkout all
 * read THAT object through `resolveCompanyBundleForTier`; direct
 * `priceCompanyBundle` calls are only the fallback for old snapshots that
 * predate the bundle wiring.
 *
 * Callers pass the EFFECTIVE main assessment (`effectiveAssessment(...)`) as
 * `baseAssessment`; this module zeroes `numberOfEntities` itself.
 */
import {
  normalizeAccountInventory,
  summarizeAccountInventory,
  type AccountEntry,
} from "./accountInventory";
import {
  applyGrowPriceOverride,
  buildPackagePricing,
  emptyPackagePricingInputs,
  PACKAGE_PRICING,
  roundUpToNearestIncrement,
  type PackageId,
  type PackagePricingInputs,
} from "./packagePricing";

export type CompanyFileStatus = "existing" | "new_file" | "desktop_to_online";

export interface CompanyEntry {
  id: string;
  name: string;
  ownQboFile: boolean;
  fileStatus: CompanyFileStatus;
  locationsCount: number;
  /** Spec 02 R1: properties held in this company's own file (>= 0). The main
   *  company prices its properties through the existing assessment
   *  `numberOfProperties` input instead; this field is for added companies. */
  propertiesCount: number;
  accounts: AccountEntry[];
  complexity: Record<string, unknown> | null;
}

export interface BundlePricingOptions {
  additionalCompanyDiscountPct: number;
  locationMonthlyCharge: number;
  newFileSetupCharge: number;
}

/** PROPOSED, Ummon/Tom to confirm: 20% off each added file, $25/location/mo, $150/new file. */
export const DEFAULT_BUNDLE_PRICING_OPTIONS: BundlePricingOptions = {
  additionalCompanyDiscountPct: 20,
  locationMonthlyCharge: 25,
  newFileSetupCharge: 150,
};

/** Brand catalog service whose price (> 0) becomes the new-file setup default. */
export const NEW_QUICKBOOKS_FILE_SERVICE_ID = "new-quickbooks-file";

export interface CompanyPriced {
  company: CompanyEntry;
  isMain: boolean;
  standaloneMonthly: number;
  discountPct: number;
  discountedMonthly: number;
  setupOneTime: number;
}

export interface BundlePricing {
  perCompany: CompanyPriced[];
  locationsMonthly: number;
  bundleMonthly: number;
  discountTotal: number;
  setupTotal: number;
}

/** Per-tier snapshot bundle: the one object every consumer reads. */
export type CompanyBundleSnapshot = Record<PackageId, BundlePricing>;

export type CompanyBundleFeeLineKind =
  | "company-monthly"
  | "tag"
  | "setup"
  | "locations"
  | "migration";

export interface CompanyBundleFeeLine {
  /** Structured identity: consumers key on `companyName` + `kind`, never on the label. */
  companyName: string;
  kind: CompanyBundleFeeLineKind;
  label: string;
  amount: number;
  cadence: "monthly" | "one-time";
}

const COMPANY_FILE_STATUSES: readonly string[] = ["existing", "new_file", "desktop_to_online"];

const PACKAGE_IDS = ["grow", "improve", "maintain"] as const satisfies readonly PackageId[];

function trimmedText(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeFileStatus(value: unknown): CompanyFileStatus {
  return COMPANY_FILE_STATUSES.includes(value as string)
    ? (value as CompanyFileStatus)
    : "existing";
}

function normalizeLocationsCount(value: unknown): number {
  const count = typeof value === "number" ? value : typeof value === "string" ? Number(value) : 0;
  return Number.isFinite(count) ? Math.trunc(Math.min(1_000_000, Math.max(0, count))) : 0;
}

function normalizePropertiesCount(value: unknown): number {
  const count = typeof value === "number" ? value : typeof value === "string" ? Number(value) : 0;
  return Number.isFinite(count) ? Math.trunc(Math.min(1_000_000, Math.max(0, count))) : 0;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

/** Tolerant like `normalizeAccountInventory`: unique ids, index 0 = main company. */
export function normalizeCompanyBundle(raw: unknown): CompanyEntry[] {
  if (!Array.isArray(raw)) return [];
  const rows = raw.filter(isRecord);
  const reservedIds = new Set(
    rows.map((row) => trimmedText(row.id)).filter((id) => id.length > 0),
  );
  const usedIds = new Set<string>();
  const nextSuffix = new Map<string, number>();
  return rows.map((row, index) => {
    const originalId = trimmedText(row.id);
    const base = originalId || "company";
    let id = base;
    if (!originalId || usedIds.has(originalId)) {
      let suffix = nextSuffix.get(base) ?? 2;
      while (reservedIds.has(id) || usedIds.has(id)) {
        id = `${base}-${suffix++}`;
      }
      nextSuffix.set(base, suffix);
    }
    usedIds.add(id);
    const name = trimmedText(row.name) || `Company ${index + 1}`;
    const complexity = isRecord(row.complexity) ? (row.complexity as Record<string, unknown>) : null;
    return {
      id,
      name,
      // A listed company is assumed to hold its own QBO file unless marked otherwise.
      ownQboFile: row.ownQboFile !== false,
      fileStatus: normalizeFileStatus(row.fileStatus),
      locationsCount: normalizeLocationsCount(row.locationsCount),
      propertiesCount: normalizePropertiesCount(row.propertiesCount),
      accounts: normalizeAccountInventory(row.accounts),
      complexity,
    };
  });
}

/**
 * True when the bundle replaces the legacy per-entity charge: at least one
 * NON-MAIN company holds its own file, or the main company itself carries
 * bundle inputs (locations or a new file). A tag-only addition
 * (`ownQboFile: false`) never activates the bundle, so the legacy entity
 * charge survives it.
 */
export function hasCompanyBundle(assessment: { companies?: unknown }): boolean {
  const companies = normalizeCompanyBundle(assessment?.companies);
  if (companies.length === 0) return false;
  if (companies.slice(1).some((company) => company.ownQboFile)) return true;
  const main = companies[0];
  return main.locationsCount > 0 || main.fileStatus === "new_file";
}

function clampDiscountPct(value: unknown, fallback: number): number {
  const pct = typeof value === "number" && Number.isFinite(value) ? value : fallback;
  return Math.min(100, Math.max(0, pct));
}

function clampCharge(value: unknown, fallback: number): number {
  const charge = typeof value === "number" && Number.isFinite(value) ? value : fallback;
  return Math.max(0, charge);
}

function sanitizeBundlePricingOptions(options: BundlePricingOptions): BundlePricingOptions {
  const fallback = DEFAULT_BUNDLE_PRICING_OPTIONS;
  const source = isRecord(options as unknown) ? (options as BundlePricingOptions) : fallback;
  return {
    additionalCompanyDiscountPct: clampDiscountPct(
      source.additionalCompanyDiscountPct,
      fallback.additionalCompanyDiscountPct,
    ),
    locationMonthlyCharge: clampCharge(source.locationMonthlyCharge, fallback.locationMonthlyCharge),
    newFileSetupCharge: clampCharge(source.newFileSetupCharge, fallback.newFileSetupCharge),
  };
}

/**
 * Storage-shape sanitizer for a raw per-proposal override (or raw template
 * defaults): finite values clamp into range, anything else falls back to the
 * proposed defaults. This deliberately knows NOTHING about the catalog —
 * baking a catalog price in here would freeze it into the stored override and
 * shadow later catalog changes. Use `resolveBundlePricingOptions` for pricing.
 */
export function sanitizeBundlePricingOverride(raw: unknown): BundlePricingOptions {
  if (!isRecord(raw)) return { ...DEFAULT_BUNDLE_PRICING_OPTIONS };
  const source = raw as Partial<BundlePricingOptions>;
  return {
    additionalCompanyDiscountPct: clampDiscountPct(
      source.additionalCompanyDiscountPct,
      DEFAULT_BUNDLE_PRICING_OPTIONS.additionalCompanyDiscountPct,
    ),
    locationMonthlyCharge: clampCharge(
      source.locationMonthlyCharge,
      DEFAULT_BUNDLE_PRICING_OPTIONS.locationMonthlyCharge,
    ),
    newFileSetupCharge: clampCharge(
      source.newFileSetupCharge,
      DEFAULT_BUNDLE_PRICING_OPTIONS.newFileSetupCharge,
    ),
  };
}

function finiteNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

/**
 * Brand catalog price for the `new-quickbooks-file` service: the largest
 * finite price above zero found on the assessment's matching bonus
 * (`addOnPrice`) or additional option (`monthlyPrice`). Null when the brand
 * prices it at $0 (the seed row) or does not carry it.
 */
export function catalogNewQuickBooksFilePrice(assessment: unknown): number | null {
  const source = isRecord(assessment) ? assessment : {};
  const rows = [
    ...(Array.isArray(source.bonuses) ? source.bonuses : []),
    ...(Array.isArray(source.additionalOptions) ? source.additionalOptions : []),
  ];
  let best: number | null = null;
  for (const row of rows) {
    if (!isRecord(row) || row.id !== NEW_QUICKBOOKS_FILE_SERVICE_ID) continue;
    for (const key of ["addOnPrice", "monthlyPrice"] as const) {
      const price = row[key];
      if (typeof price === "number" && Number.isFinite(price) && price > 0) {
        best = best === null ? price : Math.max(best, price);
      }
    }
  }
  return best;
}

/**
 * Canonical Spec 02 options resolution (R2): the per-proposal
 * `bundlePricingOptions` override wins field by field, then the
 * options-template `bundlePricingDefaults`, then the brand catalog
 * `new-quickbooks-file` price (only for `newFileSetupCharge`, only when it
 * carries a price above zero — the seed row is $0.00), then the proposed
 * $150 default. Every pricing call site uses this; nothing hard-codes 150.
 */
export function resolveBundlePricingOptions(assessment: unknown): BundlePricingOptions {
  const source = isRecord(assessment) ? assessment : {};
  const overrideRaw = isRecord(source.bundlePricingOptions)
    ? (source.bundlePricingOptions as Partial<BundlePricingOptions>)
    : {};
  const defaultsRaw = isRecord(source.bundlePricingDefaults)
    ? (source.bundlePricingDefaults as Partial<BundlePricingOptions>)
    : {};
  const pick = (key: keyof BundlePricingOptions): number | null =>
    finiteNumber(overrideRaw[key]) ?? finiteNumber(defaultsRaw[key]);
  return {
    additionalCompanyDiscountPct: clampDiscountPct(
      pick("additionalCompanyDiscountPct"),
      DEFAULT_BUNDLE_PRICING_OPTIONS.additionalCompanyDiscountPct,
    ),
    locationMonthlyCharge: clampCharge(
      pick("locationMonthlyCharge"),
      DEFAULT_BUNDLE_PRICING_OPTIONS.locationMonthlyCharge,
    ),
    newFileSetupCharge: clampCharge(
      pick("newFileSetupCharge") ??
        catalogNewQuickBooksFilePrice(source) ??
        DEFAULT_BUNDLE_PRICING_OPTIONS.newFileSetupCharge,
      DEFAULT_BUNDLE_PRICING_OPTIONS.newFileSetupCharge,
    ),
  };
}

/**
 * Synthetic per-company inputs: the company's own accounts supply the
 * transaction band and reconciliation counts, and its own `propertiesCount`
 * supplies the per-property rules; every other driver is zero so one file's
 * volume never leaks into another's price. Mirrors what
 * `effectiveAssessment` derives for inventory, without depending on it.
 */
function syntheticCompanyInputs(company: CompanyEntry): PackagePricingInputs {
  const summary = summarizeAccountInventory(normalizeAccountInventory(company.accounts));
  return {
    ...emptyPackagePricingInputs(),
    transactionBand: summary.hasInventory ? (summary.derivedBand ?? "") : "",
    numberOfProperties: company.propertiesCount,
    bankAccountsCount: summary.derivedCounts.bankAccountsCount,
    creditCardsCount: summary.derivedCounts.creditCardsCount,
    loansCount: summary.derivedCounts.loansCount,
    linesOfCreditCount: summary.derivedCounts.linesOfCreditCount,
    vehicleNotesCount: summary.derivedCounts.vehicleNotesCount,
  };
}

/** Standalone monthly for one owned file, with the same grow override the builder applies. */
function standaloneCompanyMonthly(company: CompanyEntry, packageId: PackageId): number {
  const inputs = syntheticCompanyInputs(company);
  const priced = applyGrowPriceOverride({
    grow: buildPackagePricing(PACKAGE_PRICING.grow, inputs, 0, 0),
    improve: buildPackagePricing(PACKAGE_PRICING.improve, inputs, 0, 0),
    maintain: buildPackagePricing(PACKAGE_PRICING.maintain, inputs, 0, 0),
  });
  return priced[packageId].monthly;
}

export function priceCompanyBundle(input: {
  companies: CompanyEntry[];
  packageId: PackageId;
  baseAssessment: unknown;
  options: BundlePricingOptions;
}): BundlePricing {
  const companies = normalizeCompanyBundle(input.companies);
  const options = sanitizeBundlePricingOptions(input.options);
  const packageId = PACKAGE_PRICING[input.packageId] ? input.packageId : "maintain";
  const mainInputs: PackagePricingInputs = {
    ...emptyPackagePricingInputs(),
    ...(isRecord(input.baseAssessment) ? (input.baseAssessment as Partial<PackagePricingInputs>) : {}),
    // The bundle replaces the legacy per-entity charge: never stack them.
    numberOfEntities: 0,
  };
  const mainPriced = applyGrowPriceOverride({
    grow: buildPackagePricing(PACKAGE_PRICING.grow, mainInputs, 0, 0),
    improve: buildPackagePricing(PACKAGE_PRICING.improve, mainInputs, 0, 0),
    maintain: buildPackagePricing(PACKAGE_PRICING.maintain, mainInputs, 0, 0),
  });
  const mainMonthly = mainPriced[packageId].monthly;

  const perCompany: CompanyPriced[] = companies.map((company, index) => {
    const isMain = index === 0;
    if (isMain) {
      return {
        company,
        isMain,
        standaloneMonthly: mainMonthly,
        discountPct: 0,
        discountedMonthly: mainMonthly,
        setupOneTime: company.fileStatus === "new_file" ? options.newFileSetupCharge : 0,
      };
    }
    if (!company.ownQboFile) {
      // Location-like tag: priced as part of the main file, not on its own.
      return {
        company,
        isMain,
        standaloneMonthly: 0,
        discountPct: 0,
        discountedMonthly: 0,
        setupOneTime: 0,
      };
    }
    const standaloneMonthly = standaloneCompanyMonthly(company, packageId);
    const discountPct = options.additionalCompanyDiscountPct;
    return {
      company,
      isMain,
      standaloneMonthly,
      discountPct,
      discountedMonthly: roundUpToNearestIncrement(standaloneMonthly * (1 - discountPct / 100)),
      setupOneTime: company.fileStatus === "new_file" ? options.newFileSetupCharge : 0,
    };
  });

  const locationsMonthly =
    (companies[0]?.locationsCount ?? 0) * options.locationMonthlyCharge;
  const discountedTotal = perCompany.reduce((total, entry) => total + entry.discountedMonthly, 0);
  const discountTotal = perCompany.reduce(
    (total, entry) => total + (entry.standaloneMonthly - entry.discountedMonthly),
    0,
  );
  const setupTotal = perCompany.reduce((total, entry) => total + entry.setupOneTime, 0);

  return {
    perCompany,
    locationsMonthly,
    bundleMonthly: discountedTotal + locationsMonthly,
    discountTotal,
    setupTotal,
  };
}

/**
 * The one bundle object for a snapshot: per-tier BundlePricing priced with
 * one shared options resolution. Null when no bundle is active, so legacy
 * snapshots carry no `companyBundle` key at all.
 */
export function buildCompanyBundleSnapshot(input: {
  companies: unknown;
  baseAssessment: unknown;
  options: BundlePricingOptions;
}): CompanyBundleSnapshot | null {
  if (!hasCompanyBundle({ companies: input.companies })) return null;
  const companies = normalizeCompanyBundle(input.companies);
  const options = sanitizeBundlePricingOptions(input.options);
  return {
    grow: priceCompanyBundle({ companies, packageId: "grow", baseAssessment: input.baseAssessment, options }),
    improve: priceCompanyBundle({ companies, packageId: "improve", baseAssessment: input.baseAssessment, options }),
    maintain: priceCompanyBundle({ companies, packageId: "maintain", baseAssessment: input.baseAssessment, options }),
  };
}

function isBundlePricingLike(value: unknown): value is BundlePricing {
  if (!isRecord(value)) return false;
  if (!Array.isArray(value.perCompany)) return false;
  if (
    !value.perCompany.every(
      (entry) =>
        isRecord(entry) &&
        isRecord(entry.company) &&
        typeof entry.company.name === "string" &&
        typeof entry.isMain === "boolean" &&
        typeof entry.standaloneMonthly === "number" &&
        Number.isFinite(entry.standaloneMonthly) &&
        typeof entry.discountedMonthly === "number" &&
        Number.isFinite(entry.discountedMonthly) &&
        typeof entry.setupOneTime === "number" &&
        Number.isFinite(entry.setupOneTime),
    )
  ) {
    return false;
  }
  return ["locationsMonthly", "bundleMonthly", "discountTotal", "setupTotal"].every(
    (key) => typeof value[key] === "number" && Number.isFinite(value[key]),
  );
}

/** Tolerant reader for a stored `pricing.companyBundle` (null for legacy or malformed). */
export function asCompanyBundleSnapshot(value: unknown): CompanyBundleSnapshot | null {
  if (!isRecord(value)) return null;
  if (!PACKAGE_IDS.every((tier) => isBundlePricingLike(value[tier]))) return null;
  return value as unknown as CompanyBundleSnapshot;
}

function normalizePackageId(value: unknown): PackageId {
  return value === "grow" || value === "improve" || value === "maintain" ? value : "maintain";
}

/**
 * Shared F1 resolver: read the tier's BundlePricing from a published pricing
 * snapshot's `companyBundle`, falling back to a fresh `priceCompanyBundle`
 * for old snapshots that predate the bundle wiring. Null when no bundle is
 * active, so legacy proposals price exactly as today.
 */
export function resolveCompanyBundleForTier(input: {
  pricing?: unknown;
  packageId: unknown;
  companies?: unknown;
  baseAssessment?: unknown;
  options?: BundlePricingOptions;
}): BundlePricing | null {
  const packageId = normalizePackageId(input.packageId);
  const snapshot = asCompanyBundleSnapshot(
    isRecord(input.pricing) ? (input.pricing as Record<string, unknown>).companyBundle : null,
  );
  if (snapshot) return snapshot[packageId];
  const companies = normalizeCompanyBundle(input.companies);
  if (!hasCompanyBundle({ companies })) return null;
  return priceCompanyBundle({
    companies,
    packageId,
    baseAssessment: input.baseAssessment,
    options: input.options ?? DEFAULT_BUNDLE_PRICING_OPTIONS,
  });
}

export function companyBundleFeeLines(p: BundlePricing): CompanyBundleFeeLine[] {
  const lines: CompanyBundleFeeLine[] = [];
  for (const entry of p.perCompany) {
    if (entry.isMain || entry.company.ownQboFile) {
      lines.push({
        companyName: entry.company.name,
        kind: "company-monthly",
        label: entry.isMain
          ? `${entry.company.name} — monthly bookkeeping`
          : `${entry.company.name} — monthly bookkeeping (bundle, ${entry.discountPct}% off)`,
        amount: entry.discountedMonthly,
        cadence: "monthly",
      });
    } else {
      lines.push({
        companyName: entry.company.name,
        kind: "tag",
        label: `${entry.company.name} — location (included with main file)`,
        amount: 0,
        cadence: "monthly",
      });
    }
    if (entry.company.fileStatus === "desktop_to_online") {
      lines.push({
        companyName: entry.company.name,
        kind: "migration",
        label: `${entry.company.name} — Desktop → Online migration (priced separately)`,
        amount: 0,
        cadence: "one-time",
      });
    }
    if (entry.setupOneTime > 0) {
      lines.push({
        companyName: entry.company.name,
        kind: "setup",
        label: `${entry.company.name} — new QuickBooks file setup`,
        amount: entry.setupOneTime,
        cadence: "one-time",
      });
    }
  }
  if (p.locationsMonthly > 0) {
    lines.push({
      companyName: p.perCompany[0]?.company.name ?? "",
      kind: "locations",
      label: "Locations — location reporting",
      amount: p.locationsMonthly,
      cadence: "monthly",
    });
  }
  return lines;
}

export interface PublicCompanyBundle {
  companies: Array<{
    name: string;
    ownQboFile: boolean;
    monthly: number;
    setupOneTime: number;
    migrationFlagged: boolean;
  }>;
  locationsCount: number;
  locationsMonthly: number;
  bundleMonthly: number;
}

export type PublicCompanyBundleMap = Record<PackageId, PublicCompanyBundle>;

export function toPublicCompanyBundle(
  raw: unknown,
  pricing: BundlePricing | null,
): PublicCompanyBundle | null {
  if (!pricing) return null;
  const companies = normalizeCompanyBundle(raw);
  if (companies.length === 0) return null;
  const pricedById = new Map(pricing.perCompany.map((entry) => [entry.company.id, entry]));
  return {
    companies: companies.map((company) => {
      const priced = pricedById.get(company.id);
      return {
        name: company.name,
        ownQboFile: company.ownQboFile,
        monthly: priced?.discountedMonthly ?? 0,
        setupOneTime: priced?.setupOneTime ?? 0,
        migrationFlagged: company.fileStatus === "desktop_to_online",
      };
    }),
    locationsCount: companies[0]?.locationsCount ?? 0,
    locationsMonthly: pricing.locationsMonthly,
    bundleMonthly: pricing.bundleMonthly,
  };
}

/** Whitelisted per-tier public bundle, so the public block can show the selected tab's numbers. */
export function toPublicCompanyBundleMap(
  raw: unknown,
  snapshot: CompanyBundleSnapshot | null,
): PublicCompanyBundleMap | null {
  if (!snapshot) return null;
  const grow = toPublicCompanyBundle(raw, snapshot.grow);
  const improve = toPublicCompanyBundle(raw, snapshot.improve);
  const maintain = toPublicCompanyBundle(raw, snapshot.maintain);
  if (!grow || !improve || !maintain) return null;
  return { grow, improve, maintain };
}

function isPublicCompanyBundleLike(value: unknown): value is PublicCompanyBundle {
  if (!isRecord(value)) return false;
  if (!Array.isArray(value.companies)) return false;
  if (
    !value.companies.every(
      (entry) =>
        isRecord(entry) &&
        typeof entry.name === "string" &&
        typeof entry.ownQboFile === "boolean" &&
        typeof entry.monthly === "number" &&
        Number.isFinite(entry.monthly) &&
        typeof entry.setupOneTime === "number" &&
        Number.isFinite(entry.setupOneTime),
    )
  ) {
    return false;
  }
  return ["locationsMonthly", "bundleMonthly"].every(
    (key) => typeof value[key] === "number" && Number.isFinite(value[key]),
  );
}

/**
 * Tolerant reader for the public `companyBundle` payload: the current
 * per-tier map, or a legacy single-tier bundle (expanded to every tier so
 * old snapshots keep rendering the maintain numbers they published).
 */
export function asPublicCompanyBundleMap(value: unknown): PublicCompanyBundleMap | null {
  if (!value) return null;
  if (isRecord(value) && PACKAGE_IDS.every((tier) => isPublicCompanyBundleLike(value[tier]))) {
    return value as unknown as PublicCompanyBundleMap;
  }
  if (isPublicCompanyBundleLike(value)) {
    return { grow: value, improve: value, maintain: value };
  }
  return null;
}
