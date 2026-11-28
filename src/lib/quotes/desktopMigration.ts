/**
 * Spec 05 desktop-migration pricing core (pure, no React, no prisma).
 *
 * A new proposal identifies its flat $640 migration option by CONTENT (a
 * required one-time additional option whose normalized name matches
 * /desktop.*online.*migration/i) or by the explicit `role:
 * "desktop-migration"` staff can set on an additional option. Legacy
 * proposals (no `desktopMigration` selection on the assessment) keep the
 * flat option untouched — never re-priced.
 *
 * When a sized migration is chosen the flat option is suppressed (never
 * stacks): see `findSuppressedFlatMigrationOptions`, wired into
 * `proposalServiceAddOns` like the `bundleOwnsNewFileSetup` guard.
 *
 * Money resolution per field (mirrors Spec 02 `resolveBundlePricingOptions`
 * and Spec 03 `resolveComplexityDriverDefaults`): per-proposal `overrides`
 * on the selection, then the options-template `desktopMigrationDefaults`,
 * then the code defaults below. Tom decides final amounts; these are
 * editable placeholders.
 *
 * Choice rules:
 * - `fresh_start`: flat base only (plus ticked add-ons, the included
 *   tie-out, and per-file charges). History years and the volume factor
 *   never apply — a fresh start moves lists and balances, not history.
 * - `full_history`: base + per-year (capped) + volume add by Spec 01 band.
 *   Add-ons apply when ticked, same as fresh start.
 * - No band signal (no inventory, manual/unknown band, junk): falls back to
 *   the smallest-volume add, so a missing size signal can never inflate a
 *   quote. The volume line names the fallback explicitly.
 * - Computed lines with a $0 amount are omitted (except the included
 *   tie-out, which is the receipt that the check happened). The base line
 *   is always emitted when a choice is set.
 */

export type DesktopMigrationChoice = "fresh_start" | "full_history";

export interface DesktopMigrationPricingOptions {
  /** Fresh-start price and the base of the full-history price. */
  baseAmount: number;
  /** Full history: price per year of history moved. */
  historyPerYear: number;
  /** Full history: maximum billable years of history. */
  historyYearCap: number;
  /** Full history: volume add for the smallest band. */
  bandAdd0to99: number;
  bandAdd100to499: number;
  bandAdd500to999: number;
  bandAdd1000plus: number;
  /** Add-on: payroll history. */
  payrollHistoryAdd: number;
  /** Add-on: inventory. */
  inventoryAdd: number;
  /** Add-on: open jobs / projects. */
  openJobsAdd: number;
  /** Per additional Desktop company file beyond the main file. */
  extraFileAdd: number;
}

export type DesktopMigrationPricingKey = keyof DesktopMigrationPricingOptions;

/** Editable placeholders (Tom decides final); fresh start holds near $640. */
export const DEFAULT_DESKTOP_MIGRATION_OPTIONS: DesktopMigrationPricingOptions = {
  baseAmount: 640,
  historyPerYear: 150,
  historyYearCap: 5,
  bandAdd0to99: 0,
  bandAdd100to499: 150,
  bandAdd500to999: 300,
  bandAdd1000plus: 500,
  payrollHistoryAdd: 150,
  inventoryAdd: 200,
  openJobsAdd: 150,
  extraFileAdd: 250,
};

export interface DesktopMigrationSelection {
  choice: DesktopMigrationChoice | null;
  historyYears?: number;
  payrollHistory?: boolean;
  inventory?: boolean;
  openJobs?: boolean;
  overrides?: Partial<DesktopMigrationPricingOptions>;
}

export type DesktopMigrationLineKind =
  | "base"
  | "history"
  | "volume"
  | "addon"
  | "extra_file"
  | "included";

export interface DesktopMigrationLine {
  id: string;
  label: string;
  amount: number;
  kind: DesktopMigrationLineKind;
}

export interface DesktopMigrationPriceResult {
  lines: DesktopMigrationLine[];
  total: number;
}

export type DesktopMigrationBand = "0-99" | "100-499" | "500-999" | "1000+";

