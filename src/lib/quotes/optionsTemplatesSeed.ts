import "server-only";

import { prisma } from "@/lib/prisma";
import { getSchemaCapabilities } from "@/lib/database/schemaCapabilities";
import {
  buildOptionsTemplateSnapshot,
  type OptionsTemplateAssessmentSlice,
  type OptionsTemplatePackageId,
} from "@/lib/quotes/optionsTemplates";

const ALL_PACKAGES: OptionsTemplatePackageId[] = ["grow", "improve", "maintain"];
const HIGHER_PACKAGES: OptionsTemplatePackageId[] = ["grow", "improve"];
const GROW_ONLY: OptionsTemplatePackageId[] = ["grow"];

type OptionalConfig = {
  offerKey: string;
  showInProposal: boolean;
};

type BonusConfig = {
  offerKey: string;
  packages: OptionsTemplatePackageId[];
};

type TemplateConfig = {
  name: string;
  description: string;
  optionals: OptionalConfig[];
  bonuses: BonusConfig[];
  isDefault?: boolean;
};

// A curated, minimal set of items that reflects what a typical bookkeeping
// proposal actually shows a client. Excludes noisy or specialized services
// (project tracking, budget reporting, sales tax, registered agent, etc.)
// so staff can add them per-client instead of every proposal.
const BASIC_TEMPLATE: TemplateConfig = {
  name: "Basic bookkeeping services",
  description:
    "A curated starter: two optional add-ons and three included bonuses. Add real-estate items via the Real-estate template if needed.",
  isDefault: true,
  optionals: [
    { offerKey: "advanced-receipt-management", showInProposal: false },
    { offerKey: "tax-preparer-coordination", showInProposal: false },
  ],
  bonuses: [
    { offerKey: "document-organization", packages: ALL_PACKAGES },
    { offerKey: "quarterly-review", packages: HIGHER_PACKAGES },
    { offerKey: "doublehq-client-portal", packages: ALL_PACKAGES },
  ],
};

const REAL_ESTATE_TEMPLATE: TemplateConfig = {
  name: "Real-estate bookkeeping",
  description:
    "Basic template plus real-estate bonuses: property-level reports, RE chart of accounts, per-property class tracking. Stessa migration reserved for Grow.",
  optionals: [
    { offerKey: "advanced-receipt-management", showInProposal: false },
    { offerKey: "tax-preparer-coordination", showInProposal: false },
  ],
  bonuses: [
    { offerKey: "document-organization", packages: ALL_PACKAGES },
    { offerKey: "quarterly-review", packages: HIGHER_PACKAGES },
    { offerKey: "doublehq-client-portal", packages: ALL_PACKAGES },
    { offerKey: "property-reporting-setup", packages: ALL_PACKAGES },
    { offerKey: "real-estate-chart-of-accounts", packages: ALL_PACKAGES },
    { offerKey: "per-property-class-tracking", packages: ALL_PACKAGES },
    { offerKey: "stessa-migration", packages: GROW_ONLY },
  ],
};

const ALL_ADDONS_TEMPLATE: TemplateConfig = {
  name: "Bookkeeping with all add-ons",
  description:
    "Every optional add-on is pre-checked to show in the proposal. Use for clients who want to see the full menu.",
  optionals: [
    { offerKey: "advanced-receipt-management", showInProposal: true },
    { offerKey: "project-tracking", showInProposal: true },
    { offerKey: "budget-reporting", showInProposal: true },
    { offerKey: "sales-tax-filing", showInProposal: true },
    { offerKey: "tax-preparer-coordination", showInProposal: true },
    { offerKey: "registered-agent-service", showInProposal: true },
  ],
  bonuses: [
    { offerKey: "document-organization", packages: ALL_PACKAGES },
    { offerKey: "quarterly-review", packages: HIGHER_PACKAGES },
    { offerKey: "doublehq-client-portal", packages: ALL_PACKAGES },
  ],
};

const STARTER_TEMPLATES: TemplateConfig[] = [
  BASIC_TEMPLATE,
  REAL_ESTATE_TEMPLATE,
  ALL_ADDONS_TEMPLATE,
];

type CatalogLookup = Map<
  string,
  {
    name: string;
    description: string;
    defaultPrice: number;
    billingCadence: "monthly" | "one-time";
    realEstateSpecific: boolean;
  }
>;

