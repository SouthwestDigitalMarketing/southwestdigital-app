import { extraIsRealEstateSpecific } from "./catalog";
import { findSuppressedFlatMigrationOptions } from "./desktopMigration";
import { serviceLevelDescription, serviceLevelTitle, type StoredSupportCopy } from "./serviceLevels";
import {
  hasCompanyBundle,
  NEW_QUICKBOOKS_FILE_SERVICE_ID,
  normalizeCompanyBundle,
} from "./companyBundle";

// Shared by preview and checkout: eligibility must not depend on browser state.
export const SERVICE_TIERS = ["maintain", "improve", "grow"] as const;
export type ServiceTier = (typeof SERVICE_TIERS)[number];
type RecordValue = Record<string, unknown>;
function record(value: unknown): RecordValue {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as RecordValue)
    : {};
}
function records(value: unknown): RecordValue[] {
  return Array.isArray(value) ? value.map(record) : [];
}
export function servicePackageIds(value: unknown): ServiceTier[] {
  return Array.isArray(value)
    ? SERVICE_TIERS.filter((tier) => value.includes(tier))
    : [];
}
export function includedServicePackages(
  assessmentValue: unknown,
  serviceValue: unknown,
): ServiceTier[] {
  const assessment = record(assessmentValue);
  const service = record(serviceValue);
  const saved = record(assessment.bonusPackageSelections)[String(service.id)];
  if (Array.isArray(saved)) return servicePackageIds(saved);
  if (Array.isArray(service.defaultPackageIds))
    return servicePackageIds(service.defaultPackageIds);
  const legacyKey = (
    {
      "stessa-migration": "includeConditionalStessaMigration",
      "property-reporting-setup": "includePropertyLevelReportingSetup",
      "document-organization": "includeDocumentOrganizationSetup",
      "quarterly-review": "includeQuarterlyFinancialReview",
      "doublehq-client-portal": "includeDoubleHqClientPortal",
      "real-estate-chart-of-accounts": "includeRealEstateChartOfAccounts",
      "new-quickbooks-file": "includeNewQuickBooksFileSetup",
    } as Record<string, string>
  )[String(service.id)];
  return assessment[legacyKey] === true ? [...SERVICE_TIERS] : [];
}
export function serviceIsApplicable(
  assessmentValue: unknown,
  serviceValue: unknown,
): boolean {
  const assessment = record(assessmentValue);
  const service = record(serviceValue);
  if (typeof service.applicable === "boolean") return service.applicable;
  const realEstate =
    assessment.bookSetType === "real-estate-only" ||
    assessment.bookSetType === "mixed-books";
  if (service.id === "stessa-migration")
    return (
      assessment.platformMigrationEnabled === true &&
      assessment.ongoingBookkeepingPlatform === "stessa"
    );
  if (service.id === "new-quickbooks-file")
    return realEstate && assessment.ongoingBookkeepingPlatform === "qbo";
  return (
    !extraIsRealEstateSpecific(
      {
        id: String(service.id),
        name: typeof service.name === "string" ? service.name : "",
        realEstateSpecific:
          typeof service.realEstateSpecific === "boolean"
            ? service.realEstateSpecific
            : undefined,
      },
      [],
    ) || realEstate
  );
}
export type ProposalServiceAddOn = {
  id: string;
  name: string;
  description: string;
  monthlyPrice: number;
  billingCadence: "monthly" | "one-time";
  packageIds: ServiceTier[];
  required?: boolean;
};

export function proposalIncludedServices(assessmentValue: unknown, tier: ServiceTier, copy?: StoredSupportCopy) {
  const assessment = record(assessmentValue);
  return records(assessment.bonuses)
    .filter((item) => item.archived !== true && serviceIsApplicable(assessment, item)
      && includedServicePackages(assessment, item).includes(tier))
    .map((item) => ({
      name: serviceLevelTitle(typeof item.name === "string" ? item.name : String(item.id), copy),
      description: typeof item.description === "string" ? item.description : "",
    }));
}