const BAND_ADDS: Record<DesktopMigrationBand, DesktopMigrationPricingKey> = {
  "0-99": "bandAdd0to99",
  "100-499": "bandAdd100to499",
  "500-999": "bandAdd500to999",
  "1000+": "bandAdd1000plus",
};

const BANDS: readonly DesktopMigrationBand[] = ["0-99", "100-499", "500-999", "1000+"];

/** Explicit staff marker for the flat option; content match is the fallback. */
export const DESKTOP_MIGRATION_OPTION_ROLE = "desktop-migration";

/** Normalized-name content match for the legacy flat migration option. */
const FLAT_MIGRATION_NAME_PATTERN = /desktop.*online.*migration/i;

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
    const parsed = Number(value.trim());
    if (Number.isFinite(parsed) && parsed >= 0) {
      return Math.min(1_000_000, Math.trunc(parsed));
    }
  }
  return undefined;
}

/**
 * Storage-shape sanitizer (mirrors `sanitizeBundlePricingDefaults`):
 * finite numbers >= 0 are kept, anything else stays UNSET so resolution
 * falls through. Omission is preserved — a missing field never fills in
 * the code default here.
 */
export function sanitizeDesktopMigrationDefaults(
  raw: unknown,
): Partial<DesktopMigrationPricingOptions> {
  if (!isRecord(raw)) return {};
  const partial: Partial<DesktopMigrationPricingOptions> = {};
  const moneyKeys: readonly DesktopMigrationPricingKey[] = [
    "baseAmount",
    "historyPerYear",
    "bandAdd0to99",
    "bandAdd100to499",
    "bandAdd500to999",
    "bandAdd1000plus",
    "payrollHistoryAdd",
    "inventoryAdd",
    "openJobsAdd",
    "extraFileAdd",
  ];
  for (const key of moneyKeys) {
    const value = finiteOrUndefined(raw[key]);
    if (value !== undefined && value >= 0) partial[key] = value;
  }
  const cap = nonNegativeInt(raw.historyYearCap);
  if (cap !== undefined) partial.historyYearCap = cap;
  return partial;
}

function pickNumber(...candidates: Array<number | undefined>): number | undefined {
  for (const candidate of candidates) {
    if (candidate !== undefined && Number.isFinite(candidate) && candidate >= 0) {
      return candidate;
    }
  }
  return undefined;
}

/**
 * Canonical resolution: per-proposal `override` wins field by field, then
 * the options-template `template` defaults, then the code defaults.
 */
export function resolveDesktopMigrationOptions(input: {
  override?: unknown;
  template?: unknown;
}): DesktopMigrationPricingOptions {
  const override = sanitizeDesktopMigrationDefaults(input.override);
  const template = sanitizeDesktopMigrationDefaults(input.template);
  const fallback = DEFAULT_DESKTOP_MIGRATION_OPTIONS;
  const pick = (key: DesktopMigrationPricingKey): number =>
    pickNumber(override[key], template[key], fallback[key]) ?? fallback[key];
  return {
    baseAmount: pick("baseAmount"),
    historyPerYear: pick("historyPerYear"),
    historyYearCap: Math.trunc(pick("historyYearCap")),
    bandAdd0to99: pick("bandAdd0to99"),
    bandAdd100to499: pick("bandAdd100to499"),
    bandAdd500to999: pick("bandAdd500to999"),
    bandAdd1000plus: pick("bandAdd1000plus"),
    payrollHistoryAdd: pick("payrollHistoryAdd"),
    inventoryAdd: pick("inventoryAdd"),
    openJobsAdd: pick("openJobsAdd"),
    extraFileAdd: pick("extraFileAdd"),
  };
}

/**
 * Tolerant like `normalizeCompanyBundle`: accepts a full selection record;
 * junk anywhere (including the whole input) normalizes to no choice.
 * Unknown extra keys are dropped; `overrides` is sanitized and omitted
 * when empty so snapshots stay clean.
 */
