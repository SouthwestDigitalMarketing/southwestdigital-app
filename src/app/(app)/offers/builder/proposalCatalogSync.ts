import type { ProposalOptionCatalogItem } from "@/lib/quotes/catalog";
import { type PackageId } from "./proposalPackageNames";
import { normalizeTierPackageIds } from "./proposalTierRanges";

export type SyncedProposalAdditionalOption = {
  id: string;
  name: string;
  description: string;
  monthlyPrice: number;
  showInProposal: boolean;
  archived: boolean;
  billingCadence?: "monthly" | "one-time";
  packageIds?: PackageId[];
  realEstateSpecific?: boolean;
  applicable?: boolean;
  applicabilityReason?: string;
};

export type SyncedProposalBonus = {
  id: string;
  name: string;
  description: string;
  archived: boolean;
  realEstateSpecific?: boolean;
  billingCadence?: "monthly" | "one-time";
  defaultPackageIds?: PackageId[];
  addOnPrice?: number;
  addOnPackageIds?: PackageId[];
  applicable?: boolean;
  applicabilityReason?: string;
};

export type ProposalCatalogSyncAssessment = {
  servicesInitialized?: boolean;
  transactionBand: string;
  advancedReceiptManagementPriceOverride: number | null;
  projectTrackingPriceOverride: number | null;
  budgetReportingPriceOverride: number | null;
  salesTaxFilingPriceOverride: number | null;
  offerAdvancedReceiptManagement: boolean;
  offerProjectTracking: boolean;
  offerBudgetReporting: boolean;
  offerSalesTaxFiling: boolean;
  includeTaxPreparerCoordinationCall: boolean;
  includeRegisteredAgentService: boolean;
  additionalOptions: SyncedProposalAdditionalOption[];
  bonuses: SyncedProposalBonus[];
  bonusPackageSelections: Record<string, PackageId[]>;
  optionsCatalogOrder: string[];
};

export type ProposalCatalogAssessmentSlice = Pick<
  ProposalCatalogSyncAssessment,
  "additionalOptions" | "bonuses" | "bonusPackageSelections" | "optionsCatalogOrder" | "servicesInitialized"
>;

const RECEIPT_MANAGEMENT_MINIMUMS: Record<string, number> = {
  "": 180,
  "0-99": 99,
  "100-499": 499,
  "500-999": 999,
  "1000+": 1000,
  unknown: 180,
};

export function proposalCatalogOptionPrice(
  item: ProposalOptionCatalogItem,
  assessment: ProposalCatalogSyncAssessment,
) {
  if (item.offerKey === "advanced-receipt-management") {
    const minimum = RECEIPT_MANAGEMENT_MINIMUMS[assessment.transactionBand] ?? item.defaultPrice;
    return assessment.advancedReceiptManagementPriceOverride == null
      ? minimum
      : Math.max(minimum, assessment.advancedReceiptManagementPriceOverride);
  }
  if (item.offerKey === "project-tracking") {
    return assessment.projectTrackingPriceOverride ?? 150;
  }
  if (item.offerKey === "budget-reporting") {
    return assessment.budgetReportingPriceOverride ?? 150;
  }
  if (item.offerKey === "sales-tax-filing") {
    return assessment.salesTaxFilingPriceOverride ?? 650;
  }
  return item.defaultPrice;
}

export function proposalCatalogOptionSelected(
  item: ProposalOptionCatalogItem,
  assessment: ProposalCatalogSyncAssessment,
) {
  const legacySelections: Record<string, boolean> = {
    "advanced-receipt-management": assessment.offerAdvancedReceiptManagement,
    "project-tracking": assessment.offerProjectTracking,
    "budget-reporting": assessment.offerBudgetReporting,
    "sales-tax-filing": assessment.offerSalesTaxFiling,
    "tax-preparer-coordination": assessment.includeTaxPreparerCoordinationCall,
    "registered-agent-service": assessment.includeRegisteredAgentService,
  };
  return legacySelections[item.offerKey] ?? false;
}

