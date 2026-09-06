"use client";

import { Archive, ArchiveRestore, Check, ChevronDown, ChevronUp, Ellipsis, Eye, EyeOff, Pencil, Plus, Trash2, X } from "lucide-react";
import { useEffect, useRef, useState, type Dispatch, type ReactNode, type SetStateAction } from "react";
import ProposalAppDemoHeader from "./ProposalAppDemoHeader";
import OptionsTemplatesToolbar from "./OptionsTemplatesToolbar";
import {
  getOptionsCatalogOrder,
  getProposalAdditionalOptions,
  getProposalBonuses,
  useProposalAssessmentDemoState,
  type PackageId,
  type ProposalAdditionalOption,
  type ProposalBonus,
} from "./ProposalCreationWorkspaceDemo";
import {
  extraIsAvailableForBookSet,
  extraIsRealEstateSpecific,
  proposalCatalogItemApplicability,
  type ProposalOptionCatalogItem,
} from "@/lib/quotes/catalog";
import type { OptionsTemplateAssessmentSlice } from "@/lib/quotes/optionsTemplates";

const PACKAGES: Array<{ id: PackageId; label: string }> = [
  { id: "grow", label: "Grow" },
  { id: "improve", label: "Improve" },
  { id: "maintain", label: "Maintain" },
];

type CatalogKind = "optional" | "included";
type BonusCadence = "monthly" | "one-time";

type CatalogRow = {
  id: string;
  name: string;
  description: string;
  archived: boolean;
  kind: CatalogKind;
  cadence: BonusCadence;
  option?: ProposalAdditionalOption;
  bonus?: ProposalBonus;
};

