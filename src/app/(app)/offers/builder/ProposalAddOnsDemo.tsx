"use client";

import { Eye, EyeOff, LibraryBig, Pencil, Search } from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Fragment, useEffect, type ReactNode } from "react";
import ProposalAppDemoHeader from "./ProposalAppDemoHeader";
import OptionsTemplatesToolbar from "./OptionsTemplatesToolbar";
import PricingSnapshotSidebar from "./PricingSnapshotSidebar";
import {
  getOptionsCatalogOrder,
  getProposalAdditionalOptions,
  getProposalBonuses,
  getProposalPricingSnapshotCleanupCard,
  getProposalPricingSnapshotItems,
  reconcileProposalAssessmentWithCatalog,
  useProposalAssessmentDemoState,
  type ProposalAdditionalOption,
  type ProposalBonus,
} from "./ProposalCreationWorkspaceDemo";
import {
  PROPOSAL_PACKAGE_IDS,
  abbreviateProposalPackageName,
  resolveProposalPackageName,
  type PackageId,
} from "./proposalPackageNames";
import {
  normalizeTierPackageIds,
  packageIdsFromTierRange,
  TIER_ORDER,
  tierRangeFromPackageIds,
  type TierRange,
} from "./proposalTierRanges";
import {
  extraIsAvailableForBookSet,
  extraIsRealEstateSpecific,
  proposalCatalogItemApplicability,
  type ProposalOptionCatalogItem,
} from "@/lib/quotes/catalog";
import type { OptionsTemplateAssessmentSlice } from "@/lib/quotes/optionsTemplates";

type CatalogKind = "optional" | "included";
type BonusCadence = "monthly" | "one-time";

type CatalogRow = {
  id: string;
  name: string;
  description: string;
  archived: boolean;
  kind: CatalogKind;
  cadence: BonusCadence;
  offerSection?: string;
  option?: ProposalAdditionalOption;
  bonus?: ProposalBonus;
};

