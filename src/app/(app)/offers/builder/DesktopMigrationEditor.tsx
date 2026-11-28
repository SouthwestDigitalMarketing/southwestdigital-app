"use client";

import {
  normalizeDesktopMigrationSelection,
  type DesktopMigrationPricingKey,
  type DesktopMigrationPricingOptions,
  type DesktopMigrationSelection,
} from "@/lib/quotes/desktopMigration";
import { DESKTOP_MIGRATION_DEFAULT_FIELDS } from "@/lib/quotes/optionsTemplates";
import type { ResolvedDesktopMigrationPrice } from "@/lib/quotes/desktopMigrationWiring";

export interface DesktopMigrationEditorProps {
  /** Raw stored selection (`assessment.desktopMigration`); junk normalizes to no choice. */
  selection: unknown;
  /** Names of the extra desktop_to_online company files (beyond the main file). */
  extraFileNames: string[];
  /** Names of the suppressed flat migration options. */
  suppressedNames: string[];
  /** Live price for the current selection; null when no choice is set. */
  priced: ResolvedDesktopMigrationPrice | null;
  /** Receives the next normalized selection; null clears it. */
  onChange: (next: DesktopMigrationSelection | null) => void;
}

const INPUT_CLASS_NAME =
  "w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-base text-slate-900 shadow-sm focus:border-brandnavy focus:outline-none focus:ring-brandnavy";

const FIELD_LABEL_CLASS = "mb-1 block text-base font-semibold text-slate-700";

function formatMoney(value: number): string {
  return `$${value.toLocaleString("en-US")}`;
}

function parseMoneyInput(raw: string): number | undefined {
  const trimmed = raw.trim();
  if (trimmed === "") return undefined;
  const parsed = Number(trimmed);
  if (!Number.isFinite(parsed) || parsed < 0) return undefined;
  return parsed;
}

/**
 * Staff "QuickBooks Desktop → Online migration" section. Choice, history
 * years, add-ons and per-proposal money overrides write the normalized
 * `assessment.desktopMigration` selection; extra files and the price
 * preview are read-only. Hidden entirely when the caller renders nothing
 * for a null selection — the caller owns the section chrome.
 */