export function normalizeDesktopMigrationSelection(raw: unknown): DesktopMigrationSelection {
  const record = isRecord(raw) ? raw : {};
  const choice =
    record.choice === "fresh_start" || record.choice === "full_history"
      ? record.choice
      : null;
  const selection: DesktopMigrationSelection = { choice };
  const years = nonNegativeInt(record.historyYears);
  if (years !== undefined) selection.historyYears = years;
  if (record.payrollHistory === true) selection.payrollHistory = true;
  if (record.inventory === true) selection.inventory = true;
  if (record.openJobs === true) selection.openJobs = true;
  const overrides = sanitizeDesktopMigrationDefaults(record.overrides);
  if (Object.keys(overrides).length > 0) selection.overrides = overrides;
  return selection;
}

function normalizeBand(raw: unknown): DesktopMigrationBand | null {
  if (typeof raw !== "string") return null;
  const band = raw.trim();
  return (BANDS as readonly string[]).includes(band) ? (band as DesktopMigrationBand) : null;
}

function normalizeExtraFiles(raw: unknown): number {
  return nonNegativeInt(raw) ?? 0;
}

/** True when a sized migration is chosen (legacy proposals have none). */
export function hasDesktopMigrationSelection(raw: unknown): boolean {
  return normalizeDesktopMigrationSelection(raw).choice !== null;
}

export function priceDesktopMigration(input: {
  selection: unknown;
  /** Spec 01 derived band, manual band, or anything else (falls back). */
  band?: unknown;
  /** Count of Spec 02 companies with fileStatus desktop_to_online beyond main. */
  extraDesktopFiles?: unknown;
  /** Resolved options, a Partial (completed from defaults), or {override, template}. */
  options?: unknown;
}): DesktopMigrationPriceResult {
  const selection = normalizeDesktopMigrationSelection(input.selection);
  if (selection.choice === null) return { lines: [], total: 0 };
  // A Partial can never carry `override`/`template` (they are not pricing
  // keys), so their presence unambiguously selects the pair form. The
  // selection's own `overrides` win key by key over an `override` passed
  // alongside `options` — both beat the template, which beats the code
  // defaults.
  const pairForm =
    isRecord(input.options) &&
    ("override" in input.options || "template" in input.options)
      ? (input.options as { override?: unknown; template?: unknown })
      : { override: input.options, template: undefined as unknown };
  const options = resolveDesktopMigrationOptions({
    override: {
      ...sanitizeDesktopMigrationDefaults(pairForm.override),
      ...sanitizeDesktopMigrationDefaults(selection.overrides),
    },
    template: pairForm.template,
  });

  const lines: DesktopMigrationLine[] = [];
  if (selection.choice === "fresh_start") {
    lines.push({
      id: "base",
      label: "Desktop migration — fresh start",
      amount: options.baseAmount,
      kind: "base",
    });
  } else {
    lines.push({
      id: "base",
      label: "Desktop migration — full history base",
      amount: options.baseAmount,
      kind: "base",
    });
    const years = Math.min(selection.historyYears ?? 0, options.historyYearCap);
    if (years > 0) {
      lines.push({
        id: "history-years",
        label: `Full history — ${years} ${years === 1 ? "year" : "years"} × $${options.historyPerYear}`,
        amount: years * options.historyPerYear,
        kind: "history",
      });
    }
    const band = normalizeBand(input.band);
    const volumeAdd = band ? options[BAND_ADDS[band]] : options.bandAdd0to99;
    if (volumeAdd > 0) {
      lines.push({
        id: "volume",
        label: band ? `Volume factor (${band})` : "Volume factor (default size)",
        amount: volumeAdd,
        kind: "volume",
      });
    }
  }

  if (selection.payrollHistory === true) {
    lines.push({
      id: "addon-payroll-history",
      label: "Payroll history",
      amount: options.payrollHistoryAdd,
      kind: "addon",
    });
  }
  if (selection.inventory === true) {
    lines.push({
      id: "addon-inventory",
      label: "Inventory",
      amount: options.inventoryAdd,
      kind: "addon",
    });
  }
  if (selection.openJobs === true) {
    lines.push({
      id: "addon-open-jobs",
      label: "Open jobs/projects",
      amount: options.openJobsAdd,
      kind: "addon",
    });
  }
  const extraFiles = normalizeExtraFiles(input.extraDesktopFiles);
  const extraTotal = extraFiles * options.extraFileAdd;
  if (extraFiles > 0 && extraTotal > 0) {
    lines.push({
      id: "extra-files",
      label:
        extraFiles === 1
          ? `1 additional Desktop file × $${options.extraFileAdd}`
          : `${extraFiles} additional Desktop files × $${options.extraFileAdd}`,
      amount: extraTotal,
      kind: "extra_file",
    });
  }

  lines.push({
    id: "trial-balance-tie-out",
    label: "Trial-balance tie-out (included)",
    amount: 0,
    kind: "included",
  });
  return { lines, total: lines.reduce((sum, line) => sum + line.amount, 0) };
}

