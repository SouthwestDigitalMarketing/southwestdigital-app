"use client";

import type { ReactNode } from "react";
import {
  DEFAULT_BUNDLE_PRICING_OPTIONS,
  hasCompanyBundle,
  normalizeCompanyBundle,
  priceCompanyBundle,
  type BundlePricingOptions,
  type CompanyEntry,
  type CompanyFileStatus,
  type NewFileSetupChargeSource,
} from "@/lib/quotes/companyBundle";
// Note: per-proposal option resolution lives in companyBundle
// (`resolveBundlePricingOptions`); this editor only edits the values.
import type { AccountEntry } from "@/lib/quotes/accountInventory";
import type { PackageId } from "@/lib/quotes/packagePricing";
import AccountInventoryEditor from "./AccountInventoryEditor";
import type { AssessmentState } from "./ProposalCreationWorkspaceDemo";

const PACKAGE_IDS = ["grow", "improve", "maintain"] as const satisfies readonly PackageId[];

const PACKAGE_LABELS: Record<PackageId, string> = {
  grow: "Grow",
  improve: "Improve",
  maintain: "Maintain",
};

const COMPANY_FILE_STATUSES: Array<{ value: CompanyFileStatus; label: string }> = [
  { value: "existing", label: "Existing file" },
  { value: "new_file", label: "New file needed" },
  { value: "desktop_to_online", label: "Desktop → Online (flagged)" },
];

const FILE_STATUS_LABELS: Record<CompanyFileStatus, string> = {
  existing: "Existing file",
  new_file: "New file needed",
  desktop_to_online: "Desktop → Online (flagged for a later step)",
};

const inputClass =
  "w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus-visible:border-brandnavy focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brandnavy/20";

const NEW_FILE_SETUP_SOURCE_LABELS: Record<NewFileSetupChargeSource, string> = {
  override: "proposal override",
  template: "template default",
  catalog: "from catalog",
  placeholder: "placeholder",
};

function formatMoney(value: number) {
  return `$${value.toLocaleString("en-US")}`;
}

let companyIdCounter = 0;

function newCompanyId(): string {
  companyIdCounter += 1;
  return `company-${Date.now().toString(36)}-${companyIdCounter}`;
}

/**
 * Keep the canonical mirror: `companies[0].accounts` follows the main
 * account inventory. Added companies keep their own inventories untouched.
 */
export function withSyncedMainAccounts(
  companies: CompanyEntry[],
  accounts: AccountEntry[],
): CompanyEntry[] {
  const normalized = normalizeCompanyBundle(companies);
  if (normalized.length === 0) return normalized;
  return normalizeCompanyBundle(
    normalized.map((company, index) => (index === 0 ? { ...company, accounts } : company)),
  );
}

function perPackageLine(values: Record<PackageId, number>) {
  return PACKAGE_IDS.map((id) => `${PACKAGE_LABELS[id]} ${formatMoney(values[id])}`).join(" · ");
}

export interface CompanyBundleEditorProps {
  /** Raw stored companies; normalized inside so saved state is always tolerated. */
  companies: CompanyEntry[];
  /** Proposal company name: the default for a newly created main company. */
  companyName: string;
  /** The Spec 01 main inventory (`assessment.accounts`), mirrored to companies[0]. */
  mainAccounts: AccountEntry[];
  /** Effective main assessment used for the read-only price summary. */
  baseAssessment: AssessmentState;
  /** Effective (resolved) per-proposal bundle options. */
  bundleOptions: BundlePricingOptions;
  /** Where the effective new-file setup charge came from; shown beside the override input. */
  newFileSetupSource: NewFileSetupChargeSource;
  /** Legacy entities input, rendered only while no bundle is active. */
  legacyEntitiesField: ReactNode;
  onCompaniesChange: (companies: CompanyEntry[] | undefined) => void;
  onBundleOptionsChange: (options: BundlePricingOptions) => void;
}

