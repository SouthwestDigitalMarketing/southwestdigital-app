import "server-only";

import { prisma } from "@/lib/prisma";
import { getSchemaCapabilities } from "@/lib/database/schemaCapabilities";
import {
  proposalCatalogItemApplicability,
  tagMarksRealEstate,
} from "@/lib/quotes/catalog";
import { buildOptionsTemplateSnapshot } from "./optionsTemplates";
import { reconcileProposalAssessmentWithCatalog } from "@/app/(app)/offers/builder/proposalCatalogSync";
import { servicePackageIds } from "./proposalServices";
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

export async function materializeProposalCatalog(
  brandId: string,
  value: unknown,
  { freezeApplicability = false }: { freezeApplicability?: boolean } = {},
) {
  if (!isRecord(value)) return value;
  const { proposalCatalog, proposalPackageDefaults, catalogProductKind } =
    await getSchemaCapabilities();
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
      tags: {
        where: { tag: { isActive: true } },
        select: { tag: { select: { key: true, label: true } } },
      },
    },
  });
  const applicabilityById = new Map(
    catalog.flatMap((item) => {
      const effectiveOfferKey =
        item.offerKey ?? slugifyTagKey(item.code ?? item.name);
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
          realEstateSpecific:
            item.realEstateSpecific ||
            item.tags.some(({ tag }) => tagMarksRealEstate(tag)),
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

  // Use the same pure reconciliation as the editor so changing treatment cannot
  // disappear on save when the catalog has a different default treatment.
  const slice = buildOptionsTemplateSnapshot({
    additionalOptions: Array.isArray(value.additionalOptions)
      ? value.additionalOptions
      : [],
    bonuses: Array.isArray(value.bonuses) ? value.bonuses : [],
    bonusPackageSelections: isRecord(value.bonusPackageSelections)
      ? value.bonusPackageSelections
      : {},
    optionsCatalogOrder: Array.isArray(value.optionsCatalogOrder)
      ? value.optionsCatalogOrder
      : [],
  } as Parameters<typeof buildOptionsTemplateSnapshot>[0]);
  const synced = reconcileProposalAssessmentWithCatalog(
    {
      ...slice,
      servicesInitialized: value.servicesInitialized === true,
      transactionBand:
        typeof value.transactionBand === "string" ? value.transactionBand : "",
      advancedReceiptManagementPriceOverride: numericValue(
        value,
        "advancedReceiptManagementPriceOverride",
      ),
      projectTrackingPriceOverride: numericValue(
        value,
        "projectTrackingPriceOverride",
      ),
      budgetReportingPriceOverride: numericValue(
        value,
        "budgetReportingPriceOverride",
      ),
      salesTaxFilingPriceOverride: numericValue(
        value,
        "salesTaxFilingPriceOverride",
      ),
      offerAdvancedReceiptManagement: booleanValue(
        value,
        "offerAdvancedReceiptManagement",
      ),
      offerProjectTracking: booleanValue(value, "offerProjectTracking"),
      offerBudgetReporting: booleanValue(value, "offerBudgetReporting"),
      offerSalesTaxFiling: booleanValue(value, "offerSalesTaxFiling"),
      includeTaxPreparerCoordinationCall: booleanValue(
        value,
        "includeTaxPreparerCoordinationCall",
      ),
      includeRegisteredAgentService: booleanValue(
        value,
        "includeRegisteredAgentService",
      ),
    },
    catalog.map((item) => ({
      id: item.offerKey ?? slugifyTagKey(item.code ?? item.name),
      offerKey: item.offerKey ?? slugifyTagKey(item.code ?? item.name),
      name: item.name,
      code: item.code,
      description: item.clientBenefit ?? item.internalDescription ?? "",
      defaultInclusion:
        item.defaultInclusion === "optional"
          ? ("optional" as const)
          : ("included" as const),
      offerSection: item.offerSection,
      defaultPackageIds: servicePackageIds(
        "defaultPackageKeys" in item ? item.defaultPackageKeys : null,
      ),
      defaultPrice: item.defaultPrice == null ? 0 : Number(item.defaultPrice),
      billingCadence: item.billingCadence,
      requiresPlatformMigration: item.requiresPlatformMigration,
      requiredTargetPlatform: item.requiredTargetPlatform,
      applicabilityNote: item.applicabilityNote,
      realEstateSpecific:
        item.realEstateSpecific ||
        item.tags.some(({ tag }) => tagMarksRealEstate(tag)),
    })),
  );
  return {
    ...value,
    ...synced,
    additionalOptions: withPublicationApplicability(synced.additionalOptions),
    bonuses: withPublicationApplicability(synced.bonuses),
  };
}
