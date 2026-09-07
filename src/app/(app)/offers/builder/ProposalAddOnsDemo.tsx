"use client";

import { Check, ChevronDown, Plus, Search } from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Fragment, useEffect, useState } from "react";
import ProposalAppDemoHeader from "./ProposalAppDemoHeader";
import OptionsTemplatesToolbar from "./OptionsTemplatesToolbar";
import ServiceOfferEditor from "./ServiceOfferEditor";
export { TierRangeControl } from "./ServiceOfferEditor";
import {
  applyServiceConfiguration,
  readServiceConfiguration,
  type ServiceRow,
} from "./proposalServiceConfiguration";
import {
  getOptionsCatalogOrder,
  getProposalAdditionalOptions,
  getProposalBonuses,
  getProposalPricingSnapshotCleanupCard,
  getProposalPricingSnapshotItems,
  useProposalAssessmentDemoState,
  type AssessmentState,
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
  proposalServiceAddOns,
  serviceIsApplicable,
} from "@/lib/quotes/proposalServices";
import {
  proposalCatalogItemApplicability,
  type ProposalOptionCatalogItem,
} from "@/lib/quotes/catalog";

const EMPTY_CATALOG: ProposalOptionCatalogItem[] = [];
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
  const [editingId, setEditingId] = useState<string | null>(null);
  const [renamePackages, setRenamePackages] = useState(false);
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
  const rowsById = new Map<string, ServiceRow>();
  for (const bonus of current.bonuses)
    rowsById.set(bonus.id, { id: bonus.id, bonus });
  for (const option of current.additionalOptions)
    rowsById.set(option.id, { id: option.id, option });
  const ids = [
    ...new Set([...current.optionsCatalogOrder, ...rowsById.keys()]),
  ];
  const rows = ids
    .map((id) => rowsById.get(id))
    .filter((row): row is ServiceRow => Boolean(row));

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
  const paidChoices = new Map(
    proposalServiceAddOns(current).map((item) => [item.id, item]),
  );
  function applicable(row: ServiceRow) {
    const catalogItem = catalogById.get(row.id);
    return catalogItem
      ? proposalCatalogItemApplicability(catalogItem, current).applicable
      : serviceIsApplicable(current, row.option ?? row.bonus);
  }
  function cellState(row: ServiceRow, tier: PackageId) {
    const config = readServiceConfiguration(current, row);
    if (!config.visible || !applicable(row)) return "unavailable";
    if (config.included.includes(tier)) return "included";
    return paidChoices.get(row.id)?.packageIds.includes(tier)
      ? "optional"
      : "unavailable";
  }
  const matches = (name: string, description: string) =>
    `${name} ${description}`.toLowerCase().includes(query.trim().toLowerCase());
  function isActive(row: ServiceRow) {
    return TIER_ORDER.some((id) => cellState(row, id) !== "unavailable");
  }
  const activeCount = rows.filter(isActive).length;
  const visibleRows = rows.filter((row) => {
    const item = row.option ?? row.bonus!;
    // Keep saved, currently inapplicable rows editable; changing the assessment can make them applicable again.
    return (
      (showInactive || isActive(row) || row.id === editingId) &&
      matches(item.name, item.description)
    );
  });
  const candidates = catalog.filter(
    (item) =>
      !rowsById.has(item.offerKey) &&
      proposalCatalogItemApplicability(item, current).applicable &&
      matches(item.name, item.description),
  );

  const groups = [
    {
      cadence: "monthly",
      title: "Recurring services",
      detail: "Ongoing work included in the package or selected as an add-on.",
    },
    {
      cadence: "one-time",
      title: "One-time work",
      detail: "Setup and other services delivered once.",
    },
  ] as const;
  const prices = getProposalPricingSnapshotItems(current);
  const cleanup = getProposalPricingSnapshotCleanupCard(current);
  const packageName = (id: PackageId) =>
    resolveProposalPackageName(current.packageNames, id);
  const formatPrice = (price: number) =>
    price.toLocaleString("en-US", {
      style: "currency",
      currency: "USD",
      maximumFractionDigits: 2,
    });
  function openEditor(id: string) {
    setEditingId((previous) => (previous === id ? null : id));
  }

  return (
    <main className="min-h-screen">
      <section className="w-full px-5 py-6 lg:px-8">
        <ProposalAppDemoHeader currentStep="add-ons" />
        <div className="mt-6 flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-slate-900">
              Build your service lineup
            </h1>
            <p className="mt-1 text-sm text-slate-600">
              Compare what each package includes. Select a service to adjust
              this offer.
            </p>
          </div>
          <button
            type="button"
            aria-pressed={browsing}
            onClick={() => {
              setBrowsing(!browsing);
              setEditingId(null);
            }}
            className="ui-action-primary inline-flex items-center gap-2 rounded-lg px-4 py-2.5 text-sm font-semibold"
          >
            <Plus className="h-4 w-4" aria-hidden="true" />
            {browsing ? "Back to offer" : "Add services"}
          </button>
        </div>
        <div className="mt-5 grid items-start gap-6 2xl:grid-cols-[minmax(0,1fr)_260px]">
          <div className="min-w-0">
            <div className="mb-4 flex flex-wrap items-center gap-3">
              <label className="flex min-w-52 flex-1 items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 focus-within:ring-2 focus-within:ring-brandnavy">
                <Search className="h-4 w-4 text-slate-500" aria-hidden="true" />
                <input
                  type="search"
                  aria-label="Search services"
                  placeholder={
                    browsing
                      ? "Search the service catalogue"
                      : "Search this offer"
                  }
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  className="w-full bg-transparent py-2.5 text-sm outline-none"
                />
              </label>
              {!browsing ? (
                <label className="flex items-center gap-2 text-xs text-slate-600">
                  <input
                    type="checkbox"
                    checked={showInactive}
                    onChange={(event) => setShowInactive(event.target.checked)}
                  />
                  Show hidden or unassigned services (
                  {rows.length - activeCount})
                </label>
              ) : null}
            </div>
            {!storageReady ? (
              <p role="status">Loading saved services…</p>
            ) : browsing ? (
              <section
                aria-label="Add catalogue services"
                className="divide-y divide-slate-200 overflow-hidden rounded-xl border border-slate-200 bg-white"
              >
                <div className="bg-slate-50 p-4">
                  <h2 className="font-semibold text-slate-900">
                    Choose a service
                  </h2>
                  <p className="mt-1 text-sm text-slate-500">
                    Add a service, then adjust its packages and pricing for this
                    offer.
                  </p>
                </div>
                {candidates.length === 0 ? (
                  <p className="p-5 text-sm text-slate-500">
                    No additional applicable services match your search. Hidden
                    services can be restored from the offer view.
                  </p>
                ) : (
                  candidates.map((item) => (
                    <div
                      key={item.offerKey}
                      className="flex items-center gap-4 p-4"
                    >
                      <div className="min-w-0 flex-1">
                        <h3 className="font-semibold text-slate-900">
                          {item.name}
                        </h3>
                        <p className="mt-1 text-sm text-slate-500">
                          {item.description}
                        </p>
                        <p className="mt-2 text-xs font-medium text-slate-500">
                          {item.billingCadence === "monthly"
                            ? "Recurring monthly"
                            : "One-time work"}
                          {item.defaultInclusion === "optional"
                            ? ` · Catalogue price ${formatPrice(item.defaultPrice)}`
                            : ""}
                        </p>
                      </div>
                      <button
                        type="button"
                        aria-label={`Add ${item.name} to offer`}
                        onClick={() => {
                          addService(item);
                          setBrowsing(false);
                          setQuery("");
                          setEditingId(item.offerKey);
                        }}
                        className="ui-action-secondary rounded-lg border px-3 py-2 text-sm font-semibold"
                      >
                        Add
                      </button>
                    </div>
                  ))
                )}
              </section>
            ) : (
              <div className="space-y-5">
                <p className="text-xs text-slate-500">
                  {activeCount} services in offer · Included = no extra charge ·
                  Optional = client chooses and pays separately
                </p>
                {groups.map((group) => {
                  const groupRows = visibleRows.filter(
                    (row) =>
                      readServiceConfiguration(current, row).cadence ===
                      group.cadence,
                  );
                  if (groupRows.length === 0) return null;
                  return (
                    <section
                      key={group.cadence}
                      aria-label={group.title}
                      className="overflow-hidden rounded-xl border border-slate-200 bg-white"
                    >
                      <div className="border-b border-slate-200 bg-slate-50 px-4 py-3">
                        <h2 className="font-semibold text-slate-900">
                          {group.title}{" "}
                          <span className="ml-1 text-sm font-normal text-slate-400">
                            {groupRows.length}
                          </span>
                        </h2>
                        <p className="mt-1 text-xs text-slate-500">
                          {group.detail}
                        </p>
                      </div>
                      <div className="overflow-x-auto">
                        <table className="block w-full table-fixed border-collapse text-sm sm:table sm:min-w-[620px]">
                          <caption className="sr-only">
                            {group.title} by package. Select a service to edit
                            its availability.
                          </caption>
                          <colgroup className="hidden sm:table-column-group">
                            <col className="w-[40%]" />
                            {TIER_ORDER.map((id) => (
                              <col key={id} className="w-[20%]" />
                            ))}
                          </colgroup>
                          <thead className="hidden sm:table-header-group">
                            <tr>
                              <th
                                scope="col"
                                className="px-4 py-3 text-left text-xs font-medium text-slate-500"
                              >
                                Service
                              </th>
                              {TIER_ORDER.map((id) => (
                                <th
                                  scope="col"
                                  key={id}
                                  className="break-words px-2 py-3 text-center font-semibold text-slate-800"
                                >
                                  {packageName(id)}
                                </th>
                              ))}
                            </tr>
                          </thead>
                          <tbody className="block sm:table-row-group">
                            {groupRows.map((row) => {
                              const item = row.option ?? row.bonus!;
                              const config = readServiceConfiguration(
                                current,
                                row,
                              );
                              const catalogItem = catalogById.get(row.id);
                              const expanded = editingId === row.id;
                              return (
                                <Fragment key={row.id}>
                                  <tr
                                    className={`block border-t border-slate-100 pb-2 sm:table-row sm:pb-0 ${expanded ? "bg-slate-50" : "hover:bg-slate-50/60"}`}
                                  >
                                    <th
                                      scope="row"
                                      className="block px-4 py-3 text-left font-normal sm:table-cell"
                                    >
                                      <button
                                        type="button"
                                        aria-expanded={expanded}
                                        aria-controls={
                                          expanded
                                            ? `service-editor-${row.id}`
                                            : undefined
                                        }
                                        onClick={() => openEditor(row.id)}
                                        className="flex w-full items-start gap-2 rounded text-left font-medium text-slate-900 focus-visible:outline-2 focus-visible:outline-brandnavy"
                                      >
                                        <ChevronDown
                                          aria-hidden="true"
                                          className={`mt-0.5 h-4 w-4 shrink-0 text-slate-400 transition-transform ${expanded ? "rotate-180" : ""}`}
                                        />
                                        <span>{item.name}</span>
                                      </button>
                                      {!config.visible ? (
                                        <p className="ml-6 mt-1 text-xs text-slate-500">
                                          Hidden from lead
                                        </p>
                                      ) : !applicable(row) ? (
                                        <p className="ml-6 mt-1 text-xs text-amber-700">
                                          {catalogItem
                                            ? proposalCatalogItemApplicability(
                                                catalogItem,
                                                current,
                                              ).reason
                                            : "Not applicable to this assessment"}
                                        </p>
                                      ) : null}
                                    </th>
                                    {TIER_ORDER.map((id) => {
                                      const state = cellState(row, id);
                                      const text =
                                        state === "included"
                                          ? "Included"
                                          : state === "optional"
                                            ? `Optional · ${formatPrice(config.price)}${config.cadence === "monthly" ? "/mo" : " once"}`
                                            : "Not offered";
                                      return (
                                        <td
                                          key={id}
                                          className="inline-block w-1/3 px-1 py-2 text-center align-top sm:table-cell sm:w-auto sm:py-3"
                                        >
                                          <span className="mb-1 block break-words text-xs font-medium text-slate-600 sm:hidden">
                                            {packageName(id)}
                                          </span>
                                          <button
                                            type="button"
                                            onClick={() => openEditor(row.id)}
                                            aria-label={`${item.name}, ${packageName(id)}: ${text}. Edit service`}
                                            aria-expanded={expanded}
                                            className={`inline-flex min-h-10 items-center justify-center gap-1 rounded-lg px-2 py-1 text-xs leading-5 focus-visible:outline-2 focus-visible:outline-brandnavy ${state === "included" ? "font-medium text-emerald-700" : state === "optional" ? "bg-blue-50 font-medium text-blue-800" : "text-slate-400"}`}
                                          >
                                            {state === "included" ? (
                                              <Check
                                                className="h-3.5 w-3.5 shrink-0"
                                                aria-hidden="true"
                                              />
                                            ) : null}
                                            {text}
                                          </button>
                                        </td>
                                      );
                                    })}
                                  </tr>
                                  {expanded ? (
                                    <tr className="block sm:table-row">
                                      <td
                                        colSpan={4}
                                        className="block border-t border-slate-200 p-3 sm:table-cell"
                                      >
                                        <div id={`service-editor-${row.id}`}>
                                          <ServiceOfferEditor
                                            key={row.id}
                                            name={item.name}
                                            description={item.description}
                                            initial={config}
                                            names={current.packageNames}
                                            catalogHref={
                                              catalogItem
                                                ? `${catalogHref}&service=${encodeURIComponent(catalogItem.id)}`
                                                : undefined
                                            }
                                            onApply={(next) => {
                                              change((saved) =>
                                                applyServiceConfiguration(
                                                  saved,
                                                  row.id,
                                                  next,
                                                ),
                                              );
                                              setEditingId(null);
                                            }}
                                            onCancel={() => setEditingId(null)}
                                          />
                                        </div>
                                      </td>
                                    </tr>
                                  ) : null}
                                </Fragment>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    </section>
                  );
                })}
                {visibleRows.length === 0 ? (
                  <div className="rounded-xl border border-dashed border-slate-300 p-8 text-center text-sm text-slate-500">
                    {query
                      ? "No services match your search."
                      : "No services assigned. Add services, load a template, or show hidden services to restore them."}
                  </div>
                ) : null}
              </div>
            )}
            {storageReady ? (
              <details className="mt-5 rounded-lg border border-slate-200 bg-white px-4 py-3">
                <summary className="cursor-pointer text-sm font-medium text-slate-600">
                  Templates and catalogue tools
                </summary>
                <div className="mt-3">
                  <OptionsTemplatesToolbar
                    currentSlice={current}
                    hasCustomizedOptions
                    onApply={(slice) => {
                      change((saved) => ({ ...saved, ...slice }));
                      setEditingId(null);
                    }}
                    middleSlot={
                      <Link
                        href={catalogHref}
                        className="text-xs text-slate-500 underline underline-offset-4"
                      >
                        Manage shared service catalogue
                      </Link>
                    }
                  />
                </div>
              </details>
            ) : null}
          </div>
          {storageReady ? (
            <aside
              aria-label="Package coverage"
              className="rounded-xl border border-slate-200 bg-white p-4 2xl:sticky 2xl:top-8"
            >
              <div className="flex items-center justify-between gap-3">
                <h2 className="font-semibold text-slate-900">
                  Package coverage
                </h2>
                <button
                  type="button"
                  onClick={() => setRenamePackages(!renamePackages)}
                  aria-pressed={renamePackages}
                  className="text-xs text-slate-500 underline underline-offset-4"
                >
                  {renamePackages ? "Done" : "Rename"}
                </button>
              </div>
              <p className="mt-2 text-xs leading-5 text-slate-500">
                Base monthly prices below exclude optional add-ons. Including a
                service does not change the base price.
              </p>
              <div className="mt-4 grid gap-3 sm:grid-cols-3 2xl:grid-cols-1">
                {TIER_ORDER.map((id) => {
                  const includedRows = rows.filter(
                    (row) => cellState(row, id) === "included",
                  );
                  const recurring = includedRows.filter(
                    (row) =>
                      readServiceConfiguration(current, row).cadence ===
                      "monthly",
                  ).length;
                  const optional = rows.filter(
                    (row) => cellState(row, id) === "optional",
                  ).length;
                  return (
                    <div
                      key={id}
                      className="rounded-lg border border-slate-200 p-3"
                    >
                      {renamePackages ? (
                        <input
                          aria-label={`Name for ${packageName(id)} package`}
                          maxLength={40}
                          value={current.packageNames[id]}
                          onChange={(event) =>
                            updateAssessment("packageNames", {
                              ...current.packageNames,
                              [id]: event.target.value,
                            })
                          }
                          onBlur={(event) => {
                            if (!event.target.value.trim())
                              updateAssessment("packageNames", {
                                ...current.packageNames,
                                [id]: resolveProposalPackageName({}, id),
                              });
                          }}
                          className="w-full rounded border border-slate-300 px-2 py-1 text-sm"
                        />
                      ) : (
                        <h3 className="break-words text-sm font-semibold text-slate-900">
                          {packageName(id)}
                        </h3>
                      )}
                      <p className="mt-1 text-sm font-semibold text-slate-900">
                        {prices.find((item) => item.id === id)?.monthlyLabel}
                        <span className="ml-1 text-xs font-normal text-slate-500">
                          base
                        </span>
                      </p>
                      <p className="mt-3 text-xs leading-6 text-slate-600">
                        {recurring} recurring included
                        <br />
                        {includedRows.length - recurring} one-time included
                        <br />
                        {optional} optional add-ons
                      </p>
                    </div>
                  );
                })}
              </div>
              {cleanup ? (
                <div className="mt-4 border-t border-slate-200 pt-3">
                  <p className="text-xs font-medium text-slate-500">
                    Onboarding &amp; catch-up estimate
                  </p>
                  <p className="mt-1 text-sm font-semibold text-slate-800">
                    {cleanup.amountLabel}
                  </p>
                  <p className="mt-1 text-xs text-slate-500">
                    Excludes optional one-time services.
                  </p>
                </div>
              ) : null}
            </aside>
          ) : null}
        </div>
      </section>
    </main>
  );
}
