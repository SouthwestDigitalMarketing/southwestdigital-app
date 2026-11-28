/**
 * Spec 03 complexity-driver core (pure, no React).
 *
 * One checklist of complexity drivers: the existing pricing inputs folded in
 * (payroll, sales tax, job/project tracking, mixed books) plus the new ones
 * (inventory/COGS, POS system, online store, loans/MCA, personal
 * commingling, 1099 filing).
 *
 * No-double-charge rule: a driver whose `mapsToExisting` is set is already
 * priced by an existing monthly line (staffing headcount, an add-on, the
 * books-type adjustment). Checked, it emits a priced line with `monthly: 0`
 * and an `includedNote` naming that existing line — never an extra charge.
 * Only `mapsToExisting: null` drivers add new monthly money.
 *
 * Tier scaling rule: maintain-tier amounts are the code defaults below;
 * improve and grow scale by the SAME ratios the existing package lines use,
 * derived live from `packagePricing` constants
 * (`complexOperationsMonthly` 120/150/190, so improve = x1.25 and
 * grow = x190/120), rounded UP to $5 with `roundUpToNearestIncrement`.
 * Maintain-tier values are used as-is (so the $8 per-payee rate stays $8).
 *
 * Cleanup rule: only `loans_mca` and `personal_commingling` carry a
 * `cleanupPerMonth` add, and only when `cleanupMonths > 0` — with zero
 * cleanup months the per-line adds and both totals are 0.
 * `cleanupTotal = cleanupPerMonthTotal x cleanupMonths`.
 *
 * Money resolution order per driver field (mirrors Spec 02
 * `resolveBundlePricingOptions`): per-proposal `monthlyOverride` on the
 * checked selection, then the options-template
 * `complexityDriverDefaults` (`template`), then the code defaults below.
 * Overrides apply to NEW drivers only: an override on an existing
 * (`mapsToExisting`) driver is ignored so it can never stack a second
 * charge on top of the existing line.
 *
 * `filing_1099` pricing: `monthly = min(payeeCount x perPayeeRate, cap)`,
 * where the def's `defaultMonthly` IS the per-payee rate and `perPayeeCap`
 * is the cap. Both scale by tier like every other amount. `loans_mca`
 * `count` is informational (lender/MCA schedule count) and does not scale
 * the flat monthly; `name` on `pos_system`/`online_store` is the system
 * name (e.g. Lightspeed, Shopify) and likewise does not affect the price.
 */
import {
  PACKAGE_PRICING,
  roundUpToNearestIncrement,
  type PackageId,
} from "./packagePricing";

export type ComplexityDriverId =
  | "payroll"
  | "sales_tax"
  | "job_tracking"
  | "mixed_books"
  | "inventory_cogs"
  | "pos_system"
  | "online_store"
  | "loans_mca"
  | "personal_commingling"
  | "filing_1099";

export type ComplexityValue =
  | { checked: false }
  | {
      checked: true;
      /** POS / online-store system name (e.g. Lightspeed, Shopify). */
      name?: string;
      /** loans_mca schedule count, filing_1099 payee count. */
      count?: number;
      /** Per-proposal monthly override (new drivers only). */
      monthlyOverride?: number;
    };

export interface ComplexitySelection {
  drivers: Record<ComplexityDriverId, ComplexityValue>;
}

export type ComplexityExistingLine =
  | "staffing"
  | "platforms"
  | "passThrough"
  | "salesTaxAddon"
  | "projectTrackingAddon"
  | "mixedBooks"
  | "operations"
  | "reconciliation";

export interface ComplexityDriverDef {
  id: ComplexityDriverId;
  label: string;
  clientWhy: string;
  /** Maintain-tier fixed monthly; for filing_1099 this is the PER-PAYEE rate. */
  defaultMonthly: number;
  cleanupPerMonthAdd: number;
  /** Cap on the scaled monthly; only set for filing_1099. */
  perPayeeCap?: number;
  /** Set when an existing pricing line already covers this driver. */
  mapsToExisting: ComplexityExistingLine | null;
  /** Advisory for per-company pricing: true when the driver belongs to one file. */
  perCompany: boolean;
}

