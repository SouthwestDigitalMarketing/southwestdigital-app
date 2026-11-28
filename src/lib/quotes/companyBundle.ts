/**
 * Spec 02 company bundle pricing (P1 pricing core).
 *
 * Model:
 * - `assessment.companies[]` is canonical when present; `assessment.accounts`
 *   mirrors `companies[0].accounts` so Spec 01 code (effective counts, volume
 *   clause, public inventory) keeps working untouched.
 * - The main company (index 0) prices exactly like today's builder package
 *   price from the main (effective) assessment, except the legacy
 *   `numberOfEntities` per-entity charge is NOT applied when a bundle is
 *   present — the bundle replaces it, so there is no double charge.
 * - Each additional company with `ownQboFile: true` prices as its own small
 *   proposal from its own accounts (band/counts derived from its inventory;
 *   every other driver is zero, never inherited from the main company), minus
 *   the bundle discount, rounded UP to $5 like builder prices.
 * - A company with `ownQboFile: false` is a location-like tag: no standalone
 *   price. Locations are charged only via the main company's
 *   `locationsCount` x `locationMonthlyCharge`.
 * - `fileStatus: "new_file"` adds a one-time setup charge per company.
 *   `"desktop_to_online"` is flagged only (Spec 05 prices it) and costs 0
 *   here.
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
  accounts: AccountEntry[];
  complexity?: Record<string, unknown> | null;
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

const COMPANY_FILE_STATUSES: readonly string[] = ["existing", "new_file", "desktop_to_online"];

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
      accounts: normalizeAccountInventory(row.accounts),
      complexity,
    };
  });
}

/** True when there is at least one company beyond the main one, or the main company itself carries bundle inputs. */
export function hasCompanyBundle(assessment: { companies?: unknown }): boolean {
  const companies = normalizeCompanyBundle(assessment?.companies);
  if (companies.length > 1) return true;
  if (companies.length === 0) return false;
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
 * Synthetic per-company inputs: the company's own accounts supply the
 * transaction band and reconciliation counts; every other driver is zero so
 * one file's volume never leaks into another's price. Mirrors what
 * `effectiveAssessment` derives for inventory, without depending on it.
 */
function syntheticCompanyInputs(company: CompanyEntry): PackagePricingInputs {
  const summary = summarizeAccountInventory(normalizeAccountInventory(company.accounts));
  return {
    ...emptyPackagePricingInputs(),
    transactionBand: summary.hasInventory ? (summary.derivedBand ?? "") : "",
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

export function companyBundleFeeLines(
  p: BundlePricing,
): { label: string; amount: number; cadence: "monthly" | "one-time" }[] {
  const lines: { label: string; amount: number; cadence: "monthly" | "one-time" }[] = [];
  for (const entry of p.perCompany) {
    if (entry.company.ownQboFile) {
      lines.push({
        label: entry.isMain
          ? `${entry.company.name} — monthly bookkeeping`
          : `${entry.company.name} — monthly bookkeeping (bundle, ${entry.discountPct}% off)`,
        amount: entry.discountedMonthly,
        cadence: "monthly",
      });
    } else {
      lines.push({
        label: `${entry.company.name} — location (included with main file)`,
        amount: 0,
        cadence: "monthly",
      });
    }
    if (entry.setupOneTime > 0) {
      lines.push({
        label: `${entry.company.name} — new QuickBooks file setup`,
        amount: entry.setupOneTime,
        cadence: "one-time",
      });
    }
  }
  if (p.locationsMonthly > 0) {
    lines.push({
      label: "Locations — location reporting",
      amount: p.locationsMonthly,
      cadence: "monthly",
    });
  }
  return lines;
}

export interface PublicCompanyBundle {
  companies: Array<{ name: string; ownQboFile: boolean; monthly: number; setupOneTime: number }>;
  locationsCount: number;
  locationsMonthly: number;
  bundleMonthly: number;
}

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
      };
    }),
    locationsCount: companies[0]?.locationsCount ?? 0,
    locationsMonthly: pricing.locationsMonthly,
    bundleMonthly: pricing.bundleMonthly,
  };
}
