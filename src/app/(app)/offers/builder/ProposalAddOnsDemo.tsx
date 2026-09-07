"use client";

import { LibraryBig, Search } from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import ProposalAppDemoHeader from "./ProposalAppDemoHeader";
import OptionsTemplatesToolbar from "./OptionsTemplatesToolbar";
import PricingSnapshotSidebar from "./PricingSnapshotSidebar";
import {
  getOptionsCatalogOrder,
  getProposalAdditionalOptions,
  getProposalBonuses,
  getProposalPricingSnapshotCleanupCard,
  getProposalPricingSnapshotItems,
  useProposalAssessmentDemoState,
  type AssessmentState,
  type ProposalAdditionalOption,
  type ProposalBonus,
} from "./ProposalCreationWorkspaceDemo";
import {
  reconcileProposalAssessmentWithCatalog,
  proposalCatalogOptionPrice,
} from "./proposalCatalogSync";
import {
  resolveProposalPackageName,
  type PackageId,
} from "./proposalPackageNames";
import { normalizeTierPackageIds, TIER_ORDER } from "./proposalTierRanges";
import {
  includedServicePackages,
  servicePackageIds,
} from "@/lib/quotes/proposalServices";
import {
  proposalCatalogItemApplicability,
  type ProposalOptionCatalogItem,
} from "@/lib/quotes/catalog";

const EMPTY_CATALOG: ProposalOptionCatalogItem[] = [];
const CONTROL =
  "w-full rounded-md border border-slate-300 bg-white px-2 py-2 text-sm text-slate-800";
type Row = {
  id: string;
  option?: ProposalAdditionalOption;
  bonus?: ProposalBonus;
};

