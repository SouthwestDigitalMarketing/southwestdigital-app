"use client";

import { Archive, ArchiveRestore, Check, ChevronDown, ChevronUp, Pencil, Plus, Trash2, X } from "lucide-react";
import { useEffect, useState, type Dispatch, type ReactNode, type SetStateAction } from "react";
import ProposalAppDemoHeader from "./ProposalAppDemoHeader";
import {
  getOptionsCatalogOrder,
  getProposalAdditionalOptions,
  getProposalBonuses,
  useProposalAssessmentDemoState,
  type PackageId,
  type ProposalAdditionalOption,
  type ProposalBonus,
} from "./ProposalCreationWorkspaceDemo";
import { extraIsRealEstateSpecific, type CatalogRealEstateMarker } from "@/lib/quotes/catalog";
import { listCatalogRealEstateMarkersAction } from "@/app/(app)/services/actions";

const PACKAGES: Array<{ id: PackageId; label: string }> = [
  { id: "grow", label: "Grow" },
  { id: "improve", label: "Improve" },
  { id: "maintain", label: "Maintain" },
];

type CatalogKind = "optional" | "included";

const KIND_OPTIONS: Array<{ value: CatalogKind; label: string }> = [
  { value: "optional", label: "Optional" },
  { value: "included", label: "Included" },
];
type CatalogRow = {
  id: string;
  name: string;
  description: string;
  archived: boolean;
  kind: CatalogKind;
  option?: ProposalAdditionalOption;
  bonus?: ProposalBonus;
};

