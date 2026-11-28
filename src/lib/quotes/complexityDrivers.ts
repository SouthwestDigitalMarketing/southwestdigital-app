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
 * books-type adjustment). Checked, when that existing line is present it
 * emits a priced line with `monthly: 0` and an `includedNote` naming the
 * existing line — never an extra charge. When the existing line is absent
 * (see the `existing` presence input) the line keeps `monthly: 0` but
 * carries `requiresExistingLine` naming the missing line instead of an
 * "Included" note, so the wiring builder can turn that add-on on.
 * Only `mapsToExisting: null` drivers add new monthly money.
 *
 * Tier scaling rule: maintain-tier amounts are the code defaults below.
 * Improve scales by the complexOperationsMonthly anchor ratio live from
 * `packagePricing` (improve 150 / maintain 120 = x1.25), rounded UP to $5
 * with `roundUpToNearestIncrement`. Anchor honesty note: 1.25 is the
 * complex-operations line's ratio only — staffing (45/35), mixed-books
 * (175/130), platform (55/40) each scale differently in the pipeline. The
 * module deliberately anchors every driver to complexOperationsMonthly so
 * there is one predictable rule.
 * Grow is NEVER priced bottom-up: like the pipeline's
 * `applyGrowPriceOverride`, every grow amount (monthly and cleanup add) is
 * the maintain-tier amount x GROW_PRICE_MULTIPLIER_FROM_MAINTAIN (1.5),
 * rounded UP to $5 with the same `roundUpToNearestIncrement`. Per-line grow
 * values are each ceiled, so a set of grow lines can sum ABOVE
 * ceil5(maintain total x 1.5) by less than $5 per extra line. The pipeline
 * charges the total from `complexityGrowMonthlyTotal`; the UI shows the
 * per-line values with that total as the charged figure.
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
 * charge on top of the existing line. A `monthlyOverride` is EXACT: it
 * bypasses tier scaling and, for `filing_1099`, the per-payee cap.
 *
 * `filing_1099` pricing: `monthly = min(payeeCount x perPayeeRate, cap)`
 * at maintain/improve (both scaled by the tier rule); grow is the maintain
 * monthly x 1.5 ceil $5. The def's `defaultMonthly` IS the per-payee rate
 * and `perPayeeCap` is the cap. Checked 1099 with no payee count (0 or
 * absent) and no override emits NO line. `loans_mca` `count` is
 * informational (lender/MCA schedule count) and does not scale the flat
 * monthly; `name` on `pos_system`/`online_store` is the system name
 * (e.g. Lightspeed, Shopify) and likewise does not affect the price — it
 * is named in the priced line's `clientWhy` instead. The 1099 payee count
 * is likewise named in its priced `clientWhy`.
 *
 * Distinct-work decision (Foreman default, pending Ummon confirmation):
 * `online_store` vs the Stripe entry in payment platforms, `loans_mca` vs
 * the loansCount-driven reconciliation line, `filing_1099` vs contractor
 * headcount inside staffing, and `personal_commingling` vs the
 * `mixed_books` adjustment are DISTINCT work — each side charges its own
 * line when checked, and neither side auto-checks the other.
 */
