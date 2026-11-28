"use client";

import {
  COMPLEXITY_DRIVER_IDS,
  complexityDriverDefs,
  normalizeComplexitySelection,
  priceComplexityDrivers,
  type ComplexityDriverDefaults,
  type ComplexityDriverDefaultsPatch,
  type ComplexityDriverId,
  type ComplexityExistingPresence,
  type ComplexitySelection,
  type ComplexityValue,
} from "@/lib/quotes/complexityDrivers";

/**
 * Existing-line presence shape for the checklist display. Omitted fields
 * default to present (same as `priceComplexityDrivers`), so a per-company
 * row that does not track add-ons reads "Included".
 */
export type ComplexityChecklistExisting = Partial<ComplexityExistingPresence>;

export interface ComplexityChecklistProps {
  /** Raw stored selection (`assessment.complexity`); junk normalizes to unticked. */
  selection: unknown;
  /** Options-template defaults (`assessment.complexityDriverDefaults`); sparse OK. */
  defaults?: ComplexityDriverDefaults | ComplexityDriverDefaultsPatch;
  /** Which existing pricing lines are active; omitted fields read as present. */
  existing?: ComplexityChecklistExisting;
  /** Selected payment platforms, for the payout-channel counted-once hint. */
  paymentPlatforms?: string[];
  /** Receives the normalized selection; the caller persists it as-is. */
  onChange: (next: ComplexitySelection) => void;
  /** Compact per-company rendering (no section heading). */
  compact?: boolean;
}

const NEEDS_NAME: ComplexityDriverId[] = ["pos_system", "online_store"];
const NEEDS_COUNT: ComplexityDriverId[] = ["loans_mca", "filing_1099"];

const EXISTING_LINE_LABELS: Record<string, string> = {
  staffing: "the staffing line",
  salesTaxAddon: "the Sales Tax Filing & Remittance add-on",
  projectTrackingAddon: "the Project Tracking add-on",
  mixedBooks: "the books type adjustment",
};

function foldName(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]/g, "");
}

/**
 * Local counted-once check: the store's own payout channel (e.g. "Stripe"
 * typed as the store name) is also selected as a payment platform.
 *
 * TODO: replace with Builder B's `isStorePayoutChannelDuplicate` helper
 * from `src/lib/quotes/complexityDrivers.ts` (or companyBundle) when it
 * lands — it does not exist yet, so this folds both sides to alphanumerics
 * and matches either direction.
 */
export function isStoreChannelAlsoPlatform(storeName: string, paymentPlatforms: string[]): boolean {
  const folded = foldName(storeName);
  if (!folded) return false;
  return (paymentPlatforms ?? []).some((platform) => {
    const candidate = foldName(platform);
    return candidate.length > 0 && (folded.includes(candidate) || candidate.includes(folded));
  });
}

function formatMoney(value: number): string {
  return `$${value.toLocaleString("en-US")}`;
}

function parseCountInput(raw: string): number | undefined {
  const trimmed = raw.trim();
  if (trimmed === "") return undefined;
  const parsed = Number(trimmed);
  if (!Number.isFinite(parsed) || parsed < 0) return undefined;
  return Math.min(1_000_000, Math.trunc(parsed));
}

function parseOverrideInput(raw: string): number | undefined {
  const trimmed = raw.trim();
  if (trimmed === "") return undefined;
  const parsed = Number(trimmed);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : undefined;
}