export default function ProposalAddOnsDemo({
  catalog = [],
  catalogAuthoritative = false,
}: {
  catalog?: ProposalOptionCatalogItem[];
  catalogAuthoritative?: boolean;
}) {
  const searchParams = useSearchParams();
  const { assessment, setAssessment, storageReady, updateAssessment } = useProposalAssessmentDemoState();
  const offerReturnPath = `/offers/add-ons${searchParams.size ? `?${searchParams.toString()}` : ""}`;
  const catalogHref = `/services?returnTo=${encodeURIComponent(offerReturnPath)}`;
  const packageOptions = PROPOSAL_PACKAGE_IDS.map((id) => ({
    id,
    label: resolveProposalPackageName(assessment.packageNames, id),
  }));
  const reconciledCatalog = catalogAuthoritative
    ? reconcileProposalAssessmentWithCatalog(assessment, catalog)
    : null;
  const additionalOptions = reconciledCatalog?.additionalOptions
    ?? getProposalAdditionalOptions(assessment, catalog);
  const bonuses = reconciledCatalog?.bonuses ?? getProposalBonuses(assessment, catalog);
  const catalogOrder = reconciledCatalog?.optionsCatalogOrder
    ?? getOptionsCatalogOrder(assessment, catalog);
  const catalogByKey = new Map(catalog.map((item) => [item.offerKey, item]));
  const optionById = new Map(additionalOptions.map((item) => [item.id, item]));
  const bonusById = new Map(bonuses.map((item) => [item.id, item]));
  const rows = catalogOrder.flatMap<CatalogRow>((id) => {
    const option = optionById.get(id);
    if (option) {
      return [{
        id,
        name: option.name,
        description: option.description,
        archived: option.archived,
        kind: "optional",
        cadence: "monthly",
        offerSection: catalogByKey.get(id)?.offerSection,
        option,
      }];
    }
    const bonus = bonusById.get(id);
    if (bonus) {
      const cadence: BonusCadence = bonus.billingCadence === "monthly" ? "monthly" : "one-time";
      return [{
        id,
        name: bonus.name,
        description: bonus.description,
        archived: bonus.archived,
        kind: "included",
        cadence,
        offerSection: catalogByKey.get(id)?.offerSection,
        bonus,
      }];
    }
    return [];
  });
  const eligibleRows = rows.filter((row) => {
    const catalogItem = catalogByKey.get(row.id);
    if (catalogItem) return proposalCatalogItemApplicability(catalogItem, assessment).applicable;
    const item = row.option ?? row.bonus;
    return !item || extraIsAvailableForBookSet(item, catalog, assessment.bookSetType);
  });
  const visibleRows = eligibleRows.filter((row) => !row.archived);
  const coreRows = visibleRows.filter((row) => row.kind === "included" && row.offerSection === "core-services");
  const addOnRows = visibleRows.filter((row) => !coreRows.includes(row));
  const orderedVisibleRows = [...coreRows, ...addOnRows];

  useEffect(() => {
    if (!storageReady || !catalogAuthoritative) return;
    setAssessment((current) => {
      const next = reconcileProposalAssessmentWithCatalog(current, catalog);
      const currentSlice = JSON.stringify({
        additionalOptions: current.additionalOptions,
        bonuses: current.bonuses,
        bonusPackageSelections: current.bonusPackageSelections,
        optionsCatalogOrder: current.optionsCatalogOrder,
      });
      return currentSlice === JSON.stringify(next) ? current : { ...current, ...next };
    });
  }, [
    assessment.additionalOptions,
    assessment.bonusPackageSelections,
    assessment.bonuses,
    assessment.optionsCatalogOrder,
    catalog,
    catalogAuthoritative,
    setAssessment,
    storageReady,
  ]);

  function persistOptions(next: ProposalAdditionalOption[]) {
    updateAssessment("additionalOptions", next);
  }

  function persistBonuses(next: ProposalBonus[]) {
    updateAssessment("bonuses", next);
  }

  function updateOption(id: string, changes: Partial<ProposalAdditionalOption>) {
    persistOptions(additionalOptions.map((item) => (item.id === id ? { ...item, ...changes } : item)));
  }

  function updateBonus(id: string, changes: Partial<ProposalBonus>) {
    persistBonuses(bonuses.map((item) => (item.id === id ? { ...item, ...changes } : item)));
  }

  function setKind(row: CatalogRow, kind: CatalogKind) {
    if (row.kind === kind) return;
    const carriedRealEstateSpecific =
      row.option?.realEstateSpecific ?? row.bonus?.realEstateSpecific;
    if (kind === "included") {
      const priorPackages = row.option ? selectedOptionPackages(row.option) : packageOptions.map(({ id }) => id);
      persistOptions(additionalOptions.filter((item) => item.id !== row.id));
      persistBonuses([...bonuses, {
        id: row.id,
        name: row.name,
        description: row.description,
        archived: row.archived,
        realEstateSpecific: carriedRealEstateSpecific,
        billingCadence: row.bonus?.billingCadence ?? "one-time",
        defaultPackageIds: normalizeTierPackageIds(priorPackages),
      }]);
      // Preserve any prior per-package selections (they apply to bonuses AND
      // options now); only initialize to all packages when none exist.
      if (!Array.isArray(assessment.bonusPackageSelections[row.id])) {
        updateAssessment("bonusPackageSelections", {
          ...assessment.bonusPackageSelections,
          [row.id]: normalizeTierPackageIds(priorPackages),
        });
      }
    } else {
      persistBonuses(bonuses.filter((item) => item.id !== row.id));
      persistOptions([
        ...additionalOptions,
        {
          id: row.id,
          name: row.name,
          description: row.description,
          monthlyPrice: row.option?.monthlyPrice ?? 0,
          showInProposal: row.option?.showInProposal ?? true,
          archived: row.archived,
          billingCadence: row.option?.billingCadence ?? "monthly",
          packageIds: normalizeTierPackageIds(row.option?.packageIds ?? assessment.bonusPackageSelections[row.id] ?? packageOptions.map(({ id }) => id)),
          realEstateSpecific: carriedRealEstateSpecific,
        },
      ]);
    }
  }

  function setBonusCadence(row: CatalogRow, cadence: BonusCadence) {
    if (row.kind !== "included") return;
    updateBonus(row.id, { billingCadence: cadence });
  }

  function isBonusApplicable(bonus: ProposalBonus) {
    const catalogItem = catalogByKey.get(bonus.id);
    if (catalogItem && typeof bonus.realEstateSpecific !== "boolean") {
      return proposalCatalogItemApplicability(catalogItem, assessment).applicable;
    }
    const realEstate = assessment.bookSetType === "real-estate-only" || assessment.bookSetType === "mixed-books";
    if (bonus.id === "stessa-migration") return assessment.platformMigrationEnabled && assessment.ongoingBookkeepingPlatform === "stessa";
    if (!extraIsRealEstateSpecific(bonus, catalog)) return true;
    if (bonus.id === "new-quickbooks-file") return realEstate && assessment.ongoingBookkeepingPlatform === "qbo";
    return realEstate;
  }

  function legacyBonusIncluded(id: string) {
    return (
      (
        {
          "stessa-migration": assessment.includeConditionalStessaMigration,
          "property-reporting-setup": assessment.includePropertyLevelReportingSetup,
          "document-organization": assessment.includeDocumentOrganizationSetup,
          "quarterly-review": assessment.includeQuarterlyFinancialReview,
          "doublehq-client-portal": assessment.includeDoubleHqClientPortal,
          "real-estate-chart-of-accounts": assessment.includeRealEstateChartOfAccounts,
          "new-quickbooks-file": assessment.includeNewQuickBooksFileSetup,
        } as Record<string, boolean>
      )[id] ?? false
    );
  }

  function selectedBonusPackages(bonus: ProposalBonus) {
    if (!isBonusApplicable(bonus)) return [];
    const saved = assessment.bonusPackageSelections[bonus.id];
    return normalizeTierPackageIds(Array.isArray(saved)
      ? saved
      : bonus.defaultPackageIds ?? (legacyBonusIncluded(bonus.id) ? packageOptions.map(({ id }) => id) : []));
  }

  function toggleBonusPackage(bonus: ProposalBonus, packageId: PackageId) {
    const selected = selectedBonusPackages(bonus);
    const next = selected.includes(packageId) ? selected.filter((id) => id !== packageId) : [...selected, packageId];
    updateAssessment("bonusPackageSelections", { ...assessment.bonusPackageSelections, [bonus.id]: next });
  }

  function selectedOptionPackages(option: ProposalAdditionalOption) {
    const saved = assessment.bonusPackageSelections[option.id];
    return normalizeTierPackageIds(option.packageIds ?? (Array.isArray(saved) ? saved : packageOptions.map(({ id }) => id)));
  }

  function toggleOptionPackage(option: ProposalAdditionalOption, packageId: PackageId) {
    const selected = selectedOptionPackages(option);
    const next = selected.includes(packageId)
      ? selected.filter((id) => id !== packageId)
      : [...selected, packageId];
    updateAssessment("bonusPackageSelections", { ...assessment.bonusPackageSelections, [option.id]: next });
  }

  function updateIncludedRange(bonus: ProposalBonus, range: TierRange | null) {
    updateAssessment("bonusPackageSelections", {
      ...assessment.bonusPackageSelections,
      [bonus.id]: packageIdsFromTierRange(range),
    });
  }

  function updateAddOnRange(row: CatalogRow, range: TierRange | null) {
    const packageIds = packageIdsFromTierRange(range);
    if (row.option) {
      updateOption(row.id, { packageIds });
      updateAssessment("bonusPackageSelections", {
        ...assessment.bonusPackageSelections,
        [row.id]: packageIds,
      });
    } else if (row.bonus) {
      updateBonus(row.id, { addOnPackageIds: packageIds });
    }
  }

  return (
    <main className="min-h-screen">
      <section className="w-full px-5 py-6 lg:px-8">
        <ProposalAppDemoHeader currentStep="add-ons" />
        <div className="mt-4 grid gap-5 xl:grid-cols-[minmax(0,1fr)_280px] 2xl:grid-cols-[minmax(0,1fr)_300px]">
          <div className="proposal-options-editor min-w-0">
            <div className="px-1">
              <div className="mb-2 flex flex-wrap items-center gap-2">
                <OptionsTemplatesToolbar
                currentSlice={{
                  optionsCatalogOrder: catalogOrder,
                  additionalOptions,
                  bonuses,
                  bonusPackageSelections: reconciledCatalog?.bonusPackageSelections
                    ?? assessment.bonusPackageSelections,
                }}
                hasCustomizedOptions={
                  additionalOptions.length > 0 || bonuses.length > 0
                }
                onApply={(slice: OptionsTemplateAssessmentSlice) => {
                  setAssessment((current) => ({
                    ...current,
                    optionsCatalogOrder: slice.optionsCatalogOrder,
                    additionalOptions: slice.additionalOptions.map((item) => ({
                      id: item.id,
                      name: item.name,
                      description: item.description,
                      monthlyPrice: item.monthlyPrice,
                      showInProposal: item.showInProposal,
                      archived: item.archived,
                      billingCadence: item.billingCadence,
                      packageIds: item.packageIds,
                      realEstateSpecific: item.realEstateSpecific,
                    })),
                    bonuses: slice.bonuses.map((item) => ({
                      id: item.id,
                      name: item.name,
                      description: item.description,
                      archived: item.archived,
                      realEstateSpecific: item.realEstateSpecific,
                      billingCadence: item.billingCadence,
                      defaultPackageIds: item.defaultPackageIds,
                      addOnPrice: item.addOnPrice,
                      addOnPackageIds: item.addOnPackageIds,
                    })),
                    bonusPackageSelections: slice.bonusPackageSelections,
                  }));
                }}
                middleSlot={
                  <Link
                    href={catalogHref}
                    className="inline-flex cursor-pointer items-center gap-1.5 rounded-md border border-slate-300 bg-white px-2.5 py-1 text-base font-medium text-slate-700 transition hover:border-slate-500 hover:bg-slate-100 hover:text-slate-900"
                  >
                    <LibraryBig className="h-3.5 w-3.5" /> Manage service catalogue
                  </Link>
                }
                />
              </div>
              <div className="mb-4 flex items-center gap-2 rounded-lg border border-brandnavy/10 bg-brandnavy/[0.03] px-4 py-3 text-sm text-slate-700">
                <Search className="h-4 w-4 shrink-0 text-brandnavy" aria-hidden="true" />
                <span><strong>{coreRows.length}</strong> curated package services</span>
                <span className="text-slate-400">·</span>
                <span><strong>{addOnRows.filter((row) => row.kind === "optional").length}</strong> add-on choices</span>
              </div>
            </div>

            <section>
            <div className="proposal-builder-card overflow-x-auto rounded-xl border border-slate-200">
              <table className="w-full min-w-[940px] table-fixed border-collapse">
                <colgroup>
                  <col />
                  <col className="w-44" />
                  <col className="w-56" />
                  <col className="w-60" />
                  <col className="w-14" />
                </colgroup>
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50">
                    <Heading>Service details</Heading>
                    <Heading className="text-center">Setup</Heading>
                    <Heading className="text-center">Included in</Heading>
                    <Heading className="text-center">Available as add-on</Heading>
                    <Heading><span className="sr-only">Actions</span></Heading>
                  </tr>
                </thead>
                <tbody>
                  {orderedVisibleRows.map((row, index) => {
                    const option = row.option;
                    const bonus = row.bonus;
                    const catalogItem = catalogByKey.get(row.id);
                    const editCatalogHref = catalogItem
                      ? `${catalogHref}&service=${encodeURIComponent(catalogItem.id)}`
                      : catalogHref;
                    const applicable = bonus ? isBonusApplicable(bonus) : true;
                    const selected = bonus ? selectedBonusPackages(bonus) : [];
                    const addOnPackages = bonus
                      ? normalizeTierPackageIds(bonus.addOnPackageIds)
                      : option
                        ? selectedOptionPackages(option)
                        : [];
                    const isRowIncluded = row.kind !== "optional" || Boolean(option?.showInProposal);
                    return (
                      <Fragment key={row.id}>
                      {index === 0 && coreRows.length > 0 ? <SectionRow label="Standard package lineup" colSpan={5} /> : null}
                      {index === coreRows.length && addOnRows.length > 0 ? <SectionRow label="Optional add-ons and other services" colSpan={5} /> : null}
                      <tr className={rowClass(isRowIncluded)}>
                        <ServiceDetailsCell
                          item={row}
                          hiddenFromLead={row.kind === "optional" && !option?.showInProposal}
                          catalogHref={editCatalogHref}
                        />
                        <td className="px-2 py-3 align-middle">
                          <div className="flex items-start justify-center gap-3">
                            <KindToggle
                              name={row.name || "item"}
                              value={row.kind}
                              onChange={(kind) => setKind(row, kind)}
                            />
                            {row.kind === "included" ? (
                              <CadenceToggle
                                name={row.name || "included extra"}
                                value={row.cadence}
                                onChange={(cadence) => setBonusCadence(row, cadence)}
                              />
                            ) : option ? (
                              <div className="min-w-0 text-center">
                                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Price / mo</p>
                                <div className="mt-1">
                                  <span className="mx-auto flex w-full rounded-md border border-slate-300 bg-white px-2 py-1.5 text-sm">
                                    <span className="mr-1 text-slate-400">$</span>
                                    <input
                                      aria-label={`${row.name || "Optional service"} monthly price`}
                                      type="number"
                                      min="0"
                                      step="1"
                                      value={option.monthlyPrice}
                                      onChange={(event) => updateOption(row.id, { monthlyPrice: Math.max(0, Number(event.target.value) || 0) })}
                                      className="min-w-0 flex-1 bg-transparent text-right outline-none"
                                    />
                                  </span>
                                </div>
                              </div>
                            ) : (
                              <span className="text-sm text-slate-300">—</span>
                            )}
                          </div>
                        </td>
                        <td className="px-2 py-3 text-center align-middle">
                          {row.kind === "included" && bonus ? (
                            <TierRangeControl
                              label={`Included in ${row.name}`}
                              value={selected}
                              packageOptions={packageOptions}
                              onChange={(range) => updateIncludedRange(bonus, range)}
                            />
                          ) : <span className="block text-sm text-slate-400">—</span>}
                          <div className="hidden" aria-hidden="true">
                            {packageOptions.map(({ id, label }) =>
                              row.kind === "included" && bonus ? (
                                applicable ? (
                                  <button
                                    key={id}
                                    type="button"
                                    role="checkbox"
                                    aria-checked={selected.includes(id)}
                                    aria-label={`${selected.includes(id) ? "Remove" : "Add"} ${row.name} ${selected.includes(id) ? "from" : "to"} ${label}`}
                                    onClick={() => toggleBonusPackage(bonus, id)}
                                    className={pricingCardClass(selected.includes(id))}
                                    title={label}
                                  >
                                    <span aria-hidden="true">{abbreviateProposalPackageName(label)}</span>
                                  </button>
                                ) : (
                                  <span key={id} className="grid h-8 w-9 place-items-center text-xs font-medium text-slate-300" title={`${label}: not applicable`}>—</span>
                                )
                              ) : row.kind === "optional" && option ? (
                                <button
                                  key={id}
                                  type="button"
                                  role="checkbox"
                                  aria-checked={selected.includes(id)}
                                  aria-label={`${selected.includes(id) ? "Remove" : "Add"} ${row.name} ${selected.includes(id) ? "from" : "to"} ${label}`}
                                  onClick={() => toggleOptionPackage(option, id)}
                                  className={pricingCardClass(selected.includes(id))}
                                  title={label}
                                >
                                  <span aria-hidden="true">{abbreviateProposalPackageName(label)}</span>
                                </button>
                              ) : (
                                <span key={id} className="grid h-8 w-9 place-items-center text-sm text-slate-300">—</span>
                              ),
                            )}
                          </div>
                        </td>
                        <td className="px-2 py-3 align-middle">
                          {row.kind === "included" && bonus && bonus.addOnPrice != null ? (
                            <div className="grid gap-1.5">
                              <TierRangeControl
                                label={`Available as an add-on for ${row.name}`}
                                value={addOnPackages}
                                packageOptions={packageOptions}
                                onChange={(range) => updateAddOnRange(row, range)}
                              />
                              <span className="text-center text-xs text-slate-500">${bonus.addOnPrice.toFixed(2)} {bonus.billingCadence === "one-time" ? "one time" : "/ month"}</span>
                            </div>
                          ) : row.kind === "optional" && option ? (
                            <TierRangeControl
                              label={`Available as an add-on for ${row.name}`}
                              value={addOnPackages}
                              packageOptions={packageOptions}
                              onChange={(range) => updateAddOnRange(row, range)}
                            />
                          ) : <span className="block text-sm text-slate-400">—</span>}
                        </td>
                        <LeadVisibilityAction
                          itemLabel={row.name || (row.kind === "optional" ? "optional service" : "included extra")}
                          visibleToLead={row.kind === "optional" && option ? option.showInProposal : undefined}
                          onToggleLeadVisibility={row.kind === "optional" && option
                            ? () => updateOption(row.id, { showInProposal: !option.showInProposal })
                            : undefined}
                        />
                      </tr>
                      </Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>
            </section>
          </div>
          <PricingSnapshotSidebar
            items={getProposalPricingSnapshotItems(assessment)}
            cleanupCard={getProposalPricingSnapshotCleanupCard(assessment)}
            hideLabel
            editablePackageNames={assessment.packageNames}
            onPackageNameChange={(packageId, name) => updateAssessment("packageNames", {
              ...assessment.packageNames,
              [packageId]: name,
            })}
          />
        </div>
      </section>
    </main>
  );
}

function KindToggle({
  name,
  value,
  onChange,
}: {
  name: string;
  value: CatalogKind;
  onChange: (kind: CatalogKind) => void;
}) {
  const included = value === "included";
  return (
    <div className="flex flex-col items-center gap-1">
      <button
        type="button"
        role="switch"
        aria-checked={included}
        aria-label={`Offer ${name} as ${included ? "included" : "an add-on"}. Switch to ${included ? "add-on" : "included"}.`}
        title={`Switch to ${included ? "Add-on" : "Included"}`}
        onClick={() => onChange(included ? "optional" : "included")}
        className="ui-toggle-switch focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brandnavy focus-visible:ring-offset-2"
      >
        <span className="ui-toggle-switch-thumb" />
      </button>
      <span className="whitespace-nowrap text-sm font-semibold text-slate-700">{included ? "Included" : "Add-on"}</span>
    </div>
  );
}

function CadenceToggle({
  name,
  value,
  onChange,
}: {
  name: string;
  value: BonusCadence;
  onChange: (cadence: BonusCadence) => void;
}) {
  const recurring = value === "monthly";
  return (
    <div className="flex flex-col items-center gap-1">
      <button
        type="button"
        role="switch"
        aria-checked={recurring}
        aria-label={`${name} is ${recurring ? "recurring" : "one-time"}. Switch to ${recurring ? "one-time" : "recurring"}.`}
        title={`Switch to ${recurring ? "One-time" : "Recurring"}`}
        onClick={() => onChange(recurring ? "one-time" : "monthly")}
        className="ui-toggle-switch focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brandnavy focus-visible:ring-offset-2"
      >
        <span className="ui-toggle-switch-thumb" />
      </button>
      <span className="whitespace-nowrap text-sm font-semibold text-slate-700">{recurring ? "Recurring" : "One-time"}</span>
    </div>
  );
}

function Heading({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <th className={`px-2 py-3 text-left text-sm font-semibold normal-case text-slate-700 ${className}`}>{children}</th>;
}

function TierRangeControl({
  label,
  value,
  packageOptions,
  onChange,
}: {
  label: string;
  value: PackageId[];
  packageOptions: Array<{ id: PackageId; label: string }>;
  onChange: (range: TierRange | null) => void;
}) {
  const range = tierRangeFromPackageIds(value);
  const orderedOptions = [...packageOptions].sort(
    (a, b) => TIER_ORDER.indexOf(a.id) - TIER_ORDER.indexOf(b.id),
  );
  return (
    <div className="grid gap-1.5">
      <span className="sr-only">{label}</span>
      <div className="flex items-center justify-center gap-1.5 text-sm">
        <select
          aria-label={`${label}: starting package`}
          value={range?.from ?? ""}
          onChange={(event) => {
            const from = event.target.value as PackageId;
            onChange(from ? { from, to: range?.to ?? from } : null);
          }}
          className="min-w-0 rounded-md border border-slate-300 bg-white px-2 py-1.5 text-sm font-medium text-slate-700"
        >
          <option value="">None</option>
          {orderedOptions.map(({ id, label: optionLabel }) => <option key={id} value={id}>{optionLabel}</option>)}
        </select>
        {range ? <span className="text-slate-400">to</span> : null}
        {range ? (
          <select
            aria-label={`${label}: ending package`}
            value={range.to}
            onChange={(event) => onChange({ from: range.from, to: event.target.value as PackageId })}
            className="min-w-0 rounded-md border border-slate-300 bg-white px-2 py-1.5 text-sm font-medium text-slate-700"
          >
            {orderedOptions.map(({ id, label: optionLabel }) => <option key={id} value={id}>{optionLabel}</option>)}
          </select>
        ) : null}
      </div>
      <span className="text-center text-xs text-slate-500">
        {range ? "Contiguous package range" : "Not offered"}
      </span>
    </div>
  );
}

function SectionRow({ label, colSpan }: { label: string; colSpan: number }) {
  return (
    <tr className="border-b border-slate-200 bg-slate-50">
      <th colSpan={colSpan} className="px-3 py-2 text-left text-xs font-bold uppercase tracking-[0.08em] text-slate-500">
        {label}
      </th>
    </tr>
  );
}

function ServiceDetailsCell({
  item,
  hiddenFromLead,
  catalogHref,
}: {
  item: { name: string; description: string };
  hiddenFromLead: boolean;
  catalogHref: string;
}) {
  return (
    <td className="px-3 py-3 align-middle">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <Link
            href={catalogHref}
            aria-label={`Edit ${item.name || "service"} in the service catalogue`}
            title="Edit in service catalogue"
            className="group inline-flex min-w-0 items-center gap-1.5 font-medium leading-5 text-slate-900 hover:text-brandnavy"
          >
            <span className="truncate">{item.name || "Untitled service"}</span>
            <Pencil className="h-3.5 w-3.5 shrink-0 text-slate-400 transition group-hover:text-brandnavy" aria-hidden="true" />
          </Link>
          {hiddenFromLead ? (
            <span className="shrink-0 rounded-full bg-slate-200 px-2 py-0.5 text-xs font-semibold text-slate-600">Hidden from lead</span>
          ) : null}
        </div>
        <p className="mt-1 line-clamp-2 leading-5 text-slate-500" title={item.description || undefined}>
          {item.description || "No description"}
        </p>
      </div>
    </td>
  );
}

function LeadVisibilityAction({
  itemLabel,
  visibleToLead,
  onToggleLeadVisibility,
}: {
  itemLabel: string;
  visibleToLead?: boolean;
  onToggleLeadVisibility?: () => void;
}) {
  return (
    <td className="w-16 px-2 py-3 text-center align-middle">
      {onToggleLeadVisibility ? (
        <button
          type="button"
          onClick={onToggleLeadVisibility}
          aria-label={`${visibleToLead ? "Hide" : "Show"} ${itemLabel} ${visibleToLead ? "from" : "to"} the lead`}
          title={visibleToLead ? "Hide from lead" : "Show to lead"}
          className="ui-action-secondary inline-flex h-9 w-9 items-center justify-center rounded-full border transition"
        >
          {visibleToLead ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
        </button>
      ) : null}
    </td>
  );
}

function pricingCardClass(checked: boolean) {
  return `grid h-8 w-8 cursor-pointer place-items-center rounded-full border text-xs font-bold transition ${
    checked ? "proposal-options-check text-white" : "border-slate-300 bg-white text-slate-500 hover:border-slate-500 hover:text-slate-900"
  }`;
}

function rowClass(isIncluded: boolean) {
  const backgroundClass = isIncluded ? "bg-white" : "proposal-options-row-not-included bg-slate-100";

  return `border-b border-slate-200 transition-colors last:border-0 [&>td]:!py-3 ${backgroundClass}`;
}
