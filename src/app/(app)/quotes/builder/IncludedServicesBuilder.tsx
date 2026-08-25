"use client";

import { ChevronDown } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import type { ProposalAppCollapsibleForceSignal } from "./ProposalAppCollapsibleSection";

type PackageId = "grow" | "improve" | "maintain";

export type IncludedCatalogService = {
  id: string;
  code: string;
  name: string;
  category: string;
  serviceType: string;
  cardLabel: string;
  clientBenefit: string;
  defaultInclusion: string;
  priority: number;
};

type PackageSelections = Record<PackageId, string[]>;

type SavedTemplate = {
  id: string;
  name: string;
  packageSelections: PackageSelections;
};

type TemplateOption = SavedTemplate & {
  kind: "builtin" | "custom";
};

type PackageAssignment = PackageId | "none";

const PACKAGE_ASSIGNMENT_OPTIONS: Array<{
  value: PackageAssignment;
  label: string;
  headerClass: string;
  countClass: string;
}> = [
  {
    value: "grow",
    label: "Grow",
    headerClass: "bg-slate-950 text-white",
    countClass: "text-white/70",
  },
  {
    value: "improve",
    label: "Improve",
    headerClass: "bg-slate-100 text-slate-900",
    countClass: "text-slate-500",
  },
  {
    value: "maintain",
    label: "Maintain",
    headerClass: "bg-white text-slate-900",
    countClass: "text-slate-500",
  },
  {
    value: "none",
    label: "Not included",
    headerClass: "bg-stone-50 text-slate-900",
    countClass: "text-slate-500",
  },
];

const TEMPLATE_STORAGE_KEY = "proposal-app-demo-included-templates-v2";
const SELECTION_STORAGE_KEY = "proposal-app-demo-included-selection-v2";
const ACTIVE_TEMPLATE_STORAGE_KEY = "proposal-app-demo-included-active-template-v2";

const PACKAGE_COLUMNS: Array<{
  id: PackageId;
  name: string;
  description: string;
  cardClass: string;
  subtleCardClass: string;
}> = [
  {
    id: "grow",
    name: "Grow",
    description: "Concierge support, executive reporting, and higher-touch partnership.",
    cardClass: "border-slate-950 bg-slate-950 text-white",
    subtleCardClass: "border-slate-200 bg-slate-50 text-slate-900",
  },
  {
    id: "improve",
    name: "Improve",
    description: "Maintain plus stronger reporting visibility and better operating insight.",
    cardClass: "border-slate-200 bg-slate-100 text-slate-900",
    subtleCardClass: "border-slate-200 bg-slate-50 text-slate-900",
  },
  {
    id: "maintain",
    name: "Maintain",
    description: "Core monthly bookkeeping and a clean, reliable close process.",
    cardClass: "border-slate-200 bg-white text-slate-900",
    subtleCardClass: "border-slate-200 bg-white text-slate-900",
  },
];

function createEmptySelections(): PackageSelections {
  return {
    grow: [],
    improve: [],
    maintain: [],
  };
}

function normalizeSelections(
  selections: PackageSelections,
  validServiceIds: Set<string>,
): PackageSelections {
  return {
    grow: Array.from(new Set(selections.grow.filter((id) => validServiceIds.has(id)))),
    improve: Array.from(new Set(selections.improve.filter((id) => validServiceIds.has(id)))),
    maintain: Array.from(new Set(selections.maintain.filter((id) => validServiceIds.has(id)))),
  };
}

function getPackageAssignment(
  selections: PackageSelections,
  serviceId: string,
): PackageAssignment {
  if (selections.maintain.includes(serviceId)) return "maintain";
  if (selections.improve.includes(serviceId)) return "improve";
  if (selections.grow.includes(serviceId)) return "grow";
  return "none";
}