export default function ComplexityChecklist({
  selection,
  defaults,
  existing,
  paymentPlatforms = [],
  onChange,
  compact = false,
}: ComplexityChecklistProps) {
  const normalized = normalizeComplexitySelection(selection);
  const defs = complexityDriverDefs(defaults);
  const pricedById = Object.fromEntries(
    priceComplexityDrivers(normalized, { defaults, existing }).lines.map((line) => [line.id, line]),
  );

  function patchDriver(id: ComplexityDriverId, patch: Partial<Extract<ComplexityValue, { checked: true }>> | null) {
    const drivers = { ...normalized.drivers };
    if (patch === null) {
      drivers[id] = { checked: false };
    } else {
      const current = normalized.drivers[id];
      const kept = current.checked === true ? current : {};
      const merged = { ...kept, ...patch, checked: true as const };
      // An emptied name field removes the key; untouched fields stay.
      if (merged.name !== undefined && merged.name.trim() === "") delete merged.name;
      drivers[id] = merged;
    }
    onChange(normalizeComplexitySelection({ drivers }));
  }

  function setChecked(id: ComplexityDriverId, checked: boolean) {
    patchDriver(id, checked ? {} : null);
  }

  const rows = (
    <ul className="space-y-3">
      {COMPLEXITY_DRIVER_IDS.map((id) => {
        const def = defs.find((entry) => entry.id === id)!;
        const value = normalized.drivers[id];
        const checked = value.checked === true;
        const priced = pricedById[id];
        const needsName = NEEDS_NAME.includes(id);
        const needsCount = NEEDS_COUNT.includes(id);
        const storeDuplicate =
          id === "online_store" &&
          checked &&
          value.checked === true &&
          isStoreChannelAlsoPlatform(value.name ?? "", paymentPlatforms);
        return (
          <li key={id} className="rounded-xl border border-slate-200 bg-white p-3">
            <label className="flex items-start gap-2 text-sm font-medium text-slate-800">
              <input
                type="checkbox"
                checked={checked}
                onChange={(event) => setChecked(id, event.target.checked)}
                aria-label={def.label}
                className="mt-0.5 h-4 w-4 rounded border-slate-300"
              />
              <span>
                {def.label}
                {checked && needsName && value.checked === true && value.name ? ` — ${value.name}` : null}
              </span>
            </label>

            {checked && needsName ? (
              <label className="mt-2 block max-w-[280px] text-xs font-medium text-slate-700">
                System name
                <input
                  type="text"
                  value={value.checked === true ? (value.name ?? "") : ""}
                  placeholder={id === "pos_system" ? "e.g. Lightspeed" : "e.g. Shopify"}
                  onChange={(event) =>
                    patchDriver(id, { name: event.target.value.trim() === "" ? undefined : event.target.value })
                  }
                  aria-label={`${def.label} name`}
                  className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900"
                />
              </label>
            ) : null}

            {checked && needsCount ? (
              <label className="mt-2 block max-w-[280px] text-xs font-medium text-slate-700">
                {id === "filing_1099" ? "Number of payees" : "Number of schedules"}
                <input
                  type="number"
                  min={0}
                  step={1}
                  value={value.checked === true && value.count !== undefined ? value.count : ""}
                  placeholder="0"
                  onChange={(event) => {
                    const parsed = parseCountInput(event.target.value);
                    const next: Extract<ComplexityValue, { checked: true }> = {
                      ...(value.checked === true ? value : {}),
                      checked: true,
                    };
                    if (parsed === undefined) delete next.count;
                    else next.count = parsed;
                    patchDriver(id, next);
                  }}
                  aria-label={`${def.label} count`}
                  className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900"
                />
              </label>
            ) : null}

            {def.builderHint ? (
              <p className="mt-1.5 text-xs text-slate-500">{def.builderHint}</p>
            ) : null}
            {storeDuplicate ? (
              <p className="mt-1.5 text-xs font-medium text-slate-600">
                Counted once here — the store driver wins when its payout channel is also listed as a payment platform.
              </p>
            ) : null}

            <div className="mt-1.5 text-xs text-slate-600">
              {def.mapsToExisting !== null ? (
                priced?.includedNote ? (
                  <span>{priced.includedNote}</span>
                ) : priced?.requiresExistingLine ? (
                  <span>
                    Will add {EXISTING_LINE_LABELS[priced.requiresExistingLine] ?? priced.requiresExistingLine}.
                  </span>
                ) : (
                  <span>
                    Will add {EXISTING_LINE_LABELS[def.mapsToExisting] ?? def.mapsToExisting}.
                  </span>
                )
              ) : (
                <span>
                  {id === "filing_1099" ? (
                    <>
                      {formatMoney(def.defaultMonthly)} per payee
                      {def.perPayeeCap !== undefined ? ` (cap ${formatMoney(def.perPayeeCap)})` : null}
                    </>
                  ) : (
                    <>{formatMoney(def.defaultMonthly)}/mo</>
                  )}
                  {checked ? (
                    <label className="ml-2 inline-flex items-center gap-1 font-medium text-slate-700">
                      Override $
                      <input
                        type="number"
                        min={0}
                        step={1}
                        value={value.checked === true && value.monthlyOverride !== undefined ? value.monthlyOverride : ""}
                        placeholder={String(def.defaultMonthly)}
                        onChange={(event) => {
                          const parsed = parseOverrideInput(event.target.value);
                          const next: Extract<ComplexityValue, { checked: true }> = {
                            ...(value.checked === true ? value : {}),
                            checked: true,
                          };
                          if (parsed === undefined) delete next.monthlyOverride;
                          else next.monthlyOverride = parsed;
                          patchDriver(id, next);
                        }}
                        aria-label={`${def.label} monthly override`}
                        className="w-24 rounded-lg border border-slate-200 bg-white px-2 py-1 text-sm text-slate-900"
                      />
                      /mo
                    </label>
                  ) : null}
                </span>
              )}
            </div>
          </li>
        );
      })}
    </ul>
  );

  if (compact) return rows;
  return (
    <div className="space-y-3">
      <p className="text-sm text-slate-600">
        Tick what applies. Defaults are editable placeholders — Tom decides the final amounts.
      </p>
      {rows}
    </div>
  );
}