export function reconcileProposalAssessmentWithCatalog(
  assessment: ProposalCatalogSyncAssessment,
  catalogItems: ProposalOptionCatalogItem[],
): ProposalCatalogAssessmentSlice {
  const existingOptions = new Map(assessment.additionalOptions.map((item) => [item.id, item]));
  const existingBonuses = new Map(assessment.bonuses.map((item) => [item.id, item]));
  const hasPersistedOptions = assessment.servicesInitialized === true || assessment.additionalOptions.length > 0
    || assessment.bonuses.length > 0
    || Object.keys(assessment.bonusPackageSelections).length > 0;
  const catalogIds = new Set(catalogItems.map((item) => item.offerKey));
  const additionalOptions: SyncedProposalAdditionalOption[] = [];
  const bonuses: SyncedProposalBonus[] = [];

  for (const catalogItem of catalogItems) {
    const id = catalogItem.offerKey;
    const existingOption = existingOptions.get(id);
    const existingBonus = existingBonuses.get(id);

    if (existingOption) {
      additionalOptions.push({
        ...existingOption,
        name: catalogItem.name,
        description: catalogItem.description,
        archived: existingOption.archived,
        realEstateSpecific: catalogItem.realEstateSpecific,
      });
      continue;
    }

    if (existingBonus) {
      bonuses.push({
        ...existingBonus,
        name: catalogItem.name,
        description: catalogItem.description,
        archived: existingBonus.archived,
        realEstateSpecific: catalogItem.realEstateSpecific,
        billingCadence: existingBonus.billingCadence ?? "one-time",
        defaultPackageIds: existingBonus.defaultPackageIds,
      });
      continue;
    }

    const defaultPackageIds = normalizeTierPackageIds(catalogItem.defaultPackageIds);
    if (!hasPersistedOptions && catalogItem.defaultInclusion === "optional" && defaultPackageIds.length > 0) {
      additionalOptions.push({
        id,
        name: catalogItem.name,
        description: catalogItem.description,
        monthlyPrice: proposalCatalogOptionPrice(catalogItem, assessment),
        showInProposal: true,
        archived: false,
        billingCadence: catalogItem.billingCadence === "monthly" ? "monthly" : "one-time",
        packageIds: defaultPackageIds,
        realEstateSpecific: catalogItem.realEstateSpecific,
      });
      continue;
    }

    if (hasPersistedOptions || catalogItem.defaultInclusion !== "included" || defaultPackageIds.length === 0) {
      continue;
    }

    bonuses.push({
      id,
      name: catalogItem.name,
      description: catalogItem.description,
      archived: false,
      realEstateSpecific: catalogItem.realEstateSpecific,
      billingCadence: catalogItem.billingCadence === "monthly" ? "monthly" : "one-time",
      defaultPackageIds,

    });
  }

  const bonusPackageSelections = Object.fromEntries(
    Object.entries(assessment.bonusPackageSelections).filter(([id]) => catalogIds.has(id)),
  );
  for (const bonus of bonuses) {
    if (
      !hasPersistedOptions && !Object.prototype.hasOwnProperty.call(bonusPackageSelections, bonus.id)
      && bonus.defaultPackageIds?.length
    ) {
      bonusPackageSelections[bonus.id] = normalizeTierPackageIds(bonus.defaultPackageIds);
    }
  }

  const knownIds = [...additionalOptions.map((item) => item.id), ...bonuses.map((item) => item.id)];
  const storedOrder = [...new Set(assessment.optionsCatalogOrder.filter((id) => knownIds.includes(id)))];

  return {
    servicesInitialized: true,
    additionalOptions,
    bonuses,
    bonusPackageSelections,
    optionsCatalogOrder: [
      ...storedOrder,
      ...knownIds.filter((id) => !storedOrder.includes(id)),
    ],
  };
}