export default function DesktopMigrationEditor({
  selection,
  extraFileNames,
  suppressedNames,
  priced,
  onChange,
}: DesktopMigrationEditorProps) {
  const normalized = normalizeDesktopMigrationSelection(selection);
  const setChoice = (choice: DesktopMigrationSelection["choice"]) => {
    if (choice === null) {
      onChange(null);
      return;
    }
    onChange({ ...normalized, choice });
  };
  const setOverrides = (overrides: Partial<DesktopMigrationPricingOptions> | undefined) => {
    if (!overrides || Object.keys(overrides).length === 0) {
      const { overrides: _dropped, ...rest } = normalized;
      void _dropped;
      onChange(rest);
      return;
    }
    onChange({ ...normalized, overrides });
  };
  const setOverrideField = (key: DesktopMigrationPricingKey, raw: string) => {
    const parsed = parseMoneyInput(raw);
    const next = { ...(normalized.overrides ?? {}) };
    if (parsed === undefined) {
      delete next[key];
    } else {
      next[key] = key === "historyYearCap" ? Math.trunc(parsed) : parsed;
    }
    setOverrides(next);
  };

  return (
    <div className="space-y-4 px-5 py-4">
      <div>
        <p className={FIELD_LABEL_CLASS}>Migration choice</p>
        <div className="flex flex-wrap gap-4">
          {(
            [
              { value: null, label: "No migration" },
              { value: "fresh_start", label: "Fresh start" },
              { value: "full_history", label: "Full history" },
            ] as const
          ).map((option) => (
            <label key={option.label} className="inline-flex items-center gap-2 text-base font-medium text-slate-700">
              <input
                type="radio"
                name="desktop-migration-choice"
                checked={normalized.choice === option.value}
                onChange={() => setChoice(option.value)}
                className="h-4 w-4 border-slate-300 text-brandnavy focus:ring-brandnavy"
              />
              {option.label}
            </label>
          ))}
        </div>
        <p className="mt-1 text-sm text-slate-500">
          Fresh start moves lists and balances; full history moves everything, priced by years and volume.
        </p>
      </div>

      {normalized.choice === "full_history" ? (
        <div>
          <label className={FIELD_LABEL_CLASS} htmlFor="desktop-migration-years">
            Years of history
          </label>
          <input
            id="desktop-migration-years"
            type="number"
            min={0}
            value={normalized.historyYears ?? ""}
            onChange={(event) => {
              const raw = event.target.value.trim();
              if (raw === "") {
                const { historyYears: _dropped, ...rest } = normalized;
                void _dropped;
                onChange(rest);
                return;
              }
              const years = Math.min(1_000_000, Math.max(0, Math.trunc(Number(raw))));
              if (!Number.isFinite(years)) return;
              onChange({ ...normalized, historyYears: years });
            }}
            className={`${INPUT_CLASS_NAME} max-w-40`}
          />
        </div>
      ) : null}

      {normalized.choice !== null ? (
        <div>
          <p className={FIELD_LABEL_CLASS}>Add-ons</p>
          <div className="flex flex-wrap gap-4">
            {(
              [
                { key: "payrollHistory", label: "Payroll history" },
                { key: "inventory", label: "Inventory" },
                { key: "openJobs", label: "Open jobs/projects" },
              ] as const
            ).map((addon) => (
              <label key={addon.key} className="inline-flex items-center gap-2 text-base font-medium text-slate-700">
                <input
                  type="checkbox"
                  checked={normalized[addon.key] === true}
                  onChange={(event) => {
                    const next = { ...normalized };
                    if (event.target.checked) {
                      next[addon.key] = true;
                    } else {
                      delete next[addon.key];
                    }
                    onChange(next);
                  }}
                  className="h-4 w-4 rounded border-slate-300 text-brandnavy focus:ring-brandnavy"
                />
                {addon.label}
              </label>
            ))}
          </div>
        </div>
      ) : null}

      {extraFileNames.length > 0 ? (
        <div>
          <p className={FIELD_LABEL_CLASS}>Additional Desktop files</p>
          <ul className="list-disc space-y-1 pl-5 text-base text-slate-700">
            {extraFileNames.map((name) => (
              <li key={name}>{name} (read-only, from Companies)</li>
            ))}
          </ul>
        </div>
      ) : null}

      {suppressedNames.map((name) => (
        <p key={name} className="rounded-xl bg-amber-50 px-3 py-2 text-sm font-medium text-amber-900">
          The flat &lsquo;{name}&rsquo; option is replaced by this sized migration.
        </p>
      ))}

      {priced ? (
        <div className="rounded-xl bg-slate-50 p-4">
          <p className={FIELD_LABEL_CLASS}>Price preview — {priced.choiceLabel}</p>
          <ul className="space-y-1 text-base text-slate-700">
            {priced.lines.map((line) => (
              <li key={line.id} className="flex justify-between gap-3">
                <span>{line.label}</span>
                <span className="tabular-nums">{line.amount === 0 ? "Included" : formatMoney(line.amount)}</span>
              </li>
            ))}
          </ul>
          <p className="mt-2 flex justify-between gap-3 border-t border-slate-200 pt-2 text-base font-bold text-slate-900">
            <span>Migration total</span>
            <span className="tabular-nums">{formatMoney(priced.total)}</span>
          </p>
        </div>
      ) : null}

      {normalized.choice !== null ? (
        <details className="rounded-xl border border-slate-200">
          <summary className="cursor-pointer list-none px-3 py-2.5 text-sm font-semibold text-slate-700 hover:text-slate-900">
            Per-proposal price overrides (blank = default)
          </summary>
          <div className="grid gap-3 border-t border-slate-200 p-3 md:grid-cols-2">
            {DESKTOP_MIGRATION_DEFAULT_FIELDS.map((field) => (
              <label key={field.key} className="block">
                <span className="mb-1 block text-sm font-medium text-slate-600">{field.label}</span>
                <input
                  type="number"
                  min={0}
                  value={normalized.overrides?.[field.key] ?? ""}
                  placeholder="Default"
                  onChange={(event) => setOverrideField(field.key, event.target.value)}
                  className={INPUT_CLASS_NAME}
                />
              </label>
            ))}
          </div>
        </details>
      ) : null}
    </div>
  );
}