import {
  GROW_PRICE_MULTIPLIER_FROM_MAINTAIN,
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

/**
 * Existing pricing lines a driver can map to. Only lines a driver actually
 * maps to are members — each `mapsToExisting` value below names the single
 * source of truth the wiring builder reads to turn that line on.
 */
export type ComplexityExistingLine =
  | "staffing"
  | "salesTaxAddon"
  | "projectTrackingAddon"
  | "mixedBooks";

/**
 * Which existing pricing lines are active on the proposal. The wiring
 * builder passes what it sees: add-on flags for the optional add-ons,
 * the books-type flag, and the staffing headcount (0 = no staffing line).
 * Omitted `existing` — or an omitted field — defaults to present, so calls
 * that do not track presence keep the legacy "Included" behavior.
 */
export interface ComplexityExistingPresence {
  salesTaxAddon: boolean;
  projectTrackingAddon: boolean;
  mixedBooks: boolean;
  staffingHeadcount: number;
}

export interface ComplexityDriverDef {
  id: ComplexityDriverId;
  label: string;
  clientWhy: string;
  /**
   * Builder-checklist note shown next to the label (not client-facing).
   * Only set where the checklist row needs a counted-once warning.
   */
  builderHint?: string;
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
  /**
   * Set instead of `includedNote` when the existing line covering this
   * driver is absent. Names the missing line (the `mapsToExisting` value)
   * so the wiring builder can turn that add-on on. Never set alongside
   * `includedNote`.
   */
  requiresExistingLine?: ComplexityExistingLine;
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
  id: ComplexityDriverId;
  label: string;
  why: string;
  /** null when the driver is included in (or waiting on) another priced line. */
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
 * Improve multiplier from the complexOperationsMonthly anchor (see module
 * doc): improve 150 / maintain 120 = 1.25. Falls back to 1 when the
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

/** Maintain values pass through; improve scales by the anchor ratio, ceil $5. */
function tierMonthly(maintainValue: number, packageId: PackageId): number {
  if (packageId === "maintain") return maintainValue;
  return roundUpToNearestIncrement(maintainValue * tierMultiplier(packageId));
}

/**
 * Grow derives from the maintain-tier amount with the SAME rule the
 * pipeline's `applyGrowPriceOverride` uses: ceil5(maintain x 1.5).
 */
function growMonthly(maintainValue: number): number {
  return roundUpToNearestIncrement(
    maintainValue * GROW_PRICE_MULTIPLIER_FROM_MAINTAIN,
  );
}

/**
 * Pipeline-consistent grow total: the figure the pipeline charges for a
 * maintain-tier complexity total. Per-line grow values are each ceiled to
 * $5, so their sum can exceed this by less than $5 per extra line — the
 * charged total is this helper's return, not the sum.
 */
export function complexityGrowMonthlyTotal(maintainMonthlyTotal: number): number {
  if (!Number.isFinite(maintainMonthlyTotal) || maintainMonthlyTotal <= 0) return 0;
  return roundUpToNearestIncrement(
    maintainMonthlyTotal * GROW_PRICE_MULTIPLIER_FROM_MAINTAIN,
  );
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

/**
 * Non-negative finite number, coercing numeric strings ("100" -> 100).
 * Anything else (including negatives, NaN, Infinity, blank) is undefined.
 */
function nonNegativeNumber(value: unknown): number | undefined {
  if (typeof value === "number") {
    return Number.isFinite(value) && value >= 0 ? value : undefined;
  }
  if (typeof value === "string" && value.trim().length > 0) {
    const parsed = Number(value.trim());
    if (Number.isFinite(parsed) && parsed >= 0) return parsed;
  }
  return undefined;
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
  const override = nonNegativeNumber(raw.monthlyOverride);
  if (override !== undefined) value.monthlyOverride = override;
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
  const normalized = normalizeComplexitySelection(raw);
  return COMPLEXITY_DRIVER_IDS.some((id) => normalized.drivers[id].checked === true);
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
  builderHint?: string;
  mapsToExisting: ComplexityExistingLine | null;
  includedNote?: string;
  perCompany: boolean;
}

const STATIC_DEFS: Record<ComplexityDriverId, StaticDef> = {
  payroll: {
    label: "Payroll",
    clientWhy:
      "Covered by the staffing line — we keep payroll and contractor payments reconciled each month.",
    mapsToExisting: "staffing",
    includedNote: "Included in staffing line",
    perCompany: true,
  },
  sales_tax: {
    label: "Sales tax filing",
    clientWhy:
      "Covered by the Sales Tax Filing & Remittance add-on — we calculate, file, and remit your sales tax.",
    mapsToExisting: "salesTaxAddon",
    includedNote: "Included in Sales Tax Filing & Remittance",
    perCompany: false,
  },
  job_tracking: {
    label: "Job / project tracking",
    clientWhy:
      "Covered by the Project Tracking add-on — we track income and costs by job or project.",
    mapsToExisting: "projectTrackingAddon",
    includedNote: "Included in Project Tracking",
    perCompany: true,
  },
  mixed_books: {
    label: "Mixed books",
    clientWhy:
      "Covered by the books-type adjustment — we separate business activity from other activity in the same file.",
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
    clientWhy: "We reconcile daily sales, tips, and fees from your point-of-sale system each month.",
    mapsToExisting: null,
    perCompany: false,
  },
  online_store: {
    label: "Online store",
    clientWhy: "We reconcile store sales, fees, refunds, and payouts from your online store each month.",
    builderHint:
      "If the store's own payout channel (e.g. Shopify Payments) is also listed as a payment platform, it is counted once here.",
    mapsToExisting: null,
    perCompany: false,
  },
  loans_mca: {
    label: "Merchant cash advances and loans with principal / interest / fee splits",
    clientWhy:
      "We split each payment into principal, interest, and fees and track the balance each month — plain loan reconciliation is already in the reconciliation line.",
    builderHint:
      "Plain loan reconciliation is already in the reconciliation line — check this only when a payment needs a principal / interest / fee split.",
    mapsToExisting: null,
    perCompany: false,
  },
  personal_commingling: {
    label: "Personal spending in the business",
    clientWhy:
      "We separate personal spending from business transactions each month — different from mixed books (real estate plus another business).",
    mapsToExisting: null,
    perCompany: true,
  },
  filing_1099: {
    label: "1099 filing",
    clientWhy:
      "We handle year-end W-9 collection and 1099 filing for your payees — separate from monthly contractor bookkeeping.",
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
    if (STATIC_DEFS[id].builderHint !== undefined) def.builderHint = STATIC_DEFS[id].builderHint;
    if (id === "filing_1099") def.perPayeeCap = resolved[id].cap;
    return def;
  });
}

function includedNoteFor(id: ComplexityDriverId): string {
  return STATIC_DEFS[id].includedNote ?? "Included in another line";
}

/**
 * Priced-line why with the selection's own details named: the POS /
 * online-store system name and the 1099 payee count. Falls back to the
 * static def why when the detail is absent.
 */
function pricedClientWhy(id: ComplexityDriverId, value: ComplexityValue): string {
  if (value.checked === true) {
    if ((id === "pos_system" || id === "online_store") && value.name) {
      return id === "pos_system"
        ? `We reconcile daily sales, tips, and fees from ${value.name} each month.`
        : `We reconcile store sales, fees, refunds, and payouts from ${value.name} each month.`;
    }
    if (id === "filing_1099" && value.count !== undefined && value.count > 0) {
      const noun = value.count === 1 ? "payee" : "payees";
      return `Year-end W-9 collection and 1099 filing for ${value.count} ${noun} — separate from monthly contractor bookkeeping.`;
    }
  }
  return STATIC_DEFS[id].clientWhy;
}

function normalizeExistingPresence(raw: unknown): ComplexityExistingPresence {
  const record = isRecord(raw) ? raw : {};
  return {
    salesTaxAddon: record.salesTaxAddon === undefined ? true : record.salesTaxAddon === true,
    projectTrackingAddon:
      record.projectTrackingAddon === undefined ? true : record.projectTrackingAddon === true,
    mixedBooks: record.mixedBooks === undefined ? true : record.mixedBooks === true,
    staffingHeadcount:
      record.staffingHeadcount === undefined
        ? 1
        : (nonNegativeInt(record.staffingHeadcount) ?? 0),
  };
}

function isExistingLinePresent(
  line: ComplexityExistingLine,
  existing: ComplexityExistingPresence,
): boolean {
  switch (line) {
    case "staffing":
      return existing.staffingHeadcount > 0;
    case "salesTaxAddon":
      return existing.salesTaxAddon;
    case "projectTrackingAddon":
      return existing.projectTrackingAddon;
    case "mixedBooks":
      return existing.mixedBooks;
  }
}

/**
 * The one pricing call. Unchecked drivers emit nothing. Existing-line
 * drivers emit a $0 line with `includedNote` when that existing line is
 * present (override ignored — charging it would stack on the existing
 * line), or with `requiresExistingLine` when it is absent. New drivers
 * charge the EXACT `monthlyOverride` when set, else the maintain default
 * scaled by tier (improve) or derived from maintain x 1.5 (grow);
 * filing_1099 charges `min(payees x rate, cap)` at maintain, scaled the
 * same way, and emits no line when the payee count is 0/absent unless an
 * override sets the price.
 */
export function priceComplexityDrivers(
  selection: ComplexitySelection,
  opts: {
    packageId?: unknown;
    defaults?: ComplexityDriverDefaults | ComplexityDriverDefaultsPatch;
    cleanupMonths?: unknown;
    existing?: unknown;
  } = {},
): ComplexityPriceResult {
  const packageId = normalizePackageId(opts.packageId);
  const defaults = resolveComplexityDriverDefaults({ override: opts.defaults });
  const cleanupMonths = normalizeCleanupMonths(opts.cleanupMonths);
  const existing = normalizeExistingPresence(opts.existing);
  const normalized = normalizeComplexitySelection(
    isRecord(selection) ? selection : {},
  );

  const lines: ComplexityPricedLine[] = [];
  for (const id of COMPLEXITY_DRIVER_IDS) {
    const value: ComplexityValue = normalized.drivers[id] ?? { checked: false };
    if (value.checked !== true) continue;
    const def = STATIC_DEFS[id];
    if (def.mapsToExisting !== null) {
      const base = {
        id,
        label: def.label,
        clientWhy: def.clientWhy,
        monthly: 0,
        cleanupPerMonth: 0,
      };
      lines.push(
        isExistingLinePresent(def.mapsToExisting, existing)
          ? { ...base, includedNote: includedNoteFor(id) }
          : { ...base, requiresExistingLine: def.mapsToExisting },
      );
      continue;
    }
    const override =
      value.monthlyOverride !== undefined &&
      Number.isFinite(value.monthlyOverride) &&
      value.monthlyOverride >= 0
        ? value.monthlyOverride
        : undefined;
    const clientWhy = pricedClientWhy(id, value);
    const cleanupBase = defaults[id].cleanupPerMonth;
    const cleanupPerMonth =
      cleanupMonths > 0
        ? packageId === "grow"
          ? growMonthly(cleanupBase)
          : tierMonthly(cleanupBase, packageId)
        : 0;
    if (id === "filing_1099") {
      const count = value.count ?? 0;
      if (override === undefined && count <= 0) continue;
      const maintainMonthly =
        override ??
        Math.min(
          count * defaults[id].monthly,
          defaults[id].cap ?? DEFAULT_COMPLEXITY_DRIVER_DEFAULTS.filing_1099.cap ?? 160,
        );
      const monthly =
        override ?? (packageId === "grow" ? growMonthly(maintainMonthly) : tierMonthly(maintainMonthly, packageId));
      lines.push({
        id,
        label: def.label,
        clientWhy,
        monthly,
        cleanupPerMonth: 0,
      });
      continue;
    }
    const maintainMonthly = override ?? defaults[id].monthly;
    const monthly =
      override ?? (packageId === "grow" ? growMonthly(maintainMonthly) : tierMonthly(maintainMonthly, packageId));
    lines.push({
      id,
      label: def.label,
      clientWhy,
      monthly,
      cleanupPerMonth,
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
 * Client-facing "Why this price" whitelist: driver id, labels, plain
 * reasons, amounts only. `includedNote` / `requiresExistingLine` internals
 * never leave this module — an included (or waiting-on-a-line) driver
 * publishes `monthly: null`. Unknown/junk input publishes nothing.
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
      id: line.id,
      label: line.label,
      why: line.clientWhy,
      monthly:
        typeof line.includedNote === "string" || typeof line.requiresExistingLine === "string"
          ? null
          : Math.max(0, line.monthly),
    });
  }
  return result;
}
