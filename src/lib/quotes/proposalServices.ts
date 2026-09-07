import { extraIsRealEstateSpecific } from "./catalog";

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
};
export function proposalServiceAddOns(
  assessmentValue: unknown,
): ProposalServiceAddOn[] {
  const assessment = record(assessmentValue);
  const selections = record(assessment.bonusPackageSelections);
  const result = new Map<string, ProposalServiceAddOn>();
  const append = (
    item: RecordValue,
    price: unknown,
    packages: ServiceTier[],
    fallbackCadence: "monthly" | "one-time",
  ) => {
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
    });
  };
  for (const option of records(assessment.additionalOptions)) {
    if (option.showInProposal !== true) continue;
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
