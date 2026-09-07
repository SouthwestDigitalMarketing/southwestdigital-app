import type {
  AssessmentState,
  ProposalAdditionalOption,
  ProposalBonus,
} from "./ProposalCreationWorkspaceDemo";
import {
  includedServicePackages,
  servicePackageIds,
  SERVICE_TIERS,
} from "@/lib/quotes/proposalServices";
import type { PackageId } from "./proposalPackageNames";

export type ServiceRow = {
  id: string;
  option?: ProposalAdditionalOption;
  bonus?: ProposalBonus;
};
export type ServiceConfiguration = {
  included: PackageId[];
  optional: PackageId[];
  cadence: "monthly" | "one-time";
  price: number;
  visible: boolean;
};
type ServiceAssessment = Pick<
  AssessmentState,
  | "additionalOptions"
  | "bonuses"
  | "bonusPackageSelections"
  | "servicesInitialized"
>;

export function readServiceConfiguration(
  assessment: ServiceAssessment,
  row: ServiceRow,
): ServiceConfiguration {
  const item = row.option ?? row.bonus!;
  const included = row.bonus
    ? includedServicePackages(assessment, row.bonus)
    : [];
  return {
    included,
    optional: servicePackageIds(
      row.option
        ? (row.option.packageIds ??
            assessment.bonusPackageSelections[row.id] ??
            SERVICE_TIERS)
        : row.bonus?.addOnPackageIds,
    ).filter((id) => !included.includes(id)),
    cadence: item.billingCadence ?? (row.option ? "monthly" : "one-time"),
    price: row.option?.monthlyPrice ?? row.bonus?.addOnPrice ?? 0,
    visible: !item.archived && row.option?.showInProposal !== false,
  };
}

// Apply the complete edit atomically. Reading or opening the editor never converts a row.
export function applyServiceConfiguration<T extends ServiceAssessment>(
  assessment: T,
  id: string,
  config: ServiceConfiguration,
): T {
  if (!Number.isFinite(config.price) || config.price < 0)
    throw new Error("Enter a valid nonnegative add-on price.");
  const option = assessment.additionalOptions.find((item) => item.id === id);
  const bonus = assessment.bonuses.find((item) => item.id === id);
  const item = option ?? bonus;
  if (!item) return assessment;
  const included = servicePackageIds(config.included);
  const optional = servicePackageIds(config.optional).filter(
    (tier) => !included.includes(tier),
  );
  const shared = {
    id,
    name: item.name,
    description: item.description,
    realEstateSpecific: item.realEstateSpecific,
    applicable: item.applicable,
    applicabilityReason: item.applicabilityReason,
    billingCadence: config.cadence,
  };
  // Keep existing included rows in their historical representation even when unassigned.
  const asBonus = Boolean(bonus) || included.length > 0;
  const nextBonus: ProposalBonus = {
    ...shared,
    archived: !config.visible,
    defaultPackageIds: included,
    addOnPrice: config.price,
    addOnPackageIds: optional,
  };
  return {
    ...assessment,
    servicesInitialized: true,
    additionalOptions: asBonus
      ? assessment.additionalOptions.filter((entry) => entry.id !== id)
      : assessment.additionalOptions.map((entry) =>
          entry.id === id
            ? {
                ...shared,
                archived: false,
                showInProposal: config.visible,
                monthlyPrice: config.price,
                packageIds: optional,
              }
            : entry,
        ),
    bonuses: asBonus
      ? bonus
        ? assessment.bonuses.map((entry) => entry.id === id ? nextBonus : entry)
        : [...assessment.bonuses, nextBonus]
      : assessment.bonuses,
    bonusPackageSelections: {
      ...assessment.bonusPackageSelections,
      [id]: asBonus ? included : optional,
    },
  };
}