export default function ProposalAddOnsDemo({ catalog = [] }: { catalog?: ProposalOptionCatalogItem[] }) {
  const { assessment, setAssessment, storageReady, updateAssessment } = useProposalAssessmentDemoState();
  const [editingIds, setEditingIds] = useState<string[]>([]);
  const additionalOptions = getProposalAdditionalOptions(assessment, catalog);
  const bonuses = getProposalBonuses(assessment, catalog);
  const catalogOrder = getOptionsCatalogOrder(assessment, catalog);
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
  const archivedRows = eligibleRows.filter((row) => row.archived);

  useEffect(() => {
    if (!storageReady || catalog.length === 0) return;
    setAssessment((current) => {
      const additionalOptions = getProposalAdditionalOptions(current, catalog);
      const bonuses = getProposalBonuses(current, catalog);
      const bonusPackageSelections = { ...current.bonusPackageSelections };
      for (const bonus of bonuses) {
        if (
          !Object.prototype.hasOwnProperty.call(bonusPackageSelections, bonus.id) &&
          bonus.defaultPackageIds
        ) {
          bonusPackageSelections[bonus.id] = bonus.defaultPackageIds;
        }
      }
      const next = {
        ...current,
        additionalOptions,
        bonuses,
        bonusPackageSelections,
      };
      const optionsCatalogOrder = getOptionsCatalogOrder(next, catalog);
      if (
        current.additionalOptions.length > 0 &&
        current.bonuses.length > 0 &&
        current.optionsCatalogOrder.length === optionsCatalogOrder.length &&
        current.optionsCatalogOrder.every((id, index) => id === optionsCatalogOrder[index])
      ) {
        return current;
      }
      return { ...next, optionsCatalogOrder };
    });
  }, [catalog, setAssessment, storageReady]);

  function persistOrder(order: string[]) {
    updateAssessment("optionsCatalogOrder", order);
  }

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

  function updateRow(row: CatalogRow, changes: { name?: string; description?: string }) {
    if (row.kind === "optional") updateOption(row.id, changes);
    else updateBonus(row.id, changes);
  }

  function addRow(kind: CatalogKind) {
    const id = `${kind === "optional" ? "additional" : "bonus"}-${crypto.randomUUID()}`;
    if (kind === "optional") {
      persistOptions([
        ...additionalOptions,
        { id, name: "New add-on", description: "Describe what the client can select.", monthlyPrice: 0, showInProposal: true, archived: false },
      ]);
    } else {
      persistBonuses([...bonuses, { id, name: "New included extra", description: "Describe the included benefit.", archived: false }]);
      updateAssessment("bonusPackageSelections", {
        ...assessment.bonusPackageSelections,
        [id]: PACKAGES.map(({ id: packageId }) => packageId),
      });
    }
    persistOrder([...catalogOrder, id]);
    setEditingIds((ids) => [...ids, id]);
  }

  function deleteRow(row: CatalogRow) {
    if (catalogByKey.has(row.id)) {
      archiveRow(row, true);
      return;
    }
    if (row.kind === "optional") persistOptions(additionalOptions.filter((item) => item.id !== row.id));
    else persistBonuses(bonuses.filter((item) => item.id !== row.id));
    const selections = Object.fromEntries(
      Object.entries(assessment.bonusPackageSelections).filter(([selectionId]) => selectionId !== row.id),
    );
    updateAssessment("bonusPackageSelections", selections);
    persistOrder(catalogOrder.filter((id) => id !== row.id));
  }

  function archiveRow(row: CatalogRow, archived: boolean) {
    if (row.kind === "optional") updateOption(row.id, { archived });
    else updateBonus(row.id, { archived });
  }

  function moveRow(id: string, direction: -1 | 1) {
    persistOrder(moveOrderId(catalogOrder, id, direction, visibleRows.map((row) => row.id)));
  }

  function setKind(row: CatalogRow, kind: CatalogKind) {
    if (row.kind === kind) return;
    const carriedRealEstateSpecific =
      row.option?.realEstateSpecific ?? row.bonus?.realEstateSpecific;
    if (kind === "included") {
      persistOptions(additionalOptions.filter((item) => item.id !== row.id));
      persistBonuses([...bonuses, {
        id: row.id,
        name: row.name,
        description: row.description,
        archived: row.archived,
        realEstateSpecific: carriedRealEstateSpecific,
        billingCadence: row.bonus?.billingCadence ?? "one-time",
      }]);
      // Preserve any prior per-package selections (they apply to bonuses AND
      // options now); only initialize to all packages when none exist.
      if (!Array.isArray(assessment.bonusPackageSelections[row.id])) {
        updateAssessment("bonusPackageSelections", {
          ...assessment.bonusPackageSelections,
          [row.id]: PACKAGES.map(({ id }) => id),
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
    return Array.isArray(saved)
      ? saved
      : bonus.defaultPackageIds ?? (legacyBonusIncluded(bonus.id) ? PACKAGES.map(({ id }) => id) : []);
  }

  function toggleBonusPackage(bonus: ProposalBonus, packageId: PackageId) {
    const selected = selectedBonusPackages(bonus);
    const next = selected.includes(packageId) ? selected.filter((id) => id !== packageId) : [...selected, packageId];
    updateAssessment("bonusPackageSelections", { ...assessment.bonusPackageSelections, [bonus.id]: next });
  }

  function selectedOptionPackages(option: ProposalAdditionalOption) {
    const saved = assessment.bonusPackageSelections[option.id];
    return Array.isArray(saved) ? saved : PACKAGES.map(({ id }) => id);
  }

  function toggleOptionPackage(option: ProposalAdditionalOption, packageId: PackageId) {
    const selected = selectedOptionPackages(option);
    const next = selected.includes(packageId)
      ? selected.filter((id) => id !== packageId)
      : [...selected, packageId];
    updateAssessment("bonusPackageSelections", { ...assessment.bonusPackageSelections, [option.id]: next });
  }

  return (
    <main className="min-h-screen">
      <section className="w-full px-5 py-6 lg:px-8">
        <ProposalAppDemoHeader currentStep="add-ons" previousHref="/offers/calculator" nextHref="/offers/intro" />
        <div className="proposal-options-editor mt-4 min-w-0">
          <div className="px-1">
            <div className="mb-2 flex flex-wrap items-center gap-2">
              <OptionsTemplatesToolbar
                currentSlice={{
                  optionsCatalogOrder: assessment.optionsCatalogOrder,
                  additionalOptions: assessment.additionalOptions,
                  bonuses: assessment.bonuses,
                  bonusPackageSelections: assessment.bonusPackageSelections,
                }}
                hasCustomizedOptions={
                  assessment.additionalOptions.length > 0 || assessment.bonuses.length > 0
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
                    })),
                    bonusPackageSelections: slice.bonusPackageSelections,
                  }));
                }}
                middleSlot={
                  <>
                    <button type="button" onClick={() => addRow("optional")} className="inline-flex cursor-pointer items-center gap-1 rounded-md border border-slate-300 bg-white px-2.5 py-1 text-base font-medium text-slate-700 transition hover:border-slate-500 hover:bg-slate-100 hover:text-slate-900">
                      <Plus className="h-3.5 w-3.5" /> Add add-on
                    </button>
                    <button type="button" onClick={() => addRow("included")} className="inline-flex cursor-pointer items-center gap-1 rounded-md border border-slate-300 bg-white px-2.5 py-1 text-base font-medium text-slate-700 transition hover:border-slate-500 hover:bg-slate-100 hover:text-slate-900">
                      <Plus className="h-3.5 w-3.5" /> Add included service
                    </button>
                  </>
                }
              />
            </div>
          </div>

          <section>
            <div className="proposal-builder-card overflow-x-auto rounded-xl border border-slate-200">
              <table className="min-w-[880px] w-full border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50">
                    <Heading className="w-12"><span className="sr-only">Reorder</span></Heading>
                    <Heading>Service</Heading>
                    <Heading>Description</Heading>
                    <Heading className="w-24 text-center whitespace-nowrap">Offer As</Heading>
                    <Heading className="w-24 text-center whitespace-nowrap">Cadence</Heading>
                    <Heading className="text-center">Price / month</Heading>
                    {PACKAGES.map(({ id, label }) => (
                      <Heading key={id} className="w-20 text-center">{label}</Heading>
                    ))}
                    <Heading className="w-16 text-center"><span className="sr-only">Actions</span></Heading>
                  </tr>
                </thead>
                <tbody>
                  {visibleRows.map((row, index) => {
                    const isEditing = editingIds.includes(row.id);
                    const option = row.option;
                    const bonus = row.bonus;
                    const applicable = bonus ? isBonusApplicable(bonus) : true;
                    const selected = bonus
                      ? selectedBonusPackages(bonus)
                      : option
                        ? selectedOptionPackages(option)
                        : [];
                    const isRowIncluded = row.kind !== "optional" || Boolean(option?.showInProposal);
                    return (
                      <tr key={row.id} className={rowClass(isRowIncluded)}>
                        <td className="w-12 px-1 py-4 text-center align-middle">
                          <MoveButtons
                            label={row.name || (row.kind === "optional" ? "optional service" : "included extra")}
                            disableUp={index === 0}
                            disableDown={index === visibleRows.length - 1}
                            onMoveUp={() => moveRow(row.id, -1)}
                            onMoveDown={() => moveRow(row.id, 1)}
                          />
                        </td>
                        <EditableCells
                          editing={isEditing}
                          item={row}
                          onChange={(changes) => updateRow(row, changes)}
                        />
                        <td className="w-0 whitespace-nowrap px-3 py-4 align-middle">
                          <KindToggle
                            name={row.name || "item"}
                            value={row.kind}
                            onChange={(kind) => setKind(row, kind)}
                          />
                        </td>
                        <td className="w-0 whitespace-nowrap px-3 py-4 align-middle">
                          {row.kind === "included" ? (
                            <CadenceToggle
                              name={row.name || "included extra"}
                              value={row.cadence}
                              onChange={(cadence) => setBonusCadence(row, cadence)}
                            />
                          ) : (
                            <span className="text-sm text-slate-300">—</span>
                          )}
                        </td>
                        <td className="w-32 px-3 py-4 text-center align-middle">
                          {row.kind === "optional" && option ? (
                            isEditing ? (
                              <span className="mx-auto flex w-24 rounded-md border border-slate-300 bg-white px-2.5 py-2 text-sm">
                                <span className="mr-1 text-slate-400">$</span>
                                <input
                                  aria-label={`${row.name || "Optional service"} monthly price`}
                                  type="number"
                                  min="0"
                                  step="1"
                                  value={option.monthlyPrice}
                                  onChange={(event) => updateOption(row.id, { monthlyPrice: Math.max(0, Number(event.target.value) || 0) })}
                                  className="w-16 bg-transparent text-right outline-none"
                                />
                              </span>
                            ) : (
                              <p className="text-sm font-medium tabular-nums text-slate-900">${option.monthlyPrice.toLocaleString("en-US")}</p>
                            )
                          ) : (
                            <span className="text-sm text-slate-300">—</span>
                          )}
                        </td>
                        {PACKAGES.map(({ id, label }) => (
                          <td key={id} className="px-2 py-4 text-center align-middle">
                            {row.kind === "included" && bonus ? (
                              applicable ? (
                                <button
                                  type="button"
                                  role="checkbox"
                                  aria-checked={selected.includes(id)}
                                  aria-label={`${selected.includes(id) ? "Remove" : "Add"} ${row.name} ${selected.includes(id) ? "from" : "to"} ${label}`}
                                  onClick={() => toggleBonusPackage(bonus, id)}
                                  className={checkboxClass(selected.includes(id))}
                                >
                                  <Check className="h-4 w-4" strokeWidth={3} />
                                </button>
                              ) : (
                                <span className="text-xs font-medium text-slate-300">N/A</span>
                              )
                            ) : row.kind === "optional" && option ? (
                              <button
                                type="button"
                                role="checkbox"
                                aria-checked={selected.includes(id)}
                                aria-label={`${selected.includes(id) ? "Remove" : "Add"} ${row.name} ${selected.includes(id) ? "from" : "to"} ${label}`}
                                onClick={() => toggleOptionPackage(option, id)}
                                className={checkboxClass(selected.includes(id))}
                              >
                                <Check className="h-4 w-4" strokeWidth={3} />
                              </button>
                            ) : (
                              <span className="text-sm text-slate-300">—</span>
                            )}
                          </td>
                        ))}
                        <Actions
                          editing={isEditing}
                          itemLabel={row.name || (row.kind === "optional" ? "optional service" : "included extra")}
                          setEditing={setEditingIds}
                          id={row.id}
                          onArchive={() => archiveRow(row, true)}
                          onDelete={() => deleteRow(row)}
                          visibleToLead={row.kind === "optional" && option ? option.showInProposal : undefined}
                          onToggleLeadVisibility={row.kind === "optional" && option
                            ? () => updateOption(row.id, { showInProposal: !option.showInProposal })
                            : undefined}
                        />
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <ArchivedItems
              items={archivedRows}
              onRestore={(id) => {
                const row = archivedRows.find((item) => item.id === id);
                if (row) archiveRow(row, false);
              }}
              onDelete={(id) => {
                const row = archivedRows.find((item) => item.id === id);
                if (row) deleteRow(row);
              }}
            />
          </section>
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
  return <th className={`px-4 py-3 text-left text-sm font-semibold normal-case text-slate-700 ${className}`}>{children}</th>;
}

function EditableCells({
  editing,
  item,
  onChange,
}: {
  editing: boolean;
  item: { name: string; description: string };
  onChange: (changes: { name?: string; description?: string }) => void;
}) {
  return (
    <>
      <td className="w-[22%] px-4 py-3 align-top">
        {editing ? (
          <input
            aria-label="Service name"
            value={item.name}
            onChange={(event) => onChange({ name: event.target.value })}
            className="w-full rounded-md border border-slate-300 bg-white px-2.5 py-1.5 font-medium text-slate-900 outline-none focus:border-brandnavy"
          />
        ) : (
          <p className="font-medium leading-5 text-slate-900">{item.name || "Untitled service"}</p>
        )}
      </td>
      <td className="w-[28%] px-4 py-3 align-top">
        {editing ? (
          <textarea
            aria-label={`${item.name || "Service"} description`}
            value={item.description}
            onChange={(event) => onChange({ description: event.target.value })}
            rows={2}
            className="w-full resize-y rounded-md border border-slate-300 bg-white px-2.5 py-1.5 leading-5 text-slate-700 outline-none focus:border-brandnavy"
          />
        ) : (
          <p className="leading-5 text-slate-500">{item.description || "No description"}</p>
        )}
      </td>
    </>
  );
}

function MoveButtons({
  label,
  disableUp,
  disableDown,
  onMoveUp,
  onMoveDown,
}: {
  label: string;
  disableUp: boolean;
  disableDown: boolean;
  onMoveUp: () => void;
  onMoveDown: () => void;
}) {
  const buttonClass = (disabled: boolean) =>
    `grid h-6 w-7 place-items-center rounded-md border-0 bg-transparent transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brandnavy focus-visible:ring-offset-1 ${
      disabled
        ? "cursor-not-allowed text-slate-300"
        : "cursor-pointer text-slate-600 hover:bg-slate-100 hover:text-slate-950"
    }`;
  return (
    <div className="inline-flex flex-col items-center">
      <button type="button" aria-label={`Move ${label} up`} disabled={disableUp} onClick={onMoveUp} className={buttonClass(disableUp)}>
        <ChevronUp className="h-4 w-4" strokeWidth={2.75} />
      </button>
      <button type="button" aria-label={`Move ${label} down`} disabled={disableDown} onClick={onMoveDown} className={buttonClass(disableDown)}>
        <ChevronDown className="h-4 w-4" strokeWidth={2.75} />
      </button>
    </div>
  );
}

function Actions({
  editing,
  itemLabel,
  id,
  setEditing,
  onArchive,
  onDelete,
  visibleToLead,
  onToggleLeadVisibility,
}: {
  editing: boolean;
  itemLabel: string;
  id: string;
  setEditing: Dispatch<SetStateAction<string[]>>;
  onArchive: () => void;
  onDelete: () => void;
  visibleToLead?: boolean;
  onToggleLeadVisibility?: () => void;
}) {
  const popoverRef = useRef<HTMLDivElement>(null);
  const [moreOpen, setMoreOpen] = useState(false);
  const toggle = () => setEditing((ids) => (ids.includes(id) ? ids.filter((item) => item !== id) : [...ids, id]));

  useEffect(() => {
    if (!moreOpen) return;
    const close = () => popoverRef.current?.hidePopover();
    window.addEventListener("resize", close);
    return () => window.removeEventListener("resize", close);
  }, [moreOpen]);

  const actionClass = "flex min-h-9 w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-100 focus-visible:outline-2";

  return (
    <td className="w-16 px-2 py-3 text-center align-middle">
      <button
        type="button"
        popoverTarget={`option-actions-${id}`}
        aria-label={`More actions for ${itemLabel}`}
        title={`More actions for ${itemLabel}`}
        className="ui-action-secondary inline-flex h-9 w-9 items-center justify-center rounded-full border transition"
        onClick={(event) => {
          const panel = popoverRef.current;
          if (!panel) return;
          const rect = event.currentTarget.getBoundingClientRect();
          panel.style.left = `${Math.max(8, Math.min(rect.right - 224, window.innerWidth - 232))}px`;
          const below = window.innerHeight - rect.bottom;
          const openBelow = below >= 200 || below >= rect.top;
          panel.style.top = openBelow ? `${rect.bottom + 4}px` : "auto";
          panel.style.bottom = openBelow ? "auto" : `${window.innerHeight - rect.top + 4}px`;
          panel.style.maxHeight = `${Math.max(0, (openBelow ? below : rect.top) - 12)}px`;
        }}
      >
        <Ellipsis className="h-4 w-4" aria-hidden="true" />
      </button>
      <div
        id={`option-actions-${id}`}
        ref={popoverRef}
        popover="auto"
        onToggle={(event) => setMoreOpen(event.newState === "open")}
        aria-label={`Actions for ${itemLabel}`}
        className="fixed m-0 w-56 overflow-y-auto rounded-xl border border-slate-200 bg-white p-1.5 text-sm text-slate-700 shadow-xl"
        onClick={(event) => {
          if ((event.target as HTMLElement).closest("button")) popoverRef.current?.hidePopover();
        }}
      >
        <button type="button" onClick={toggle} className={actionClass}>
          {editing ? <Check className="h-4 w-4" /> : <Pencil className="h-4 w-4" />}
          {editing ? "Done editing" : "Edit"}
        </button>
        {onToggleLeadVisibility ? (
          <button type="button" onClick={onToggleLeadVisibility} className={actionClass}>
            {visibleToLead ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            {visibleToLead ? "Hide from lead" : "Show to lead"}
          </button>
        ) : null}
        <button type="button" onClick={onArchive} className={actionClass}>
          <Archive className="h-4 w-4" />
          Archive
        </button>
        <button type="button" onClick={onDelete} className={`${actionClass} text-rose-700 hover:bg-rose-50`}>
          <Trash2 className="h-4 w-4" />
          Delete
        </button>
      </div>
    </td>
  );
}

function ArchivedItems({
  items,
  onRestore,
  onDelete,
}: {
  items: CatalogRow[];
  onRestore: (id: string) => void;
  onDelete: (id: string) => void;
}) {
  return items.length > 0 ? (
    <section className="mt-4 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
      <p className="text-sm font-medium text-slate-700">Archived items</p>
      <div className="mt-2 flex flex-wrap gap-2">
        {items.map((item) => (
          <span key={item.id} className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-600">
            {item.name || "Untitled item"}
            <span className={`rounded px-1.5 py-0.5 text-xs font-semibold ${item.kind === "optional" ? "proposal-options-kind-optional" : "bg-slate-100 text-slate-700"}`}>
              {item.kind === "optional" ? "Add-on" : "Included"}
            </span>
            <button type="button" aria-label={`Restore ${item.name || "item"}`} onClick={() => onRestore(item.id)} className="cursor-pointer text-brandnavy hover:opacity-70">
              <ArchiveRestore className="h-4 w-4" />
            </button>
            <button type="button" aria-label={`Delete ${item.name || "item"}`} onClick={() => onDelete(item.id)} className="cursor-pointer text-slate-400 hover:text-rose-700">
              <X className="h-4 w-4" />
            </button>
          </span>
        ))}
      </div>
    </section>
  ) : null;
}

function checkboxClass(checked: boolean) {
  return `mx-auto grid h-6 w-6 cursor-pointer place-items-center rounded-md border transition ${
    checked ? "proposal-options-check text-white" : "border-slate-300 bg-white text-transparent hover:border-slate-400"
  }`;
}

function rowClass(isIncluded: boolean) {
  const backgroundClass = isIncluded ? "bg-white" : "proposal-options-row-not-included bg-slate-100";

  return `border-b border-slate-200 transition-colors last:border-0 [&>td]:!py-3 ${backgroundClass}`;
}

function moveOrderId(order: string[], id: string, direction: -1 | 1, visibleIds: string[]) {
  const visibleIndex = visibleIds.indexOf(id);
  const targetId = visibleIds[visibleIndex + direction];
  if (!targetId) return order;
  const sourceIndex = order.indexOf(id);
  const targetIndex = order.indexOf(targetId);
  if (sourceIndex < 0 || targetIndex < 0) return order;
  const next = [...order];
  [next[sourceIndex], next[targetIndex]] = [next[targetIndex], next[sourceIndex]];
  return next;
}