export default function ProposalAddOnsDemo({
  catalog = EMPTY_CATALOG,
  catalogAuthoritative = false,
}: {
  catalog?: ProposalOptionCatalogItem[];
  catalogAuthoritative?: boolean;
}) {
  const searchParams = useSearchParams();
  const { assessment, setAssessment, storageReady, updateAssessment } =
    useProposalAssessmentDemoState();
  const [query, setQuery] = useState("");
  const [browsing, setBrowsing] = useState(false);
  const [showInactive, setShowInactive] = useState(false);
  const returnPath = `/offers/add-ons${searchParams.size ? `?${searchParams.toString()}` : ""}`;
  const catalogHref = `/services?returnTo=${encodeURIComponent(returnPath)}`;

  function resolved(current: AssessmentState): AssessmentState {
    return catalogAuthoritative
      ? {
          ...current,
          ...reconcileProposalAssessmentWithCatalog(current, catalog),
        }
      : {
          ...current,
          additionalOptions: getProposalAdditionalOptions(current, catalog),
          bonuses: getProposalBonuses(current, catalog),
          optionsCatalogOrder: getOptionsCatalogOrder(current, catalog),
        };
  }
  const current = resolved(assessment);
  const catalogById = new Map(catalog.map((item) => [item.offerKey, item]));
  const rowsById = new Map<string, Row>();
  for (const bonus of current.bonuses)
    rowsById.set(bonus.id, { id: bonus.id, bonus });
  for (const option of current.additionalOptions)
    rowsById.set(option.id, { id: option.id, option });
  const ids = [
    ...new Set([...current.optionsCatalogOrder, ...rowsById.keys()]),
  ];
  const rows = ids
    .map((id) => rowsById.get(id))
    .filter((row): row is Row => Boolean(row));

  useEffect(() => {
    if (!storageReady || !catalogAuthoritative) return;
    setAssessment((saved) => {
      const next = reconcileProposalAssessmentWithCatalog(saved, catalog);
      const unchanged = Object.entries(next).every(
        ([key, value]) =>
          JSON.stringify(saved[key as keyof AssessmentState]) ===
          JSON.stringify(value),
      );
      return unchanged ? saved : { ...saved, ...next };
    });
  }, [storageReady, catalogAuthoritative, catalog, setAssessment]);

  function change(fn: (saved: AssessmentState) => AssessmentState) {
    setAssessment((saved) => ({
      ...fn(resolved(saved)),
      servicesInitialized: true,
    }));
  }
  function updateOption(id: string, fields: Partial<ProposalAdditionalOption>) {
    change((saved) => ({
      ...saved,
      additionalOptions: saved.additionalOptions.map((item) =>
        item.id === id ? { ...item, ...fields } : item,
      ),
    }));
  }
  function updateBonus(id: string, fields: Partial<ProposalBonus>) {
    change((saved) => ({
      ...saved,
      bonuses: saved.bonuses.map((item) =>
        item.id === id ? { ...item, ...fields } : item,
      ),
    }));
  }
  function setKind(id: string, kind: "included" | "optional") {
    change((saved) => {
      const option = saved.additionalOptions.find((item) => item.id === id);
      const bonus = saved.bonuses.find((item) => item.id === id);
      if (kind === "included" && option) {
        const packages = servicePackageIds(
          option.packageIds ?? saved.bonusPackageSelections[id] ?? TIER_ORDER,
        );
        return {
          ...saved,
          additionalOptions: saved.additionalOptions.filter(
            (item) => item.id !== id,
          ),
          bonuses: [
            ...saved.bonuses,
            {
              id,
              name: option.name,
              description: option.description,
              archived: option.archived,
              realEstateSpecific: option.realEstateSpecific,
              billingCadence: option.billingCadence ?? "monthly",
              defaultPackageIds: packages,
              addOnPrice: option.monthlyPrice,
              addOnPackageIds: [],
            },
          ],
          bonusPackageSelections: {
            ...saved.bonusPackageSelections,
            [id]: packages,
          },
        };
      }
      if (kind === "optional" && bonus) {
        const included = includedServicePackages(saved, bonus);
        return {
          ...saved,
          bonuses: saved.bonuses.filter((item) => item.id !== id),
          additionalOptions: [
            ...saved.additionalOptions,
            {
              id,
              name: bonus.name,
              description: bonus.description,
              archived: bonus.archived,
              realEstateSpecific: bonus.realEstateSpecific,
              billingCadence: bonus.billingCadence ?? "one-time",
              monthlyPrice:
                bonus.addOnPrice ?? catalogById.get(id)?.defaultPrice ?? 0,
              showInProposal: true,
              packageIds: servicePackageIds([
                ...included,
                ...(bonus.addOnPackageIds ?? []),
              ]),
            },
          ],
        };
      }
      return saved;
    });
  }
  function addService(item: ProposalOptionCatalogItem) {
    change((saved) => {
      if (
        saved.bonuses.some((bonus) => bonus.id === item.offerKey) ||
        saved.additionalOptions.some((option) => option.id === item.offerKey)
      )
        return saved;
      const packages = item.defaultPackageIds?.length
        ? normalizeTierPackageIds(item.defaultPackageIds)
        : [...TIER_ORDER];
      const shared = {
        id: item.offerKey,
        name: item.name,
        description: item.description,
        archived: false,
        realEstateSpecific: item.realEstateSpecific,
        billingCadence:
          item.billingCadence === "monthly"
            ? ("monthly" as const)
            : ("one-time" as const),
      };
      return {
        ...saved,
        optionsCatalogOrder: [...saved.optionsCatalogOrder, item.offerKey],
        ...(item.defaultInclusion === "optional"
          ? {
              additionalOptions: [
                ...saved.additionalOptions,
                {
                  ...shared,
                  monthlyPrice: proposalCatalogOptionPrice(item, saved),
                  showInProposal: true,
                  packageIds: packages,
                },
              ],
            }
          : {
              bonuses: [
                ...saved.bonuses,
                { ...shared, defaultPackageIds: packages },
              ],
              bonusPackageSelections: {
                ...saved.bonusPackageSelections,
                [item.offerKey]: packages,
              },
            }),
      };
    });
  }
  const matches = (name: string, description: string) =>
    `${name} ${description}`.toLowerCase().includes(query.trim().toLowerCase());
  function isActive(row: Row) {
    if (row.option)
      return (
        !row.option.archived &&
        row.option.showInProposal &&
        servicePackageIds(
          row.option.packageIds ??
            current.bonusPackageSelections[row.id] ??
            TIER_ORDER,
        ).length > 0
      );
    return (
      !row.bonus!.archived &&
      (includedServicePackages(current, row.bonus).length > 0 ||
        servicePackageIds(row.bonus!.addOnPackageIds).length > 0)
    );
  }
  const activeCount = rows.filter(isActive).length;
  const visibleRows = rows.filter((row) => {
    const item = row.option ?? row.bonus!;
    // Keep saved, currently inapplicable rows editable; changing the assessment can make them applicable again.
    return (
      (showInactive || isActive(row)) && matches(item.name, item.description)
    );
  });
  const candidates = catalog.filter(
    (item) =>
      !rowsById.has(item.offerKey) &&
      proposalCatalogItemApplicability(item, current).applicable &&
      matches(item.name, item.description),
  );

  return (
    <main className="min-h-screen">
      <section className="w-full px-5 py-6 lg:px-8">
        <ProposalAppDemoHeader currentStep="add-ons" />
        <div className="mt-4 grid gap-5 xl:grid-cols-[minmax(0,1fr)_280px]">
          <div className="proposal-options-editor min-w-0">
            {storageReady ? (
              <OptionsTemplatesToolbar
                currentSlice={current}
                hasCustomizedOptions
                onApply={(slice) => change((saved) => ({ ...saved, ...slice }))}
                middleSlot={
                  <Link
                    href={catalogHref}
                    className="inline-flex items-center gap-2 text-sm font-medium text-brandnavy"
                  >
                    <LibraryBig className="h-4 w-4" />
                    Manage service catalogue
                  </Link>
                }
              />
            ) : null}
            <div className="my-4 flex flex-wrap items-center gap-3">
              <label className="flex min-w-52 flex-1 items-center gap-2 rounded-lg border border-slate-300 bg-white px-3">
                <Search className="h-4 w-4 text-slate-500" aria-hidden="true" />
                <input
                  type="search"
                  aria-label="Search services"
                  placeholder="Search services"
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  className="w-full bg-transparent py-2 text-sm outline-none"
                />
              </label>
              <button
                type="button"
                aria-pressed={browsing}
                onClick={() => setBrowsing(!browsing)}
                className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-semibold"
              >
                {browsing ? "Back to offer" : "Add services"}
              </button>
              <span className="text-sm text-slate-500">
                {activeCount} services in offer
              </span>
            </div>
            {!browsing ? (
              <label className="mb-3 flex items-center gap-2 text-sm text-slate-600">
                <input
                  type="checkbox"
                  checked={showInactive}
                  onChange={(event) => setShowInactive(event.target.checked)}
                />
                Show hidden or unassigned services ({rows.length - activeCount})
              </label>
            ) : null}
            <p className="mb-3 text-sm text-slate-600">
              Included services have no separate charge. Add-ons can be
              purchased only in the selected tiers; a service is never charged
              where it is included.
            </p>
            {!storageReady ? (
              <p role="status">Loading saved services…</p>
            ) : browsing ? (
              <section
                aria-label="Add catalogue services"
                className="divide-y divide-slate-200 rounded-xl border border-slate-200 bg-white"
              >
                {candidates.length === 0 ? (
                  <p className="p-5 text-sm text-slate-500">
                    No additional applicable services match your search.
                  </p>
                ) : (
                  candidates.map((item) => (
                    <div
                      key={item.offerKey}
                      className="flex items-center gap-4 p-4"
                    >
                      <div className="min-w-0 flex-1">
                        <h3 className="font-semibold">{item.name}</h3>
                        <p className="text-sm text-slate-500">
                          {item.description}
                        </p>
                      </div>
                      <button
                        type="button"
                        aria-label={`Add ${item.name} to offer`}
                        onClick={() => addService(item)}
                        className="rounded-md border border-slate-300 px-3 py-2 text-sm font-semibold"
                      >
                        Add
                      </button>
                    </div>
                  ))
                )}
              </section>
            ) : (
              <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
                <table className="w-full min-w-[800px] border-collapse text-sm">
                  <thead className="bg-slate-50 text-left">
                    <tr>
                      {[
                        "Service",
                        "Treatment / billing",
                        "Included in",
                        "Available as add-on",
                        "Visibility",
                      ].map((heading) => (
                        <th
                          key={heading}
                          scope="col"
                          className="px-3 py-3 font-semibold"
                        >
                          {heading}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {visibleRows.map((row) => {
                      const item = row.option ?? row.bonus!;
                      const included = row.bonus
                        ? includedServicePackages(current, row.bonus)
                        : [];
                      const available = row.option
                        ? servicePackageIds(
                            row.option.packageIds ??
                              current.bonusPackageSelections[row.id] ??
                              TIER_ORDER,
                          )
                        : servicePackageIds(row.bonus?.addOnPackageIds).filter(
                            (id) => !included.includes(id),
                          );
                      const cadence =
                        item.billingCadence ??
                        (row.option ? "monthly" : "one-time");
                      const catalogItem = catalogById.get(row.id);
                      const applicability = catalogItem
                        ? proposalCatalogItemApplicability(catalogItem, current)
                        : null;
                      const hidden =
                        item.archived || row.option?.showInProposal === false;
                      return (
                        <tr
                          key={row.id}
                          className={`border-t border-slate-200 align-top ${hidden ? "bg-slate-50" : ""}`}
                        >
                          <td className="max-w-80 px-3 py-4">
                            <Link
                              className="font-semibold text-brandnavy"
                              href={
                                catalogItem
                                  ? `${catalogHref}&service=${encodeURIComponent(catalogItem.id)}`
                                  : catalogHref
                              }
                            >
                              {item.name}
                            </Link>
                            <p className="mt-1 text-slate-500">
                              {item.description}
                            </p>
                            {applicability?.applicable === false ? (
                              <p className="mt-2 text-amber-700">
                                Not applicable to this assessment:{" "}
                                {applicability.reason}
                              </p>
                            ) : null}
                          </td>
                          <td className="w-40 px-3 py-4">
                            <select
                              aria-label={`Treatment for ${item.name}`}
                              className={CONTROL}
                              value={row.option ? "optional" : "included"}
                              onChange={(event) =>
                                setKind(
                                  row.id,
                                  event.target.value as "included" | "optional",
                                )
                              }
                            >
                              <option value="included">Included</option>
                              <option value="optional">Add-on</option>
                            </select>
                            <select
                              aria-label={`Billing for ${item.name}`}
                              className={`${CONTROL} mt-2`}
                              value={cadence}
                              onChange={(event) => {
                                const billingCadence = event.target.value as
                                  | "monthly"
                                  | "one-time";
                                if (row.option)
                                  updateOption(row.id, { billingCadence });
                                else updateBonus(row.id, { billingCadence });
                              }}
                            >
                              <option value="monthly">Monthly</option>
                              <option value="one-time">One-time</option>
                            </select>
                          </td>
                          <td className="w-44 px-3 py-4">
                            {row.bonus ? (
                              <TierRangeControl
                                label={`Included in ${item.name}`}
                                value={included}
                                names={current.packageNames}
                                onChange={(packages) =>
                                  change((saved) => ({
                                    ...saved,
                                    bonusPackageSelections: {
                                      ...saved.bonusPackageSelections,
                                      [row.id]: packages,
                                    },
                                    bonuses: saved.bonuses.map((bonus) =>
                                      bonus.id === row.id
                                        ? {
                                            ...bonus,
                                            addOnPackageIds:
                                              bonus.addOnPackageIds?.filter(
                                                (id) => !packages.includes(id),
                                              ),
                                          }
                                        : bonus,
                                    ),
                                  }))
                                }
                              />
                            ) : (
                              <span className="text-slate-400">
                                Not included
                              </span>
                            )}
                          </td>
                          <td className="w-52 px-3 py-4">
                            <TierRangeControl
                              label={`Available as add-on for ${item.name}`}
                              value={available}
                              names={current.packageNames}
                              excluded={included}
                              onChange={(packageIds) =>
                                row.option
                                  ? updateOption(row.id, { packageIds })
                                  : updateBonus(row.id, {
                                      addOnPackageIds: packageIds,
                                      addOnPrice:
                                        row.bonus?.addOnPrice ??
                                        catalogItem?.defaultPrice ??
                                        0,
                                    })
                              }
                            />
                            <label className="mt-2 block text-xs text-slate-500">
                              Price (${" "}
                              {cadence === "monthly" ? "/ month" : "one-time"})
                              <input
                                type="number"
                                min={0}
                                step="0.01"
                                aria-label={`Add-on price for ${item.name}`}
                                className={`${CONTROL} mt-1`}
                                value={
                                  row.option?.monthlyPrice ??
                                  row.bonus?.addOnPrice ??
                                  ""
                                }
                                placeholder="0.00"
                                onChange={(event) => {
                                  const amount = Number(event.target.value);
                                  if (!Number.isFinite(amount)) return;
                                  if (row.option)
                                    updateOption(row.id, {
                                      monthlyPrice: Math.max(0, amount),
                                    });
                                  else
                                    updateBonus(row.id, {
                                      addOnPrice: Math.max(0, amount),
                                    });
                                }}
                              />
                            </label>
                          </td>
                          <td className="px-3 py-4">
                            <button
                              type="button"
                              aria-label={`${hidden ? "Show" : "Hide"} ${item.name} in offer`}
                              onClick={() =>
                                row.option
                                  ? updateOption(row.id, {
                                      archived: false,
                                      showInProposal: hidden,
                                    })
                                  : updateBonus(row.id, { archived: !hidden })
                              }
                              className="rounded-md border border-slate-300 px-2 py-2"
                            >
                              {hidden ? "Show" : "Hide"}
                            </button>
                            {hidden ? (
                              <p className="mt-2 text-xs text-slate-500">
                                Hidden from lead
                              </p>
                            ) : null}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
                {visibleRows.length === 0 ? (
                  <p className="p-5 text-sm text-slate-500">
                    {query
                      ? "No services match your search."
                      : "No services configured. Use Add services or load a template."}
                  </p>
                ) : null}
              </div>
            )}
          </div>
          <PricingSnapshotSidebar
            items={getProposalPricingSnapshotItems(current)}
            cleanupCard={getProposalPricingSnapshotCleanupCard(current)}
            hideLabel
            editablePackageNames={assessment.packageNames}
            onPackageNameChange={(id, name) =>
              updateAssessment("packageNames", {
                ...assessment.packageNames,
                [id]: name,
              })
            }
          />
        </div>
      </section>
    </main>
  );
}

export function TierRangeControl({
  label,
  value,
  names,
  excluded = [],
  onChange,
}: {
  label: string;
  value: PackageId[];
  names: AssessmentState["packageNames"];
  excluded?: PackageId[];
  onChange: (packages: PackageId[]) => void;
}) {
  const ranges = TIER_ORDER.flatMap((from, start) =>
    TIER_ORDER.slice(start).map((to) =>
      TIER_ORDER.slice(start, TIER_ORDER.indexOf(to) + 1),
    ),
  ).filter((range) => range.every((id) => !excluded.includes(id)));
  const selected = normalizeTierPackageIds(value).join(",");
  const custom =
    selected !== "" && !ranges.some((range) => range.join(",") === selected);
  const name = (id: PackageId) => resolveProposalPackageName(names, id);
  return (
    <select
      aria-label={label}
      className={CONTROL}
      value={selected}
      onChange={(event) =>
        onChange(servicePackageIds(event.target.value.split(",")))
      }
    >
      <option value="">None</option>
      {custom ? (
        <option value={selected} disabled>
          Custom: {value.map(name).join(" + ")} (saved)
        </option>
      ) : null}
      {ranges.map((range) => (
        <option key={range.join(",")} value={range.join(",")}>
          {range.length === 1
            ? name(range[0])
            : `${name(range[0])} through ${name(range[range.length - 1])}`}
        </option>
      ))}
    </select>
  );
}
