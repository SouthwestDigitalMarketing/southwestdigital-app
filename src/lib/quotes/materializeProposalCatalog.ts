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
  const { proposalCatalog, proposalPackageDefaults } = await getSchemaCapabilities();
  if (!proposalCatalog) return value;

  const catalog = await prisma.catalogService.findMany({
    where: {
      brandId,
      active: true,
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
  if (catalog.length === 0) return value;

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
  const additionalOptions =
    existingOptions.length > 0
      ? withPublicationApplicability(existingOptions)
      : withPublicationApplicability(
          catalog
            .filter(
              (item) => item.defaultInclusion === "optional" && item.offerKey,
            )
            .map((item) => ({
              id: item.offerKey,
              name: item.name,
              description: item.clientBenefit ?? item.internalDescription ?? "",
              monthlyPrice: optionPrice(
                item.offerKey!,
                item.defaultPrice == null ? 0 : Number(item.defaultPrice),
                value,
              ),
              showInProposal: optionSelected(item.offerKey!, value),
              archived: false,
              realEstateSpecific: item.realEstateSpecific,
            })),
        );
  const catalogBonuses = catalog
    .filter((item) => item.defaultInclusion !== "optional" && item.offerKey)
    .map((item) => ({
      id: item.offerKey!,
      name: item.name,
      description: item.clientBenefit ?? item.internalDescription ?? "",
      archived: false,
      realEstateSpecific: item.realEstateSpecific,
      billingCadence: item.billingCadence === "monthly" ? "monthly" : "one-time",
      defaultPackageIds: "defaultPackageKeys" in item && Array.isArray(item.defaultPackageKeys)
        ? item.defaultPackageKeys.filter(
            (key): key is "grow" | "improve" | "maintain" =>
              key === "grow" || key === "improve" || key === "maintain",
          )
        : [],
      offerSection: item.offerSection,
    }));
  const existingBonusIds = new Set(
    [...existingBonuses, ...existingOptions].flatMap((item) =>
      isRecord(item) && typeof item.id === "string" ? [item.id] : [],
    ),
  );
  const newlyCatalogedCoreServices = catalogBonuses.filter(
    (item) => item.offerSection === "core-services" && !existingBonusIds.has(item.id),
  );
  const bonuses = withPublicationApplicability(
    existingBonuses.length > 0 || existingOptions.length > 0
      ? [...existingBonuses, ...newlyCatalogedCoreServices]
      : catalogBonuses,
  );
  const existingBonusPackageSelections = isRecord(value.bonusPackageSelections)
    ? value.bonusPackageSelections
    : {};
  const bonusPackageSelections: JsonRecord = { ...existingBonusPackageSelections };
  for (const item of catalogBonuses) {
    if (
      !Object.prototype.hasOwnProperty.call(bonusPackageSelections, item.id) &&
      item.defaultPackageIds.length > 0
    ) {
      bonusPackageSelections[item.id] = item.defaultPackageIds;
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
