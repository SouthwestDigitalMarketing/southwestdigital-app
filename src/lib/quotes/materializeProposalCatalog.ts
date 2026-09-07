import "server-only";

import { prisma } from "@/lib/prisma";
import { getSchemaCapabilities } from "@/lib/database/schemaCapabilities";
import { proposalCatalogItemApplicability } from "@/lib/quotes/catalog";
import { slugifyTagKey } from "@/lib/contacts/tags";

type JsonRecord = Record<string, unknown>;

function isRecord(value: unknown): value is JsonRecord {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function booleanValue(record: JsonRecord, key: string, fallback = false) {
  return typeof record[key] === "boolean" ? record[key] : fallback;
}

function numericValue(record: JsonRecord, key: string) {
  return typeof record[key] === "number" && Number.isFinite(record[key])
    ? record[key]
    : null;
}

const PACKAGE_ORDER = ["maintain", "improve", "grow"] as const;

function normalizePackageIds(value: unknown) {
  if (!Array.isArray(value)) return [] as Array<(typeof PACKAGE_ORDER)[number]>;
  const selected = PACKAGE_ORDER.filter((id) => value.includes(id));
  if (selected.length < 2) return selected;
  return PACKAGE_ORDER.slice(
    PACKAGE_ORDER.indexOf(selected[0]),
    PACKAGE_ORDER.indexOf(selected[selected.length - 1]) + 1,
  );
}

function optionPrice(
  offerKey: string,
  defaultPrice: number,
  assessment: JsonRecord,
) {
  if (offerKey === "advanced-receipt-management") {
    const band =
      typeof assessment.transactionBand === "string"
        ? assessment.transactionBand
        : "";
    const minimum =
      (
        { "0-99": 99, "100-499": 499, "500-999": 999, "1000+": 1000 } as Record<
          string,
          number
        >
      )[band] ?? defaultPrice;
    const override = numericValue(
      assessment,
      "advancedReceiptManagementPriceOverride",
    );
    return override === null ? minimum : Math.max(minimum, override);
  }
  const overrideKey = (
    {
      "project-tracking": "projectTrackingPriceOverride",
      "budget-reporting": "budgetReportingPriceOverride",
      "sales-tax-filing": "salesTaxFilingPriceOverride",
    } as Record<string, string>
  )[offerKey];
  return overrideKey
    ? (numericValue(assessment, overrideKey) ?? defaultPrice)
    : defaultPrice;
}

function optionSelected(offerKey: string, assessment: JsonRecord) {
  const selectionKey = (
    {
      "advanced-receipt-management": "offerAdvancedReceiptManagement",
      "project-tracking": "offerProjectTracking",
      "budget-reporting": "offerBudgetReporting",
      "sales-tax-filing": "offerSalesTaxFiling",
      "tax-preparer-coordination": "includeTaxPreparerCoordinationCall",
      "registered-agent-service": "includeRegisteredAgentService",
    } as Record<string, string>
  )[offerKey];
  return selectionKey ? booleanValue(assessment, selectionKey) : true;
}

export async function materializeProposalCatalog(
  brandId: string,
  value: unknown,
  { freezeApplicability = false }: { freezeApplicability?: boolean } = {},
) {
  if (!isRecord(value)) return value;
  const { proposalCatalog, proposalPackageDefaults, catalogProductKind } = await getSchemaCapabilities();
  if (!proposalCatalog) return value;

  const catalog = await prisma.catalogService.findMany({
    where: {
      brandId,
      active: true,
      // Hourly rows belong to the /offers/hourly builder; keeping them out
      // stops another product line leaking into the bookkeeping proposal.
      ...(catalogProductKind ? { productKind: "bookkeeping" } : {}),
    },
    orderBy: [{ priority: "asc" }, { name: "asc" }],
    select: {
      offerKey: true,
      code: true,
      name: true,
      clientBenefit: true,
      internalDescription: true,
      defaultInclusion: true,
      offerSection: true,
      ...(proposalPackageDefaults ? { defaultPackageKeys: true } : {}),
      defaultPrice: true,
      billingCadence: true,
      requiresPlatformMigration: true,
      requiredTargetPlatform: true,
      applicabilityNote: true,
      realEstateSpecific: true,
    },
  });
  const applicabilityById = new Map(
    catalog.flatMap((item) => {
      const effectiveOfferKey = item.offerKey ?? slugifyTagKey(item.code ?? item.name);
      if (!effectiveOfferKey) return [];
      const result = proposalCatalogItemApplicability(
        {
          id: effectiveOfferKey,
          offerKey: effectiveOfferKey,
          name: item.name,
          code: null,
          description: item.clientBenefit ?? item.internalDescription ?? "",
          defaultInclusion:
            item.defaultInclusion === "optional" ? "optional" : "included",
          defaultPrice:
            item.defaultPrice == null ? 0 : Number(item.defaultPrice),
          billingCadence: item.billingCadence,
          requiresPlatformMigration: item.requiresPlatformMigration,
          requiredTargetPlatform: item.requiredTargetPlatform,
          applicabilityNote: item.applicabilityNote,
          realEstateSpecific: item.realEstateSpecific,
        },
        {
          bookSetType:
            typeof value.bookSetType === "string" ? value.bookSetType : "",
          ongoingBookkeepingPlatform:
            typeof value.ongoingBookkeepingPlatform === "string"
              ? value.ongoingBookkeepingPlatform
              : "",
          platformMigrationEnabled: booleanValue(
            value,
            "platformMigrationEnabled",
          ),
        },
      );
      return [[effectiveOfferKey, result] as const];
    }),
  );
  const withPublicationApplicability = (items: unknown[]) =>
    items.map((item) => {
      if (!isRecord(item) || typeof item.id !== "string") return item;
      const applicability = applicabilityById.get(item.id);
      if (!applicability) return item;
      if (freezeApplicability) {
        return {
          ...item,
          applicable: applicability.applicable,
          applicabilityReason: applicability.reason,
        };
      }
      const draftItem = { ...item };
      delete draftItem.applicable;
      delete draftItem.applicabilityReason;
      return draftItem;
    });

  const existingOptions = Array.isArray(value.additionalOptions)
    ? value.additionalOptions
    : [];
  const existingBonuses = Array.isArray(value.bonuses) ? value.bonuses : [];
  const existingOptionsById = new Map(
    existingOptions.flatMap((item) =>
      isRecord(item) && typeof item.id === "string" ? [[item.id, item] as const] : [],
    ),
  );
  const existingBonusesById = new Map(
    existingBonuses.flatMap((item) =>
      isRecord(item) && typeof item.id === "string" ? [[item.id, item] as const] : [],
    ),
  );
  const hasPersistedOptions = existingOptions.length > 0
    || existingBonuses.length > 0
    || (isRecord(value.bonusPackageSelections) && Object.keys(value.bonusPackageSelections).length > 0);
  const catalogIds = new Set<string>();
  const additionalOptions = withPublicationApplicability(catalog.flatMap((item) => {
    const id = item.offerKey ?? slugifyTagKey(item.code ?? item.name);
    if (!id) return [];
    catalogIds.add(id);
    const existingOption = existingOptionsById.get(id);
    if (existingOption) {
      return [{
        ...existingOption,
        id,
        name: item.name,
        description: item.clientBenefit ?? item.internalDescription ?? "",
        archived: false,
        realEstateSpecific: item.realEstateSpecific,
      }];
    }
    if (existingBonusesById.has(id) || item.defaultInclusion !== "optional") return [];
    if (hasPersistedOptions || item.offerSection !== "options") return [];
    return [{
      id,
      name: item.name,
      description: item.clientBenefit ?? item.internalDescription ?? "",
      monthlyPrice: optionPrice(
        id,
        item.defaultPrice == null ? 0 : Number(item.defaultPrice),
        value,
      ),
      showInProposal: hasPersistedOptions ? optionSelected(id, value) : false,
      archived: false,
      billingCadence: item.billingCadence === "monthly" ? "monthly" : "one-time",
      packageIds: normalizePackageIds(item.defaultPackageKeys),
      realEstateSpecific: item.realEstateSpecific,
    }];
  }));
  const catalogBonuses = catalog.flatMap((item) => {
    const id = item.offerKey ?? slugifyTagKey(item.code ?? item.name);
    if (!id) return [];
    catalogIds.add(id);
    const existingBonus = existingBonusesById.get(id);
    if (existingOptionsById.has(id) || item.defaultInclusion === "optional") return [];
    const defaultPackageIds = normalizePackageIds("defaultPackageKeys" in item ? item.defaultPackageKeys : null);
    if (!existingBonus && (hasPersistedOptions || item.offerSection !== "core-services" || defaultPackageIds.length === 0)) return [];
    return [{
      ...(existingBonus ?? {}),
      id,
      name: item.name,
      description: item.clientBenefit ?? item.internalDescription ?? "",
      archived: false,
      realEstateSpecific: item.realEstateSpecific,
      billingCadence:
        existingBonus?.billingCadence === "monthly" || existingBonus?.billingCadence === "one-time"
          ? existingBonus.billingCadence
          : item.billingCadence === "monthly" ? "monthly" : "one-time",
      defaultPackageIds,
      ...(existingBonus?.addOnPrice != null || (!hasPersistedOptions && item.defaultPrice != null && Number(item.defaultPrice) > 0)
        ? {
            addOnPrice: existingBonus?.addOnPrice ?? Number(item.defaultPrice),
            addOnPackageIds: existingBonus?.addOnPackageIds ?? PACKAGE_ORDER.filter((id) => !defaultPackageIds.includes(id)),
          }
        : {}),
      offerSection: item.offerSection,
    }];
  });
  const bonuses = withPublicationApplicability(catalogBonuses);
  const existingBonusPackageSelections = isRecord(value.bonusPackageSelections)
    ? value.bonusPackageSelections
    : {};
  const bonusPackageSelections: JsonRecord = Object.fromEntries(
    Object.entries(existingBonusPackageSelections).filter(([id]) => catalogIds.has(id)),
  );
  for (const item of catalogBonuses) {
    if (
      !Object.prototype.hasOwnProperty.call(bonusPackageSelections, item.id) &&
      item.defaultPackageIds.length > 0
    ) {
      bonusPackageSelections[item.id] = normalizePackageIds(item.defaultPackageIds);
    }
  }
  const knownIds = [
    ...additionalOptions.flatMap((item) =>
      isRecord(item) && typeof item.id === "string" ? [item.id] : [],
    ),
    ...bonuses.flatMap((item) =>
      isRecord(item) && typeof item.id === "string" ? [item.id] : [],
    ),
  ];
  const storedOrder = Array.isArray(value.optionsCatalogOrder)
    ? value.optionsCatalogOrder.filter(
        (id): id is string => typeof id === "string" && knownIds.includes(id),
      )
    : [];

  return {
    ...value,
    additionalOptions,
    bonuses,
    bonusPackageSelections,
    optionsCatalogOrder: [
      ...storedOrder,
      ...knownIds.filter((id) => !storedOrder.includes(id)),
    ],
  };
}