export interface ComplexityDriverDefaultEntry {
  /** Maintain-tier fixed monthly; for filing_1099 this is the PER-PAYEE rate. */
  monthly: number;
  cleanupPerMonth: number;
  /** Only meaningful for filing_1099: cap on the scaled monthly. */
  cap?: number;
}

export type ComplexityDriverDefaults = Record<ComplexityDriverId, ComplexityDriverDefaultEntry>;

/** Sparse patch: omitted drivers and omitted fields fall through resolution. */
export type ComplexityDriverDefaultsPatch = {
  [K in ComplexityDriverId]?: Partial<ComplexityDriverDefaultEntry>;
};

export interface ComplexityPricedLine {
  id: ComplexityDriverId;
  label: string;
  clientWhy: string;
  /** 0 with `includedNote` when an existing line already covers this driver. */
  monthly: number;
  includedNote?: string;
  /** Per-cleanup-month add (0 except loans_mca, personal_commingling). */
  cleanupPerMonth: number;
}

export interface ComplexityPriceResult {
  lines: ComplexityPricedLine[];
  monthlyTotal: number;
  cleanupPerMonthTotal: number;
  cleanupTotal: number;
}

export interface ComplexityPublicWhy {
  label: string;
  why: string;
  /** null when the driver is included in another priced line. */
  monthly: number | null;
}

/** Maintain-tier starting defaults (lead-confirmed placeholders; Tom decides final). */
export const DEFAULT_COMPLEXITY_DRIVER_DEFAULTS: ComplexityDriverDefaults = {
  payroll: { monthly: 0, cleanupPerMonth: 0 },
  sales_tax: { monthly: 0, cleanupPerMonth: 0 },
  job_tracking: { monthly: 0, cleanupPerMonth: 0 },
  mixed_books: { monthly: 0, cleanupPerMonth: 0 },
  inventory_cogs: { monthly: 95, cleanupPerMonth: 0 },
  pos_system: { monthly: 55, cleanupPerMonth: 0 },
  online_store: { monthly: 55, cleanupPerMonth: 0 },
  loans_mca: { monthly: 75, cleanupPerMonth: 25 },
  personal_commingling: { monthly: 110, cleanupPerMonth: 40 },
  filing_1099: { monthly: 8, cleanupPerMonth: 0, cap: 160 },
};

export const COMPLEXITY_DRIVER_IDS: readonly ComplexityDriverId[] = [
  "payroll",
  "sales_tax",
  "job_tracking",
  "mixed_books",
  "inventory_cogs",
  "pos_system",
  "online_store",
  "loans_mca",
  "personal_commingling",
  "filing_1099",
];

const COMPLEXITY_PACKAGE_IDS: readonly string[] = ["grow", "improve", "maintain"];

/**
 * Tier multipliers derived from the existing package lines (see module doc):
 * improve = 150/120 = 1.25, grow = 190/120. Falls back to 1 when the
 * constants cannot produce a finite ratio, so a zeroed constant can never
 * zero out or NaN the new money.
 */
function tierMultiplier(packageId: PackageId): number {
  const maintain = PACKAGE_PRICING.maintain.pricing.complexOperationsMonthly;
  const tier = PACKAGE_PRICING[packageId].pricing.complexOperationsMonthly;
  if (!Number.isFinite(maintain) || maintain <= 0) return 1;
  const ratio = tier / maintain;
  return Number.isFinite(ratio) && ratio > 0 ? ratio : 1;
}

/** Maintain values pass through; improve/grow scale by the tier ratio, ceil $5. */
function tierMonthly(maintainValue: number, packageId: PackageId): number {
  if (packageId === "maintain") return maintainValue;
  return roundUpToNearestIncrement(maintainValue * tierMultiplier(packageId));
}

function normalizePackageId(value: unknown): PackageId {
  return typeof value === "string" && (COMPLEXITY_PACKAGE_IDS as readonly string[]).includes(value)
    ? (value as PackageId)
    : "maintain";
}

function normalizeCleanupMonths(value: unknown): number {
  if (typeof value !== "number" || !Number.isFinite(value)) return 0;
  return Math.max(0, Math.trunc(value));
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function finiteOrUndefined(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function nonNegativeInt(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value) && value >= 0) {
    return Math.min(1_000_000, Math.trunc(value));
  }
  if (typeof value === "string" && value.trim().length > 0) {
    const parsed = Number(value);
    if (Number.isFinite(parsed) && parsed >= 0) {
      return Math.min(1_000_000, Math.trunc(parsed));
    }
  }
  return undefined;
}