function buildSearchText(service: IncludedCatalogService) {
  return [
    service.name,
    service.cardLabel,
    service.clientBenefit,
    service.category,
    service.serviceType,
    service.defaultInclusion,
    service.code,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

function hasKeyword(text: string, keywords: string[]) {
  return keywords.some((keyword) => text.includes(keyword));
}

function getSuggestedPackages(service: IncludedCatalogService) {
  const text = buildSearchText(service);
  const defaultInclusion = service.defaultInclusion.toLowerCase();

  const coreKeywords = [
    "bookkeeping",
    "reconciliation",
    "reconcile",
    "financial statement",
    "monthly close",
    "close process",
    "bank account",
    "credit card",
    "loan accounting",
    "cleanup onboarding",
    "onboarding",
    "tax return",
    "cpa",
    "client portal",
    "document",
  ];
  const improveKeywords = [
    "budget",
    "forecast",
    "reporting",
    "dashboard",
    "analysis",
    "review",
    "kpi",
    "accounts receivable",
    "a/r",
    "accounts payable",
    "a/p",
    "insight",
    "visibility",
    "management report",
  ];
  const growKeywords = [
    "concierge",
    "cfo",
    "controller",
    "advisory",
    "strategy",
    "strategic",
    "priority support",
    "priority communication",
    "dedicated coordination",
    "faster turnaround",
    "proactive",
    "executive",
  ];

  const suggested = new Set<PackageId>();
  const isCore =
    defaultInclusion === "included" ||
    defaultInclusion === "core" ||
    defaultInclusion === "standard" ||
    hasKeyword(text, coreKeywords);
  const isImprove = hasKeyword(text, improveKeywords);
  const isGrow = hasKeyword(text, growKeywords);

  if (isCore || (!isImprove && !isGrow)) {
    suggested.add("maintain");
    suggested.add("improve");
    suggested.add("grow");
  }

  if (isImprove) {
    suggested.add("improve");
    suggested.add("grow");
  }

  if (isGrow) {
    suggested.add("grow");
  }

  return suggested;
}

function buildBuiltInTemplates(services: IncludedCatalogService[]): TemplateOption[] {
  const validIds = new Set(services.map((service) => service.id));

  const starterSelections = createEmptySelections();
  const baselineSelections = createEmptySelections();
  const conciergeSelections = createEmptySelections();

  services.forEach((service) => {
    const suggested = getSuggestedPackages(service);
    const text = buildSearchText(service);
    const isGrowOnly = hasKeyword(text, [
      "concierge",
      "cfo",
      "controller",
      "strategic",
      "advisory",
      "priority support",
    ]);
    const isImproveOnly = hasKeyword(text, [
      "budget",
      "forecast",
      "dashboard",
      "analysis",
      "kpi",
      "accounts receivable",
      "accounts payable",
      "a/r",
      "a/p",
    ]);

    PACKAGE_COLUMNS.forEach((pkg) => {
      if (suggested.has(pkg.id)) {
        starterSelections[pkg.id].push(service.id);
      }
    });

    if (suggested.has("maintain")) {
      baselineSelections.maintain.push(service.id);
    }

    if (!isImproveOnly && !isGrowOnly && suggested.has("maintain")) {
      conciergeSelections.maintain.push(service.id);
      conciergeSelections.improve.push(service.id);
      conciergeSelections.grow.push(service.id);
    }

    if (isImproveOnly) {
      conciergeSelections.improve.push(service.id);
      conciergeSelections.grow.push(service.id);
    }

    if (isGrowOnly) {
      conciergeSelections.grow.push(service.id);
    }
  });

  return [
    {
      id: "builtin-rei-starter",
      name: "REI 3-Tier Starter",
      kind: "builtin",
      packageSelections: normalizeSelections(starterSelections, validIds),
    },
    {
      id: "builtin-maintain-baseline",
      name: "Maintain Baseline",
      kind: "builtin",
      packageSelections: normalizeSelections(baselineSelections, validIds),
    },
    {
      id: "builtin-concierge-path",
      name: "Concierge Upgrade Path",
      kind: "builtin",
      packageSelections: normalizeSelections(conciergeSelections, validIds),
    },
  ];
}

function sortServices(services: IncludedCatalogService[]) {
  return [...services].sort((left, right) => {
    if (left.priority !== right.priority) return left.priority - right.priority;
    if (left.category !== right.category) return left.category.localeCompare(right.category);
    return left.name.localeCompare(right.name);
  });
}

export default function IncludedServicesBuilder({
  catalogServices,
  forceOpen,
}: {
  catalogServices: IncludedCatalogService[];
  forceOpen?: ProposalAppCollapsibleForceSignal;
}) {
  const hydratedRef = useRef(false);
  const sortedServices = useMemo(() => sortServices(catalogServices), [catalogServices]);
  const builtInTemplates = useMemo(
    () => buildBuiltInTemplates(sortedServices),
    [sortedServices],
  );
  const [customTemplates, setCustomTemplates] = useState<SavedTemplate[]>([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState(() => builtInTemplates[0]?.id ?? "");
  const [templateName, setTemplateName] = useState(() => builtInTemplates[0]?.name ?? "");
  const [expandedSectionValues, setExpandedSectionValues] = useState<PackageAssignment[]>([]);
  const [expandedServiceIds, setExpandedServiceIds] = useState<string[]>([]);
  const [lastForceToken, setLastForceToken] = useState(forceOpen?.token);

  if (forceOpen && forceOpen.token !== lastForceToken) {
    setLastForceToken(forceOpen.token);
    setExpandedSectionValues(
      forceOpen.value ? PACKAGE_ASSIGNMENT_OPTIONS.map((option) => option.value) : [],
    );
  }
  const [packageSelections, setPackageSelections] = useState<PackageSelections>(
    () => builtInTemplates[0]?.packageSelections ?? createEmptySelections(),
  );

  const validServiceIds = useMemo(
    () => new Set(sortedServices.map((service) => service.id)),
    [sortedServices],
  );

  const templateOptions = useMemo<TemplateOption[]>(
    () => [...builtInTemplates, ...customTemplates.map((template) => ({ ...template, kind: "custom" as const }))],
    [builtInTemplates, customTemplates],
  );

  useEffect(() => {
    if (!sortedServices.length) return;

    const fallbackTemplate = builtInTemplates[0];
    const fallbackSelections =
      fallbackTemplate?.packageSelections ?? normalizeSelections(createEmptySelections(), validServiceIds);

    try {
      const rawTemplates = window.localStorage.getItem(TEMPLATE_STORAGE_KEY);
      const rawSelections = window.localStorage.getItem(SELECTION_STORAGE_KEY);
      const rawActiveTemplate = window.localStorage.getItem(ACTIVE_TEMPLATE_STORAGE_KEY);

      const parsedTemplates = rawTemplates ? (JSON.parse(rawTemplates) as SavedTemplate[]) : [];
      const sanitizedTemplates = parsedTemplates.map((template) => ({
        ...template,
        packageSelections: normalizeSelections(template.packageSelections, validServiceIds),
      }));

      const parsedSelections = rawSelections
        ? normalizeSelections(JSON.parse(rawSelections) as PackageSelections, validServiceIds)
        : fallbackSelections;
      const activeTemplateExists = rawActiveTemplate
        ? [...builtInTemplates, ...sanitizedTemplates].some((template) => template.id === rawActiveTemplate)
        : false;
      const nextActiveTemplateId =
        rawActiveTemplate && activeTemplateExists ? rawActiveTemplate : fallbackTemplate?.id ?? "";
      const nextTemplateName =
        [...builtInTemplates, ...sanitizedTemplates].find((template) => template.id === nextActiveTemplateId)
          ?.name ?? "";

      const frame = window.requestAnimationFrame(() => {
        setCustomTemplates(sanitizedTemplates);
        setPackageSelections(parsedSelections);
        setSelectedTemplateId(nextActiveTemplateId);
        setTemplateName(nextTemplateName);
        hydratedRef.current = true;
      });

      return () => window.cancelAnimationFrame(frame);
    } catch {
      const frame = window.requestAnimationFrame(() => {
        setCustomTemplates([]);
        setPackageSelections(fallbackSelections);
        setSelectedTemplateId(fallbackTemplate?.id ?? "");
        setTemplateName(fallbackTemplate?.name ?? "");
        hydratedRef.current = true;
      });

      return () => window.cancelAnimationFrame(frame);
    }
  }, [builtInTemplates, sortedServices, validServiceIds]);

  useEffect(() => {
    if (!hydratedRef.current) return;

    try {
      window.localStorage.setItem(TEMPLATE_STORAGE_KEY, JSON.stringify(customTemplates));
      window.localStorage.setItem(SELECTION_STORAGE_KEY, JSON.stringify(packageSelections));
      window.localStorage.setItem(ACTIVE_TEMPLATE_STORAGE_KEY, selectedTemplateId);
    } catch {
      // Ignore storage failures in demo mode.
    }
  }, [customTemplates, packageSelections, selectedTemplateId]);

  const activeTemplate = templateOptions.find((template) => template.id === selectedTemplateId) ?? null;
  const selectedTemplateIsCustom = activeTemplate?.kind === "custom";
  const servicesByAssignment = useMemo(
    () =>
      PACKAGE_ASSIGNMENT_OPTIONS.map((option) => ({
        ...option,
        services: sortedServices.filter(
          (service) => getPackageAssignment(packageSelections, service.id) === option.value,
        ),
      })),
    [packageSelections, sortedServices],
  );

  function applyTemplate(templateId: string) {
    const template = templateOptions.find((item) => item.id === templateId);
    if (!template) return;

    setSelectedTemplateId(template.id);
    setTemplateName(template.name);
    setPackageSelections(template.packageSelections);
  }

  function setServicePackage(serviceId: string, assignment: PackageAssignment) {
    setPackageSelections((current) => {
      const next: PackageSelections = {
        grow: current.grow.filter((id) => id !== serviceId),
        improve: current.improve.filter((id) => id !== serviceId),
        maintain: current.maintain.filter((id) => id !== serviceId),
      };

      if (assignment === "grow") {
        next.grow.push(serviceId);
      }

      if (assignment === "improve") {
        next.improve.push(serviceId);
        next.grow.push(serviceId);
      }

      if (assignment === "maintain") {
        next.maintain.push(serviceId);
        next.improve.push(serviceId);
        next.grow.push(serviceId);
      }

      return next;
    });
  }

  function toggleExpandedService(serviceId: string) {
    setExpandedServiceIds((current) =>
      current.includes(serviceId)
        ? current.filter((id) => id !== serviceId)
        : [...current, serviceId],
    );
  }

  function toggleExpandedSection(sectionValue: PackageAssignment) {
    setExpandedSectionValues((current) =>
      current.includes(sectionValue)
        ? current.filter((value) => value !== sectionValue)
        : [...current, sectionValue],
    );
  }

  function saveNewTemplate() {
    const nextName = templateName.trim();
    if (!nextName) return;

    const newTemplate: SavedTemplate = {
      id: `custom-${Date.now()}`,
      name: nextName,
      packageSelections,
    };

    setCustomTemplates((current) => [...current, newTemplate]);
    setSelectedTemplateId(newTemplate.id);
  }

  function renameTemplate() {
    if (!selectedTemplateIsCustom) return;
    const nextName = templateName.trim();
    if (!nextName) return;

    setCustomTemplates((current) =>
      current.map((template) =>
        template.id === selectedTemplateId ? { ...template, name: nextName } : template,
      ),
    );
  }

  function deleteTemplate() {
    if (!selectedTemplateIsCustom) return;

    const fallbackTemplate = builtInTemplates[0] ?? null;
    setCustomTemplates((current) =>
      current.filter((template) => template.id !== selectedTemplateId),
    );

    if (fallbackTemplate) {
      setSelectedTemplateId(fallbackTemplate.id);
      setTemplateName(fallbackTemplate.name);
      setPackageSelections(fallbackTemplate.packageSelections);
    }
  }

  if (!sortedServices.length) {
    return (
      <div className="bg-white px-5 py-4">
        <p className="text-base font-semibold tracking-tight text-slate-900">Included services</p>
        <p className="mt-2 text-sm text-slate-500">
          No active catalog services were available for this environment.
        </p>
      </div>
    );
  }

  return (
    <div className="bg-white">
      <div className="border-b border-slate-200 px-5 py-4">
        <p className="text-base font-semibold tracking-tight text-slate-900">Templates</p>
        <div className="flex flex-wrap items-center gap-3">
          <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">
            Template
          </span>
          <select
            value={selectedTemplateId}
            onChange={(event) => applyTemplate(event.target.value)}
            className="h-11 min-w-[220px] rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-900 shadow-sm focus:border-brandnavy focus:outline-none focus:ring-2 focus:ring-brandnavy/10"
          >
            {templateOptions.map((template) => (
              <option key={template.id} value={template.id}>
                {template.name}
              </option>
            ))}
          </select>

          <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">
            Template name
          </span>
          <input
            value={templateName}
            onChange={(event) => setTemplateName(event.target.value)}
            className="h-11 min-w-[280px] flex-1 rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-900 shadow-sm focus:border-brandnavy focus:outline-none focus:ring-2 focus:ring-brandnavy/10"
          />

          <button
            type="button"
            onClick={saveNewTemplate}
            className="inline-flex h-10 items-center justify-center rounded-xl border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50"
          >
            Save
          </button>
          <button
            type="button"
            onClick={renameTemplate}
            disabled={!selectedTemplateIsCustom}
            className="inline-flex h-10 items-center justify-center rounded-xl border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Edit
          </button>
          <button
            type="button"
            onClick={deleteTemplate}
            disabled={!selectedTemplateIsCustom}
            className="inline-flex h-10 items-center justify-center rounded-xl border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Delete
          </button>
        </div>
      </div>

      <div className="space-y-4 py-4">
        {servicesByAssignment.map((section) => {
          const isExpanded = expandedSectionValues.includes(section.value);

          return (
            <div
              key={section.value}
              className="overflow-hidden rounded-[1.5rem] border border-slate-300 bg-white shadow-sm"
            >
              <button
                type="button"
                onClick={() => toggleExpandedSection(section.value)}
                aria-expanded={isExpanded}
                className={`flex w-full items-center justify-between gap-3 px-4 py-2.5 text-left ${section.headerClass}`}
              >
                <div className="flex items-center gap-3">
                  <ChevronDown
                    className={`h-4 w-4 transition-transform ${
                      isExpanded ? "rotate-180" : ""
                    }`}
                  />
                  <p className="text-sm font-semibold">{section.label}</p>
                </div>
                <p
                  className={`text-xs font-semibold uppercase tracking-[0.14em] ${section.countClass}`}
                >
                  {section.services.length}
                </p>
              </button>

              {isExpanded ? (
                <>
                  <div className="grid grid-cols-[180px_minmax(0,1.7fr)] border-t border-slate-200 bg-slate-50/70">
                    <div className="px-4 py-2 text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
                      Package
                    </div>
                    <div className="px-4 py-2 text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
                      Service catalog
                    </div>
                  </div>

                  {section.services.length === 0 ? (
                    <div className="border-t border-slate-200 px-4 py-3 text-sm text-slate-400">
                      No services.
                    </div>
                  ) : (
                    section.services.map((service, index) => (
                      <div key={service.id}>
                        <div
                          onClick={() => toggleExpandedService(service.id)}
                          className={`grid grid-cols-[180px_minmax(0,1.7fr)] ${
                            index % 2 === 0 ? "bg-white" : "bg-stone-50"
                          } cursor-pointer transition hover:bg-slate-50`}
                          role="button"
                          tabIndex={0}
                          aria-expanded={expandedServiceIds.includes(service.id)}
                          onKeyDown={(event) => {
                            if (event.key === "Enter" || event.key === " ") {
                              event.preventDefault();
                              toggleExpandedService(service.id);
                            }
                          }}
                        >
                          <div className="px-4 py-1.5" onClick={(event) => event.stopPropagation()}>
                            <div className="relative inline-flex min-w-[112px] items-center">
                              <select
                                value={getPackageAssignment(packageSelections, service.id)}
                                onChange={(event) =>
                                  setServicePackage(
                                    service.id,
                                    event.target.value as PackageAssignment,
                                  )
                                }
                                className="h-7 w-full appearance-none border-0 bg-transparent px-2 pr-6 text-sm font-medium text-slate-700 shadow-none outline-none focus:ring-0"
                              >
                                {PACKAGE_ASSIGNMENT_OPTIONS.map((option) => (
                                  <option key={option.value} value={option.value}>
                                    {option.label}
                                  </option>
                                ))}
                              </select>
                              <ChevronDown className="pointer-events-none absolute right-0 h-4 w-4 text-slate-400" />
                            </div>
                          </div>
                          <div className="flex min-w-0 items-center justify-between gap-4 px-4 py-2">
                            <div className="min-w-0 flex-1">
                              <p className="truncate text-sm font-semibold text-slate-900">
                                {service.name}
                              </p>
                            </div>
                          </div>
                        </div>

                        {expandedServiceIds.includes(service.id) ? (
                          <div className="border-t border-slate-200 bg-slate-50 px-4 py-4">
                            <div className="grid gap-4 lg:grid-cols-[220px_minmax(0,1fr)]">
                              <div className="space-y-1">
                                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">
                                  Service details
                                </p>
                                <p className="text-sm font-semibold text-slate-900">
                                  {service.cardLabel || service.name}
                                </p>
                                <p className="text-sm text-slate-500">Code: {service.code}</p>
                                <p className="text-sm text-slate-500">
                                  Type: {service.serviceType}
                                </p>
                                <p className="text-sm text-slate-500">Category: {service.category}</p>
                              </div>
                              <div className="space-y-3">
                                {service.clientBenefit ? (
                                  <div>
                                    <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">
                                      Client-facing outcome
                                    </p>
                                    <p className="mt-1 text-sm leading-6 text-slate-600">
                                      {service.clientBenefit}
                                    </p>
                                  </div>
                                ) : null}
                                {service.defaultInclusion ? (
                                  <div>
                                    <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">
                                      Default inclusion
                                    </p>
                                    <p className="mt-1 text-sm leading-6 text-slate-600">
                                      {service.defaultInclusion}
                                    </p>
                                  </div>
                                ) : null}
                              </div>
                            </div>
                          </div>
                        ) : null}
                      </div>
                    ))
                  )}
                </>
              ) : null}
            </div>
          );
        })}
      </div>
    </div>
  );
}