async function loadCatalogLookup(brandId: string): Promise<CatalogLookup> {
  const { proposalCatalog } = await getSchemaCapabilities();
  const lookup: CatalogLookup = new Map();
  if (!proposalCatalog) return lookup;
  const services = await prisma.catalogService.findMany({
    where: { brandId, active: true, offerKey: { not: null } },
    select: {
      name: true,
      offerKey: true,
      clientBenefit: true,
      internalDescription: true,
      defaultPrice: true,
      billingCadence: true,
      realEstateSpecific: true,
    },
  });
  for (const service of services) {
    if (!service.offerKey) continue;
    lookup.set(service.offerKey, {
      name: service.name,
      description: service.clientBenefit ?? service.internalDescription ?? "",
      defaultPrice: service.defaultPrice == null ? 0 : Number(service.defaultPrice),
      billingCadence: service.billingCadence === "monthly" ? "monthly" : "one-time",
      realEstateSpecific: service.realEstateSpecific,
    });
  }
  return lookup;
}

function buildSliceFromConfig(
  config: TemplateConfig,
  catalog: CatalogLookup,
): OptionsTemplateAssessmentSlice {
  const additionalOptions: OptionsTemplateAssessmentSlice["additionalOptions"] = [];
  const bonuses: OptionsTemplateAssessmentSlice["bonuses"] = [];
  const bonusPackageSelections: OptionsTemplateAssessmentSlice["bonusPackageSelections"] = {};
  const order: string[] = [];

  for (const option of config.optionals) {
    const meta = catalog.get(option.offerKey);
    if (!meta) continue;
    additionalOptions.push({
      id: option.offerKey,
      name: meta.name,
      description: meta.description,
      monthlyPrice: meta.defaultPrice,
      showInProposal: option.showInProposal,
      archived: false,
      realEstateSpecific: meta.realEstateSpecific ? true : undefined,
    });
    order.push(option.offerKey);
  }

  for (const bonus of config.bonuses) {
    const meta = catalog.get(bonus.offerKey);
    if (!meta) continue;
    bonuses.push({
      id: bonus.offerKey,
      name: meta.name,
      description: meta.description,
      archived: false,
      realEstateSpecific: meta.realEstateSpecific ? true : undefined,
      billingCadence: meta.billingCadence,
      defaultPackageIds: bonus.packages.length > 0 ? [...bonus.packages] : undefined,
    });
    if (bonus.packages.length > 0) {
      bonusPackageSelections[bonus.offerKey] = [...bonus.packages];
    }
    order.push(bonus.offerKey);
  }

  return {
    optionsCatalogOrder: order,
    additionalOptions,
    bonuses,
    bonusPackageSelections,
  };
}

export async function buildDefaultBookkeepingSlice(brandId: string) {
  const catalog = await loadCatalogLookup(brandId);
  return buildSliceFromConfig(BASIC_TEMPLATE, catalog);
}

async function ensureNamedTemplate(input: {
  brandId: string;
  name: string;
  description: string;
  slice: OptionsTemplateAssessmentSlice;
  isDefault?: boolean;
}) {
  const existing = await prisma.proposalOptionsTemplate.findFirst({
    where: { brandId: input.brandId, name: input.name },
    select: { id: true },
  });
  if (existing) return existing;
  const snapshot = buildOptionsTemplateSnapshot(input.slice);
  return prisma.proposalOptionsTemplate.create({
    data: {
      brandId: input.brandId,
      name: input.name,
      description: input.description,
      productKind: "bookkeeping",
      snapshotJson: snapshot as unknown as object,
      defaultForProductKind: input.isDefault ? "bookkeeping" : null,
    },
    select: { id: true },
  });
}

export async function ensureDefaultOptionsTemplate(brandId: string) {
  const catalog = await loadCatalogLookup(brandId);

  const existingDefault = await prisma.proposalOptionsTemplate.findFirst({
    where: {
      brandId,
      archivedAt: null,
      defaultForProductKind: "bookkeeping",
    },
    select: { id: true },
  });

  let basicTemplate = existingDefault;
  for (const config of STARTER_TEMPLATES) {
    const isDefault = config.isDefault === true && !existingDefault;
    const created = await ensureNamedTemplate({
      brandId,
      name: config.name,
      description: config.description,
      slice: buildSliceFromConfig(config, catalog),
      isDefault,
    });
    if (config.isDefault && !basicTemplate) basicTemplate = created;
  }

  return basicTemplate ?? { id: "" };
}