function isDriverId(value: unknown): value is ComplexityDriverId {
  return typeof value === "string" && (COMPLEXITY_DRIVER_IDS as readonly string[]).includes(value);
}

function normalizeComplexityValue(raw: unknown): ComplexityValue {
  if (!isRecord(raw) || raw.checked !== true) return { checked: false };
  const value: Extract<ComplexityValue, { checked: true }> = { checked: true };
  if (typeof raw.name === "string" && raw.name.trim().length > 0) {
    value.name = raw.name.trim().slice(0, 200);
  }
  const count = nonNegativeInt(raw.count);
  if (count !== undefined) value.count = count;
  const override = finiteOrUndefined(raw.monthlyOverride);
  if (override !== undefined && override >= 0) value.monthlyOverride = override;
  return value;
}

/**
 * Tolerant like `normalizeCompanyBundle`: accepts a full
 * `{ drivers: {...} }` selection or a bare drivers record; junk anywhere
 * (including the whole input) normalizes to unchecked. Unknown ids dropped.
 */
export function normalizeComplexitySelection(raw: unknown): ComplexitySelection {
  const drivers = (isRecord(raw) && isRecord(raw.drivers) ? raw.drivers : isRecord(raw) ? raw : {}) as Record<
    string,
    unknown
  >;
  const result = {} as Record<ComplexityDriverId, ComplexityValue>;
  for (const id of COMPLEXITY_DRIVER_IDS) {
    result[id] = normalizeComplexityValue(drivers[id]);
  }
  return { drivers: result };
}

/** True when at least one driver is checked. Accepts raw (unnormalized) input. */
export function hasComplexitySelection(raw: unknown): boolean {
  return COMPLEXITY_DRIVER_IDS.some(
    (id) => normalizeComplexitySelection(raw).drivers[id].checked === true,
  );
}

function sanitizeDefaultEntry(raw: unknown): Partial<ComplexityDriverDefaultEntry> | undefined {
  if (!isRecord(raw)) return undefined;
  const entry: Partial<ComplexityDriverDefaultEntry> = {};
  const monthly = finiteOrUndefined(raw.monthly);
  if (monthly !== undefined && monthly >= 0) entry.monthly = monthly;
  const cleanup = finiteOrUndefined(raw.cleanupPerMonth);
  if (cleanup !== undefined && cleanup >= 0) entry.cleanupPerMonth = cleanup;
  const cap = finiteOrUndefined(raw.cap);
  if (cap !== undefined && cap >= 0) entry.cap = cap;
  return Object.keys(entry).length > 0 ? entry : undefined;
}

/**
 * Storage-shape sanitizer for raw template/proposal defaults (mirrors
 * `sanitizeBundlePricingDefaults`): finite values >= 0 are kept, anything
 * else stays UNSET so resolution falls through. Omission is preserved —
 * in particular a missing field never fills in the code default here.
 */
export function sanitizeComplexityDriverDefaults(raw: unknown): ComplexityDriverDefaultsPatch {
  if (!isRecord(raw)) return {};
  const patch: ComplexityDriverDefaultsPatch = {};
  for (const id of COMPLEXITY_DRIVER_IDS) {
    const entry = sanitizeDefaultEntry(raw[id]);
    if (entry !== undefined) patch[id] = entry;
  }
  return patch;
}

function pickNumber(...candidates: Array<number | undefined>): number | undefined {
  for (const candidate of candidates) {
    if (candidate !== undefined && Number.isFinite(candidate) && candidate >= 0) return candidate;
  }
  return undefined;
}

/**
 * Canonical resolution (mirrors `resolveBundlePricingOptions`): per-proposal
 * override wins field by field, then the options-template defaults, then
 * the code defaults. `cap` resolves only for filing_1099; other drivers
 * never carry one.
 */