// The agreement's WHAT'S INCLUDED section (all agreements, staged or not):
// the selected package's included services, with each support level carrying
// the resolved copy's title + meaning — the same data the proposal shows.
// Returns null when the tier includes nothing, so legacy agreements without
// the new data render byte-identical (the caller also gates on the snapshot
// carrying stored support copy).
export function agreementWhatsIncluded(
  assessmentValue: unknown,
  tier: ServiceTier,
  copy?: StoredSupportCopy,
): Array<{ name: string; description: string }> | null {
  const assessment = record(assessmentValue);
  const items = records(assessment.bonuses)
    .filter((item) => item.archived !== true && serviceIsApplicable(assessment, item)
      && includedServicePackages(assessment, item).includes(tier))
    .map((item) => {
      const rawName = typeof item.name === "string" ? item.name : String(item.id);
      const description = typeof item.description === "string" ? item.description : "";
      if (rawName.endsWith("Client Support")) {
        return { name: serviceLevelTitle(rawName, copy), description: serviceLevelDescription(rawName, description, copy) };
      }
      return { name: serviceLevelTitle(rawName, copy), description };
    });
  return items.length > 0 ? items : null;
}
export function proposalServiceAddOns(
  assessmentValue: unknown,
): ProposalServiceAddOn[] {
  const assessment = record(assessmentValue);
  // Spec 02 R2: when the bundle already charges a per-file new-QuickBooks
  // setup, the legacy catalog line for the same work must not charge again.
  const bundleOwnsNewFileSetup =
    hasCompanyBundle({ companies: assessment.companies }) &&
    normalizeCompanyBundle(assessment.companies).some((company) => company.fileStatus === "new_file");
  // Spec 05: when the sized Desktop migration is chosen, the legacy flat
  // migration option never stacks with it. Legacy proposals (no selection)
  // suppress nothing, so the flat $640 charges byte-identical.
  const suppressedFlatMigrationIds = new Set(
    findSuppressedFlatMigrationOptions(
      assessment.additionalOptions,
      record(assessment.desktopMigration),
    ).suppressedIds,
  );
  const selections = record(assessment.bonusPackageSelections);
  const result = new Map<string, ProposalServiceAddOn>();
  const append = (
    item: RecordValue,
    price: unknown,
    packages: ServiceTier[],
    fallbackCadence: "monthly" | "one-time",
  ) => {
    if (bundleOwnsNewFileSetup && item.id === NEW_QUICKBOOKS_FILE_SERVICE_ID) return;
    if (
      typeof item.id !== "string" ||
      item.archived === true ||
      !serviceIsApplicable(assessment, item)
    )
      return;
    if (
      typeof price !== "number" ||
      !Number.isFinite(price) ||
      price < 0 ||
      packages.length === 0
    )
      return;
    result.set(item.id, {
      id: item.id,
      name: typeof item.name === "string" ? item.name : item.id,
      description: typeof item.description === "string" ? item.description : "",
      monthlyPrice: price,
      billingCadence:
        item.billingCadence === "one-time"
          ? "one-time"
          : item.billingCadence === "monthly"
            ? "monthly"
            : fallbackCadence,
      packageIds: packages,
      ...(item.required === true ? { required: true } : {}),
    });
  };
  for (const option of records(assessment.additionalOptions)) {
    if (option.showInProposal !== true) continue;
    if (typeof option.id === "string" && suppressedFlatMigrationIds.has(option.id)) continue;
    append(
      option,
      option.monthlyPrice,
      servicePackageIds(
        option.packageIds ?? selections[String(option.id)] ?? SERVICE_TIERS,
      ),
      "monthly",
    );
  }
  for (const bonus of records(assessment.bonuses)) {
    const included = includedServicePackages(assessment, bonus);
    append(
      bonus,
      bonus.addOnPrice,
      servicePackageIds(bonus.addOnPackageIds).filter(
        (tier) => !included.includes(tier),
      ),
      "one-time",
    );
  }
  return [...result.values()];
}

/**
 * Required one-time add-on lines for one tier, for the agreement fee
 * section. Tier-filtered exactly like checkout (`packageIds.includes(tier)`),
 * so no line appears that isn't charged on that tier. Only explicitly
 * selected ids list — a required option the selection never picked stays a
 * checkout charge, not an agreement line, matching the previous listing rule.
 */
export function requiredOneTimeAddOnsForTier(
  assessmentValue: unknown,
  selectedIds: readonly string[],
  tier: ServiceTier,
): Array<{ name: string; price: number }> {
  const selected = new Set(selectedIds);
  return proposalServiceAddOns(assessmentValue)
    .filter(
      (option) =>
        option.required === true &&
        option.billingCadence === "one-time" &&
        option.packageIds.includes(tier) &&
        selected.has(option.id),
    )
    .map((option) => ({ name: option.name, price: option.monthlyPrice }));
}