function normalizeOptionName(name: unknown): string {
  return typeof name === "string" ? name.replace(/\s+/g, " ").trim().toLowerCase() : "";
}

/**
 * The legacy flat migration option, by explicit staff `role` OR by content:
 * a required one-time additional option whose normalized name matches
 * /desktop.*online.*migration/i. Accepts raw (unnormalized) option rows.
 */
export function isFlatDesktopMigrationOption(option: unknown): boolean {
  if (!isRecord(option)) return false;
  if (option.role === DESKTOP_MIGRATION_OPTION_ROLE) return true;
  return (
    option.required === true &&
    option.billingCadence === "one-time" &&
    FLAT_MIGRATION_NAME_PATTERN.test(normalizeOptionName(option.name))
  );
}

export interface SuppressedFlatMigration {
  suppressedIds: string[];
  note: string;
}

/**
 * Which flat migration options to suppress for a sized selection, plus the
 * client/staff-facing note naming what was suppressed. Legacy proposals
 * (no choice set) suppress nothing and price nothing — the flat $640
 * snapshot row renders and charges byte-identical.
 */
export function findSuppressedFlatMigrationOptions(
  additionalOptions: unknown,
  selection: unknown,
): SuppressedFlatMigration {
  if (!hasDesktopMigrationSelection(selection)) return { suppressedIds: [], note: "" };
  const rows = Array.isArray(additionalOptions) ? additionalOptions : [];
  const suppressedIds: string[] = [];
  const names: string[] = [];
  for (const row of rows) {
    if (!isRecord(row) || typeof row.id !== "string" || row.id.length === 0) continue;
    if (!isFlatDesktopMigrationOption(row)) continue;
    if (suppressedIds.includes(row.id)) continue;
    suppressedIds.push(row.id);
    if (typeof row.name === "string" && row.name.trim().length > 0) {
      names.push(row.name.trim());
    } else {
      names.push(row.id);
    }
  }
  if (suppressedIds.length === 0) return { suppressedIds: [], note: "" };
  const named = names.map((name) => `"${name}"`).join(", ");
  return {
    suppressedIds,
    note: `Flat migration option${suppressedIds.length === 1 ? "" : "s"} ${named} suppressed — priced by the sized Desktop migration instead.`,
  };
}

export interface PublicDesktopMigration {
  lines: Array<{ label: string; amount: number }>;
  total: number;
}

/**
 * Public-safe shape: labels and amounts only — no ids, kinds, years, or
 * internal knobs. Null when the input is not a priced result, so callers
 * omit the key instead of publishing junk.
 */
export function toPublicDesktopMigration(result: unknown): PublicDesktopMigration | null {
  if (!isRecord(result) || !Array.isArray(result.lines)) return null;
  const total = finiteOrUndefined(result.total);
  if (total === undefined) return null;
  const lines: PublicDesktopMigration["lines"] = [];
  for (const row of result.lines) {
    if (!isRecord(row)) return null;
    if (typeof row.label !== "string") return null;
    const amount = finiteOrUndefined(row.amount);
    if (amount === undefined) return null;
    lines.push({ label: row.label, amount });
  }
  return { lines, total };
}