export function resolveComplexityDriverDefaults(input: {
  override?: unknown;
  template?: unknown;
}): ComplexityDriverDefaults {
  const override = sanitizeComplexityDriverDefaults(input.override);
  const template = sanitizeComplexityDriverDefaults(input.template);
  const fallback = DEFAULT_COMPLEXITY_DRIVER_DEFAULTS;
  const result = {} as ComplexityDriverDefaults;
  for (const id of COMPLEXITY_DRIVER_IDS) {
    const monthly =
      pickNumber(override[id]?.monthly, template[id]?.monthly, fallback[id].monthly) ??
      fallback[id].monthly;
    const cleanupPerMonth =
      pickNumber(
        override[id]?.cleanupPerMonth,
        template[id]?.cleanupPerMonth,
        fallback[id].cleanupPerMonth,
      ) ?? fallback[id].cleanupPerMonth;
    const entry: ComplexityDriverDefaultEntry = { monthly, cleanupPerMonth };
    if (id === "filing_1099") {
      entry.cap =
        pickNumber(override[id]?.cap, template[id]?.cap, fallback[id].cap) ?? fallback[id].cap;
    }
    result[id] = entry;
  }
  return result;
}

interface StaticDef {
  label: string;
  clientWhy: string;
  mapsToExisting: ComplexityExistingLine | null;
  includedNote?: string;
  perCompany: boolean;
}

const STATIC_DEFS: Record<ComplexityDriverId, StaticDef> = {
  payroll: {
    label: "Payroll",
    clientWhy: "We keep payroll and contractor payments reconciled each month.",
    mapsToExisting: "staffing",
    includedNote: "Included in staffing line",
    perCompany: true,
  },
  sales_tax: {
    label: "Sales tax filing",
    clientWhy: "We calculate, file, and remit your sales tax.",
    mapsToExisting: "salesTaxAddon",
    includedNote: "Included in Sales Tax Filing & Remittance",
    perCompany: false,
  },
  job_tracking: {
    label: "Job / project tracking",
    clientWhy: "We track income and costs by job or project.",
    mapsToExisting: "projectTrackingAddon",
    includedNote: "Included in Project Tracking",
    perCompany: true,
  },
  mixed_books: {
    label: "Mixed books",
    clientWhy: "We separate business activity from other activity in the same file.",
    mapsToExisting: "mixedBooks",
    includedNote: "Included in books type adjustment",
    perCompany: false,
  },
  inventory_cogs: {
    label: "Inventory and cost of goods",
    clientWhy: "We track stock and cost of goods sold each month.",
    mapsToExisting: null,
    perCompany: false,
  },
  pos_system: {
    label: "Point-of-sale system",
    clientWhy: "We reconcile sales from your point-of-sale system each month.",
    mapsToExisting: null,
    perCompany: false,
  },
  online_store: {
    label: "Online store",
    clientWhy: "We reconcile sales from your online store each month.",
    mapsToExisting: null,
    perCompany: false,
  },
  loans_mca: {
    label: "Loans and cash advances",
    clientWhy: "We track loan and cash-advance balances and payments each month.",
    mapsToExisting: null,
    perCompany: false,
  },
  personal_commingling: {
    label: "Personal spending in the business",
    clientWhy: "We sort out personal spending mixed into the business books.",
    mapsToExisting: null,
    perCompany: true,
  },
  filing_1099: {
    label: "1099 filing",
    clientWhy: "We prepare and file 1099s for your payees.",
    mapsToExisting: null,
    perCompany: true,
  },
};

/**
 * Driver definitions with maintain-tier defaults applied. Accepts a full
 * resolved `ComplexityDriverDefaults` or a sparse patch — missing entries
 * fall back to the code defaults per field.
 */
export function complexityDriverDefs(
  defaults?: ComplexityDriverDefaults | ComplexityDriverDefaultsPatch,
): ComplexityDriverDef[] {
  const resolved = resolveComplexityDriverDefaults({ override: defaults });
  return COMPLEXITY_DRIVER_IDS.map((id) => {
    const def: ComplexityDriverDef = {
      id,
      label: STATIC_DEFS[id].label,
      clientWhy: STATIC_DEFS[id].clientWhy,
      defaultMonthly: resolved[id].monthly,
      cleanupPerMonthAdd: resolved[id].cleanupPerMonth,
      mapsToExisting: STATIC_DEFS[id].mapsToExisting,
      perCompany: STATIC_DEFS[id].perCompany,
    };
    if (id === "filing_1099") def.perPayeeCap = resolved[id].cap;
    return def;
  });
}