export default function CompanyBundleEditor({
  companies: rawCompanies,
  companyName,
  mainAccounts,
  baseAssessment,
  bundleOptions,
  legacyEntitiesField,
  newFileSetupSource,
  onCompaniesChange,
  onBundleOptionsChange,
}: CompanyBundleEditorProps) {
  const companies = normalizeCompanyBundle(rawCompanies);
  const bundled = hasCompanyBundle({ companies });
  const pricedByPackage = PACKAGE_IDS.map((packageId) => ({
    packageId,
    bundle: priceCompanyBundle({
      companies,
      packageId,
      baseAssessment,
      options: bundleOptions,
    }),
  }));
  const pricedById = Object.fromEntries(pricedByPackage.map((entry) => [entry.packageId, entry.bundle])) as Record<
    PackageId,
    (typeof pricedByPackage)[number]["bundle"]
  >;
  const bundleMonthly = Object.fromEntries(
    pricedByPackage.map((entry) => [entry.packageId, entry.bundle.bundleMonthly]),
  ) as Record<PackageId, number>;
  const setupTotal = pricedById.maintain.setupTotal;
  const locationsMonthly = pricedById.maintain.locationsMonthly;
  const locationsCount = companies[0]?.locationsCount ?? 0;

  function startBundle() {
    onCompaniesChange([
      {
        id: newCompanyId(),
        name: companyName,
        ownQboFile: true,
        fileStatus: "existing",
        locationsCount: 0,
        propertiesCount: 0,
        accounts: mainAccounts,
        complexity: null,
      },
    ]);
  }

  function addCompany() {
    onCompaniesChange([
      ...companies,
      {
        id: newCompanyId(),
        name: "",
        ownQboFile: true,
        fileStatus: "existing",
        locationsCount: 0,
        propertiesCount: 0,
        accounts: [],
        complexity: null,
      },
    ]);
  }

  function updateCompany(id: string, patch: Partial<CompanyEntry>) {
    onCompaniesChange(companies.map((company) => (company.id === id ? { ...company, ...patch } : company)));
  }

  function removeCompany(id: string) {
    // Dropping the last added company leaves a plain main file, which prices
    // exactly like the legacy path — keep it so the typed main name survives.
    onCompaniesChange(companies.filter((company) => company.id !== id));
  }

  function updateOption(key: keyof BundlePricingOptions, raw: string) {
    if (raw === "") return;
    const parsed = Number(raw);
    if (!Number.isFinite(parsed)) return;
    onBundleOptionsChange({ ...bundleOptions, [key]: parsed });
  }

  const main = companies[0];
  const added = companies.slice(1);

  return (
    <div className="space-y-4">
      {bundled ? (
        <p className="text-sm font-medium text-slate-600" role="note">
          Priced per company below
        </p>
      ) : (
        legacyEntitiesField
      )}

      {companies.length === 0 ? (
        <button
          type="button"
          onClick={startBundle}
          className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700"
        >
          Add company
        </button>
      ) : (
        <>
          <fieldset className="rounded-xl border border-slate-200 bg-slate-50 p-3">
            <legend className="px-1 text-sm font-semibold text-slate-800">
              Main company{main.name ? ` — ${main.name}` : ""}
            </legend>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              <label className="text-xs font-medium text-slate-700">
                Company name
                <input
                  className={inputClass}
                  value={main.name}
                  placeholder={companyName || "Company 1"}
                  onChange={(event) => updateCompany(main.id, { name: event.target.value })}
                />
              </label>
              <label className="text-xs font-medium text-slate-700">
                QuickBooks file
                <select
                  className={inputClass}
                  value={main.fileStatus}
                  onChange={(event) => updateCompany(main.id, { fileStatus: event.target.value as CompanyFileStatus })}
                >
                  {COMPANY_FILE_STATUSES.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="text-xs font-medium text-slate-700">
                Locations in the main file
                <input
                  className={inputClass}
                  type="number"
                  min={0}
                  step={1}
                  value={main.locationsCount}
                  onChange={(event) => {
                    const parsed = Number(event.target.value);
                    updateCompany(main.id, {
                      locationsCount: Number.isFinite(parsed) ? Math.max(0, Math.trunc(parsed)) : 0,
                    });
                  }}
                />
              </label>
            </div>
            {main.fileStatus === "desktop_to_online" ? (
              <p className="mt-2 text-xs text-slate-500">
                Flagged only — priced as an existing file until a later step prices the migration.
              </p>
            ) : null}
            {main.fileStatus === "new_file" ? (
              <p className="mt-2 text-xs text-slate-500">
                One-time setup of {formatMoney(bundleOptions.newFileSetupCharge)} applies to this file.
              </p>
            ) : null}
          </fieldset>

          {added.map((company, addedIndex) => (
            <fieldset
              key={company.id}
              className="rounded-xl border border-slate-200 bg-slate-50 p-3"
            >
              <legend className="px-1 text-sm font-semibold text-slate-800">
                {company.name || `Company ${addedIndex + 2}`}
              </legend>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                <label className="text-xs font-medium text-slate-700">
                  Company name
                  <input
                    className={inputClass}
                    value={company.name}
                    placeholder={`Company ${addedIndex + 2}`}
                    onChange={(event) => updateCompany(company.id, { name: event.target.value })}
                  />
                </label>
                <label className="flex items-end gap-2 pb-2 text-sm font-medium text-slate-700">
                  <input
                    type="checkbox"
                    checked={company.ownQboFile}
                    onChange={(event) => updateCompany(company.id, { ownQboFile: event.target.checked })}
                    className="h-4 w-4 rounded border-slate-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brandnavy/20"
                  />
                  Has its own QuickBooks file
                </label>
                <label className="text-xs font-medium text-slate-700">
                  File status
                  <select
                    className={inputClass}
                    value={company.fileStatus}
                    onChange={(event) =>
                      updateCompany(company.id, { fileStatus: event.target.value as CompanyFileStatus })
                    }
                  >
                    {COMPANY_FILE_STATUSES.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </label>
                {company.ownQboFile ? (
                  <label className="text-xs font-medium text-slate-700">
                    Properties in this file
                    <input
                      className={inputClass}
                      type="number"
                      min={0}
                      step={1}
                      value={company.propertiesCount}
                      onChange={(event) => {
                        const parsed = Number(event.target.value);
                        updateCompany(company.id, {
                          propertiesCount: Number.isFinite(parsed) ? Math.max(0, Math.trunc(parsed)) : 0,
                        });
                      }}
                    />
                  </label>
                ) : null}
              </div>
              {company.fileStatus === "desktop_to_online" ? (
                <p className="mt-2 text-xs text-slate-500">
                  Flagged only — priced as an existing file until a later step prices the migration.
                </p>
              ) : null}
              {company.ownQboFile ? (
                <div className="mt-3">
                  <AccountInventoryEditor
                    accounts={company.accounts}
                    bandOverride={null}
                    onAccountsChange={(accounts) => updateCompany(company.id, { accounts })}
                    onOverrideChange={() => undefined}
                    allowBandOverride={false}
                  />
                </div>
              ) : (
                <p className="mt-2 text-xs text-slate-500">
                  Shares the main file — priced as part of the main company, not on its own.
                </p>
              )}
              <button
                type="button"
                aria-label={`Remove ${company.name || `Company ${addedIndex + 2}`}`}
                onClick={() => removeCompany(company.id)}
                className="mt-2 text-sm font-medium text-slate-600 underline"
              >
                Remove
              </button>
            </fieldset>
          ))}

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={addCompany}
              className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700"
            >
              Add company
            </button>
            <button
              type="button"
              onClick={() => onCompaniesChange(undefined)}
              className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-600"
            >
              Remove bundle
            </button>
          </div>

          <details className="rounded-xl border border-slate-200 bg-white p-3">
            <summary className="cursor-pointer text-sm font-medium text-slate-700">
              Bundle pricing (per-proposal override)
            </summary>
            <div className="mt-3 grid gap-3 sm:grid-cols-3">
              <label className="text-xs font-medium text-slate-700">
                Additional-company discount % (default {DEFAULT_BUNDLE_PRICING_OPTIONS.additionalCompanyDiscountPct})
                <input
                  className={inputClass}
                  type="number"
                  min={0}
                  max={100}
                  step={1}
                  value={bundleOptions.additionalCompanyDiscountPct}
                  onChange={(event) => updateOption("additionalCompanyDiscountPct", event.target.value)}
                />
              </label>
              <label className="text-xs font-medium text-slate-700">
                Location charge $/mo (default {formatMoney(DEFAULT_BUNDLE_PRICING_OPTIONS.locationMonthlyCharge)})
                <input
                  className={inputClass}
                  type="number"
                  min={0}
                  step={1}
                  value={bundleOptions.locationMonthlyCharge}
                  onChange={(event) => updateOption("locationMonthlyCharge", event.target.value)}
                />
              </label>
              <label className="text-xs font-medium text-slate-700">
                New-file setup $/file (effective {formatMoney(bundleOptions.newFileSetupCharge)} — {NEW_FILE_SETUP_SOURCE_LABELS[newFileSetupSource]})
                <input
                  className={inputClass}
                  type="number"
                  min={0}
                  step={1}
                  value={bundleOptions.newFileSetupCharge}
                  onChange={(event) => updateOption("newFileSetupCharge", event.target.value)}
                />
              </label>
            </div>
            <p className="mt-2 text-xs text-slate-500">
              Discount and location defaults are proposed (20% · $25/location). New-file setup
              follows the brand catalog price when set, otherwise the $150 placeholder; typing a
              value above makes it a proposal override.
            </p>
          </details>

          {bundled ? (
            <div
              className="rounded-xl border border-slate-200 bg-white p-3"
              aria-label="Bundle price summary"
            >
              <h4 className="text-sm font-semibold text-slate-800">Bundle price (read-only)</h4>
              <ul className="mt-2 space-y-2">
                {pricedById.maintain.perCompany.map((entry, index) => {
                  const standalone = Object.fromEntries(
                    PACKAGE_IDS.map((id) => [id, pricedById[id].perCompany[index].standaloneMonthly]),
                  ) as Record<PackageId, number>;
                  const discounted = Object.fromEntries(
                    PACKAGE_IDS.map((id) => [id, pricedById[id].perCompany[index].discountedMonthly]),
                  ) as Record<PackageId, number>;
                  const label = entry.company.name || `Company ${index + 1}`;
                  if (!entry.company.ownQboFile && !entry.isMain) {
                    return (
                      <li key={entry.company.id} className="text-sm text-slate-700">
                        {label} — {FILE_STATUS_LABELS[entry.company.fileStatus]} · shares the main file:
                        included with the main file, no separate monthly price.
                      </li>
                    );
                  }
                  return (
                    <li key={entry.company.id} className="text-sm text-slate-700">
                      {label} — {FILE_STATUS_LABELS[entry.company.fileStatus]}
                      {entry.company.ownQboFile && entry.company.propertiesCount > 0 ? (
                        <> · {entry.company.propertiesCount} {entry.company.propertiesCount === 1 ? "property" : "properties"}</>
                      ) : null}{" "}
                      · standalone{" "}
                      {perPackageLine(standalone)} per month
                      {entry.isMain ? (
                        <> · main company, full price → {perPackageLine(discounted)} per month</>
                      ) : (
                        <>
                          {" "}· bundle discount {entry.discountPct}% → {perPackageLine(discounted)} per
                          month
                        </>
                      )}
                      {entry.setupOneTime > 0 ? (
                        <> · setup {formatMoney(entry.setupOneTime)} one-time</>
                      ) : null}
                    </li>
                  );
                })}
              </ul>
              {locationsCount > 0 ? (
                <p className="mt-2 text-sm text-slate-700">
                  Locations in the main file ({locationsCount}): +{formatMoney(locationsMonthly)}/mo
                </p>
              ) : null}
              {setupTotal > 0 ? (
                <p className="mt-1 text-sm text-slate-700">
                  Setup total: {formatMoney(setupTotal)} one-time
                </p>
              ) : null}
              <p className="mt-2 text-sm font-semibold text-slate-900">
                Bundle monthly: {perPackageLine(bundleMonthly)}
              </p>
            </div>
          ) : null}
        </>
      )}
    </div>
  );
}