export default function ProposalAddOnsDemo({ catalog: initialCatalog = [] }: { catalog?: CatalogRealEstateMarker[] }) {
  const { assessment, updateAssessment } = useProposalAssessmentDemoState();
  const [editingIds, setEditingIds] = useState<string[]>([]);
  const [catalog, setCatalog] = useState<CatalogRealEstateMarker[]>(initialCatalog);

  useEffect(() => {
    let cancelled = false;
    listCatalogRealEstateMarkersAction()
      .then((items) => {
        if (!cancelled) setCatalog(items);
      })
      .catch(() => {
        if (!cancelled) setCatalog([]);
      });
    return () => {
      cancelled = true;
    };
  }, []);
  const additionalOptions = getProposalAdditionalOptions(assessment);
  const bonuses = getProposalBonuses(assessment);
  const catalogOrder = getOptionsCatalogOrder(assessment);
  const optionById = new Map(additionalOptions.map((item) => [item.id, item]));
  const bonusById = new Map(bonuses.map((item) => [item.id, item]));
  const rows = catalogOrder.flatMap<CatalogRow>((id) => {
    const option = optionById.get(id);
    if (option) return [{ id, name: option.name, description: option.description, archived: option.archived, kind: "optional", option }];
    const bonus = bonusById.get(id);
    if (bonus) return [{ id, name: bonus.name, description: bonus.description, archived: bonus.archived, kind: "included", bonus }];
    return [];
  });
  const visibleRows = rows.filter((row) => !row.archived);
  const archivedRows = rows.filter((row) => row.archived);

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
        { id, name: "New optional service", description: "Describe what the client can select.", monthlyPrice: 0, showInProposal: true, archived: false },
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
    if (row.kind === "optional") persistOptions(additionalOptions.filter((item) => item.id !== row.id));
    else {
      persistBonuses(bonuses.filter((item) => item.id !== row.id));
      const selections = Object.fromEntries(
        Object.entries(assessment.bonusPackageSelections).filter(([selectionId]) => selectionId !== row.id),
      );
      updateAssessment("bonusPackageSelections", selections);
    }
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
    if (kind === "included") {
      persistOptions(additionalOptions.filter((item) => item.id !== row.id));
      persistBonuses([...bonuses, { id: row.id, name: row.name, description: row.description, archived: row.archived }]);
      updateAssessment("bonusPackageSelections", {
        ...assessment.bonusPackageSelections,
        [row.id]: PACKAGES.map(({ id }) => id),
      });
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
        },
      ]);
      const selections = Object.fromEntries(
        Object.entries(assessment.bonusPackageSelections).filter(([selectionId]) => selectionId !== row.id),
      );
      updateAssessment("bonusPackageSelections", selections);
    }
  }

  function isBonusApplicable(bonus: ProposalBonus) {
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
    return Array.isArray(saved) ? saved : legacyBonusIncluded(bonus.id) ? PACKAGES.map(({ id }) => id) : [];
  }

  function toggleBonusPackage(bonus: ProposalBonus, packageId: PackageId) {
    const selected = selectedBonusPackages(bonus);
    const next = selected.includes(packageId) ? selected.filter((id) => id !== packageId) : [...selected, packageId];
    updateAssessment("bonusPackageSelections", { ...assessment.bonusPackageSelections, [bonus.id]: next });
  }

  return (
    <main className="min-h-screen bg-white">
      <section className="mx-auto w-full max-w-[1720px] px-5 py-6 lg:px-8">
        <ProposalAppDemoHeader currentStep="add-ons" previousHref="/offers/calculator" nextHref="/offers/intro" />
        <div className="proposal-options-editor mt-8 min-w-0">
          <div className="px-1">
            <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
              <h1 className="text-lg font-semibold tracking-tight text-slate-950">Services and extras</h1>
              <p className="text-sm leading-5 text-slate-500">
                Optional services can be selected on the proposal. Included extras are bundled into a package at no extra charge.
              </p>
            </div>
            <div className="mt-3 mb-2 flex flex-wrap gap-2">
              <button type="button" onClick={() => addRow("optional")} className="inline-flex cursor-pointer items-center gap-1 rounded-md border border-slate-300 bg-white px-2.5 py-1 text-base font-medium text-slate-700 transition hover:border-slate-500 hover:bg-slate-100 hover:text-slate-900">
                <Plus className="h-3.5 w-3.5" /> Add optional service
              </button>
              <button type="button" onClick={() => addRow("included")} className="inline-flex cursor-pointer items-center gap-1 rounded-md border border-slate-300 bg-white px-2.5 py-1 text-base font-medium text-slate-700 transition hover:border-slate-500 hover:bg-slate-100 hover:text-slate-900">
                <Plus className="h-3.5 w-3.5" /> Add included extra
              </button>
            </div>
          </div>

          <section>
            <div className="proposal-builder-card overflow-x-auto rounded-xl border border-slate-200">
              <table className="min-w-[1180px] w-full border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50">
                    <Heading className="w-16"><span className="sr-only">Reorder</span></Heading>
                    <Heading>Service</Heading>
                    <Heading>Description</Heading>
                    <Heading className="whitespace-nowrap">Offer as</Heading>
                    <Heading className="text-center">Price / mo</Heading>
                    <Heading className="text-center">Include</Heading>
                    {PACKAGES.map(({ id, label }) => (
                      <Heading key={id} className="w-20 text-center">{label}</Heading>
                    ))}
                    <Heading className="w-28 text-right">Actions</Heading>
                  </tr>
                </thead>
                <tbody>
                  {visibleRows.map((row, index) => {
                    const isEditing = editingIds.includes(row.id);
                    const option = row.option;
                    const bonus = row.bonus;
                    const applicable = bonus ? isBonusApplicable(bonus) : false;
                    const selected = bonus ? selectedBonusPackages(bonus) : [];
                    return (
                      <tr key={row.id} className={rowClass(index)}>
                        <td className="w-16 px-2 py-4 text-center align-middle">
                          <MoveButtons
                            label={row.name || (row.kind === "optional" ? "optional service" : "included extra")}
                            disableUp={index === 0}
                            disableDown={index === visibleRows.length - 1}
                            onMoveUp={() => moveRow(row.id, -1)}
                            onMoveDown={() => moveRow(row.id, 1)}
                          />
                        </td>
                        <EditableCells editing={isEditing} item={row} onChange={(changes) => updateRow(row, changes)} />
                        <td className="w-0 whitespace-nowrap px-3 py-4 align-middle">
                          <KindSelect
                            name={row.name || "item"}
                            value={row.kind}
                            onChange={(kind) => setKind(row, kind)}
                          />
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
                        <td className="px-3 py-4 text-center align-middle">
                          {row.kind === "optional" && option ? (
                            <Toggle
                              checked={option.showInProposal}
                              label={`Show ${row.name || "optional service"} in proposal`}
                              onToggle={() => updateOption(row.id, { showInProposal: !option.showInProposal })}
                            />
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

function KindSelect({
  name,
  value,
  onChange,
}: {
  name: string;
  value: CatalogKind;
  onChange: (kind: CatalogKind) => void;
}) {
  return (
    <div className="grid">
      {KIND_OPTIONS.map((option) => (
        <span
          key={option.value}
          aria-hidden
          className="invisible col-start-1 row-start-1 whitespace-nowrap rounded-md border border-transparent py-1.5 pl-2.5 pr-9 font-semibold"
        >
          {option.label}
        </span>
      ))}
      <select
        aria-label={`Offer ${name} as`}
        value={value}
        onChange={(event) => onChange(event.target.value as CatalogKind)}
        className={`proposal-options-kind col-start-1 row-start-1 w-full cursor-pointer rounded-md border py-1.5 pl-2.5 font-semibold outline-none ${
          value === "optional"
            ? "proposal-options-kind-optional"
            : "border-slate-300 bg-slate-100 text-slate-800 hover:border-slate-500"
        }`}
      >
        {KIND_OPTIONS.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </div>
  );
}

function Heading({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <th className={`px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-500 ${className}`}>{children}</th>;
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
    `grid h-6 w-6 place-items-center rounded-md border transition ${
      disabled
        ? "cursor-not-allowed border-slate-200 bg-slate-50 text-slate-300"
        : "cursor-pointer border-slate-300 bg-white text-slate-500 hover:border-slate-500 hover:bg-slate-100 hover:text-slate-900"
    }`;
  return (
    <div className="inline-flex items-center gap-0.5">
      <button type="button" aria-label={`Move ${label} up`} disabled={disableUp} onClick={onMoveUp} className={buttonClass(disableUp)}>
        <ChevronUp className="h-3.5 w-3.5" />
      </button>
      <button type="button" aria-label={`Move ${label} down`} disabled={disableDown} onClick={onMoveDown} className={buttonClass(disableDown)}>
        <ChevronDown className="h-3.5 w-3.5" />
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
}: {
  editing: boolean;
  itemLabel: string;
  id: string;
  setEditing: Dispatch<SetStateAction<string[]>>;
  onArchive: () => void;
  onDelete: () => void;
}) {
  const toggle = () => setEditing((ids) => (ids.includes(id) ? ids.filter((item) => item !== id) : [...ids, id]));
  return (
    <td className="px-3 py-3 text-right align-top">
      <div className="flex justify-end gap-1">
        <button
          type="button"
          aria-label={`${editing ? "Done editing" : "Edit"} ${itemLabel}`}
          onClick={toggle}
          className={`inline-flex h-8 cursor-pointer items-center gap-1 rounded-md px-2 text-xs font-semibold transition ${
            editing ? "bg-brandnavy text-white hover:opacity-90" : "text-slate-600 hover:bg-slate-100 hover:text-slate-950"
          }`}
        >
          {editing ? <><Check className="h-3.5 w-3.5" /> Done</> : <><Pencil className="h-3.5 w-3.5" /> Edit</>}
        </button>
        <button type="button" aria-label={`Archive ${itemLabel}`} onClick={onArchive} className="cursor-pointer rounded-md p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-900">
          <Archive className="h-4 w-4" />
        </button>
        <button type="button" aria-label={`Delete ${itemLabel}`} onClick={onDelete} className="cursor-pointer rounded-md p-2 text-slate-400 transition hover:bg-rose-50 hover:text-rose-700">
          <Trash2 className="h-4 w-4" />
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
              {item.kind === "optional" ? "Optional" : "Included"}
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

function Toggle({ checked, label, onToggle }: { checked: boolean; label: string; onToggle: () => void }) {
  return (
    <button type="button" role="checkbox" aria-checked={checked} aria-label={label} onClick={onToggle} className={checkboxClass(checked)}>
      <Check className="h-4 w-4" strokeWidth={3} />
    </button>
  );
}

function checkboxClass(checked: boolean) {
  return `mx-auto grid h-6 w-6 cursor-pointer place-items-center rounded-md border transition ${
    checked ? "proposal-options-check text-white" : "border-slate-300 bg-white text-transparent hover:border-slate-400"
  }`;
}

function rowClass(index: number) {
  return `border-b border-slate-200 last:border-0 [&>td]:!py-3 ${index % 2 === 0 ? "bg-white" : "bg-slate-50/50"}`;
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