function includedNoteFor(id: ComplexityDriverId): string {
  return STATIC_DEFS[id].includedNote ?? "Included in another line";
}

/**
 * The one pricing call. Unchecked drivers emit nothing. Existing-line
 * drivers emit a $0 line with `includedNote` (override ignored — charging
 * it would stack on the existing line). New drivers charge
 * `monthlyOverride` when set, else the tier-scaled default; filing_1099
 * charges `min(payees x tierRate, tierCap)`.
 */
export function priceComplexityDrivers(
  selection: ComplexitySelection,
  opts: {
    packageId?: unknown;
    defaults?: ComplexityDriverDefaults | ComplexityDriverDefaultsPatch;
    cleanupMonths?: unknown;
  } = {},
): ComplexityPriceResult {
  const packageId = normalizePackageId(opts.packageId);
  const defaults = resolveComplexityDriverDefaults({ override: opts.defaults });
  const cleanupMonths = normalizeCleanupMonths(opts.cleanupMonths);
  const normalized = normalizeComplexitySelection(
    isRecord(selection) ? selection : {},
  );

  const lines: ComplexityPricedLine[] = [];
  for (const id of COMPLEXITY_DRIVER_IDS) {
    const value: ComplexityValue = normalized.drivers[id] ?? { checked: false };
    if (value.checked !== true) continue;
    const def = STATIC_DEFS[id];
    if (def.mapsToExisting !== null) {
      lines.push({
        id,
        label: def.label,
        clientWhy: def.clientWhy,
        monthly: 0,
        includedNote: includedNoteFor(id),
        cleanupPerMonth: 0,
      });
      continue;
    }
    const override =
      value.monthlyOverride !== undefined &&
      Number.isFinite(value.monthlyOverride) &&
      value.monthlyOverride >= 0
        ? value.monthlyOverride
        : undefined;
    if (id === "filing_1099") {
      const count =
        nonNegativeInt(value.count) ?? 0;
      const rate = tierMonthly(defaults[id].monthly, packageId);
      const cap = tierMonthly(defaults[id].cap ?? DEFAULT_COMPLEXITY_DRIVER_DEFAULTS.filing_1099.cap ?? 160, packageId);
      const monthly = override ?? Math.min(count * rate, cap);
      lines.push({
        id,
        label: def.label,
        clientWhy: def.clientWhy,
        monthly,
        cleanupPerMonth: 0,
      });
      continue;
    }
    lines.push({
      id,
      label: def.label,
      clientWhy: def.clientWhy,
      monthly: override ?? tierMonthly(defaults[id].monthly, packageId),
      cleanupPerMonth:
        cleanupMonths > 0 ? tierMonthly(defaults[id].cleanupPerMonth, packageId) : 0,
    });
  }

  const monthlyTotal = lines.reduce((total, line) => total + line.monthly, 0);
  const cleanupPerMonthTotal = lines.reduce((total, line) => total + line.cleanupPerMonth, 0);
  return {
    lines,
    monthlyTotal,
    cleanupPerMonthTotal,
    cleanupTotal: cleanupPerMonthTotal * cleanupMonths,
  };
}

/**
 * Client-facing "Why this price" whitelist: labels, plain reasons, amounts
 * only. `includedNote` internals never leave this module — an included
 * driver publishes `monthly: null`. Unknown/junk input publishes nothing.
 */
export function toPublicComplexityWhy(lines: unknown): ComplexityPublicWhy[] {
  if (!Array.isArray(lines)) return [];
  const result: ComplexityPublicWhy[] = [];
  for (const line of lines) {
    if (!isRecord(line)) continue;
    if (!isDriverId(line.id)) continue;
    if (typeof line.label !== "string" || typeof line.clientWhy !== "string") continue;
    if (typeof line.monthly !== "number" || !Number.isFinite(line.monthly)) continue;
    result.push({
      label: line.label,
      why: line.clientWhy,
      monthly: typeof line.includedNote === "string" ? null : Math.max(0, line.monthly),
    });
  }
  return result;
}
