/**
 * Spec 05 surfaces wiring (pure, no React, no prisma).
 *
 * One composition point for the sized Desktop → Online migration: the band
 * signal (Spec 01 derived band or manual), the extra-file count (Spec 02
 * companies with fileStatus desktop_to_online beyond the main file), and
 * the money chain (per-proposal overrides win, then the options-template
 * defaults, then the code defaults). The snapshot builder and the staff
 * preview read through here; checkout, the public payload and the
 * agreement route read the stored snapshot pricing instead (one source).
 */

import { resolveTransactionBand, type BandOverride } from "./accountInventory";
import {
  normalizeCompanyBundle,
  type CompanyBundleFeeLine,
} from "./companyBundle";
import {
  normalizeDesktopMigrationSelection,
  priceDesktopMigration,
  type DesktopMigrationChoice,
  type DesktopMigrationPriceResult,
} from "./desktopMigration";

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

/** Client/staff choice labels. Unknown input is never labelled. */
export function desktopMigrationChoiceLabel(choice: unknown): string | null {
  if (choice === "fresh_start") return "Fresh start";
  if (choice === "full_history") return "Full history";
  return null;
}

/**
 * Extra Desktop files beyond the main file: every desktop_to_online
 * company except companies[0] (the main file). When the main file itself
 * is not a Desktop file, every flagged company counts.
 */
export function countExtraDesktopFiles(companies: unknown): number {
  const list = normalizeCompanyBundle(companies);
  if (list.length === 0) return 0;
  const flagged = list.filter((company) => company.fileStatus === "desktop_to_online");
  if (flagged.length === 0) return 0;
  return list[0].fileStatus === "desktop_to_online" ? flagged.length - 1 : flagged.length;
}

export interface ResolvedDesktopMigrationPrice extends DesktopMigrationPriceResult {
  choice: DesktopMigrationChoice;
  choiceLabel: string;
  /** Spec 01 derived band, manual band, or fallback — the band priced with. */
  band: string;
  extraDesktopFiles: number;
}

/**
 * Live price for a staff assessment. Null when no migration choice is set
 * (legacy assessments), so every surface hides the block and charges
 * nothing new.
 */
export function resolveDesktopMigrationPrice(assessment: unknown): ResolvedDesktopMigrationPrice | null {
  const record = isRecord(assessment) ? assessment : {};
  const selection = normalizeDesktopMigrationSelection(record.desktopMigration);
  if (selection.choice === null) return null;
  const choiceLabel = desktopMigrationChoiceLabel(selection.choice) ?? "Desktop migration";
  const bandOverride = isRecord(record.bandOverride)
    ? (record.bandOverride as Partial<BandOverride>)
    : undefined;
  const band = resolveTransactionBand({
    accounts: record.accounts,
    transactionBand: typeof record.transactionBand === "string" ? record.transactionBand : undefined,
    ...(bandOverride ? { bandOverride } : {}),
  }).band;
  const extraDesktopFiles = countExtraDesktopFiles(record.companies);
  const priced = priceDesktopMigration({
    selection,
    band,
    extraDesktopFiles,
    options: { override: selection.overrides, template: record.desktopMigrationDefaults },
  });
  return {
    choice: selection.choice,
    choiceLabel,
    band,
    extraDesktopFiles,
    ...priced,
  };
}

/** "QuickBooks Desktop to Online Migration — <choice>" (agreement + preview). */
export function desktopMigrationFeeLabel(choiceLabel: string): string {
  return `QuickBooks Desktop to Online Migration — ${choiceLabel}`;
}

/**
 * Swap the per-company $0 migration markers for the single priced migration
 * fee line. Legacy (no migration) returns the lines untouched, so stored
 * snapshots render byte-identical.
 */
export function withSizedMigrationFeeLines(
  lines: CompanyBundleFeeLine[] | undefined,
  migration: { label: string; amount: number } | null,
): CompanyBundleFeeLine[] | undefined {
  if (!migration) return lines;
  const kept = (lines ?? []).filter((line) => line.kind !== "migration");
  return [
    ...kept,
    {
      companyName: "",
      kind: "migration",
      label: migration.label,
      amount: migration.amount,
      cadence: "one-time",
    } as CompanyBundleFeeLine,
  ];
}
