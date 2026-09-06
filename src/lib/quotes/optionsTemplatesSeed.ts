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
  packages?: OptionsTemplatePackageId[];
  leadName?: string;
  leadDescription?: string;
  monthlyPrice?: number;
};

type BonusConfig = {
  offerKey: string;
  packages: OptionsTemplatePackageId[];
  leadName?: string;
  leadDescription?: string;
  billingCadence?: "monthly" | "one-time";
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

const CLIENT_READY_ESSENTIAL_TEMPLATE: TemplateConfig = {
  name: "Client-ready review — Essential bookkeeping",
  description:
    "A low-friction package ladder focused on reliable monthly books, clearer reporting, and realistic support promises. Paid add-ons stay hidden unless staff recommends them.",
  optionals: [
    {
      offerKey: "advanced-receipt-management",
      showInProposal: false,
      packages: ALL_PACKAGES,
      leadName: "Receipt Capture & Matching",
      leadDescription:
        "We help collect receipts, match them to transactions, and keep supporting documents attached to the books.",
    },
  ],
  bonuses: [
    {
      offerKey: "monthly-bookkeeping",
      packages: ALL_PACKAGES,
      leadDescription:
        "We categorize transactions, reconcile accounts, complete the monthly close, and deliver a clear Balance Sheet and Profit & Loss statement.",
      billingCadence: "monthly",
    },
    {
      offerKey: "standard-client-support",
      packages: ["maintain"],
      leadDescription:
        "Bookkeeping questions are answered within 1–2 business days during normal business hours.",
      billingCadence: "monthly",
    },
    {
      offerKey: "monthly-reporting-package",
      packages: HIGHER_PACKAGES,
      leadName: "Monthly Performance Reporting",
      leadDescription:
        "Receive monthly reports with clear comparisons and highlights so you can spot changes and act sooner.",
      billingCadence: "monthly",
    },
    {
      offerKey: "priority-client-support",
      packages: ["improve"],
      leadDescription:
        "Bookkeeping questions receive same-business-day attention during normal business hours.",
      billingCadence: "monthly",
    },
    {
      offerKey: "concierge-client-support",
      packages: GROW_ONLY,
      leadDescription:
        "Receive priority access, proactive follow-up, and coordinated support for time-sensitive bookkeeping needs during business hours.",
      billingCadence: "monthly",
    },
    {
      offerKey: "monthly-advisory-calls",
      packages: GROW_ONLY,
      leadName: "Monthly Financial Review",
      leadDescription:
        "Meet with us each month to review results, answer questions, and agree on the next financial priorities.",
      billingCadence: "monthly",
    },
    {
      offerKey: "document-organization",
      packages: ALL_PACKAGES,
      leadName: "Audit-Ready Document System",
      leadDescription:
        "Use one organized process for sending records, resolving missing items, and keeping supporting documents connected to the books.",
    },
    {
      offerKey: "quarterly-review",
      packages: HIGHER_PACKAGES,
      leadDescription:
        "After the first full quarter, we meet to review the reports, answer questions, and identify the next priorities.",
    },
    {
      offerKey: "doublehq-client-portal",
      packages: ALL_PACKAGES,
      leadName: "Secure Client Portal",
      leadDescription:
        "Use one secure place to send files, answer requests, communicate with our team, and follow the work in progress.",
    },
  ],
};

const CLIENT_READY_VISIBILITY_TEMPLATE: TemplateConfig = {
  name: "Client-ready review — Visibility & control",
  description:
    "A reporting-led package ladder with two focused add-ons for clients who need project profitability or active budget management.",
  optionals: [
    {
      offerKey: "project-tracking",
      showInProposal: true,
      packages: HIGHER_PACKAGES,
      leadName: "Project Profitability Tracking",
      leadDescription:
        "Track income, direct costs, and profitability by project so you can see which work is producing the best results.",
    },
    {
      offerKey: "budget-reporting",
      showInProposal: true,
      packages: HIGHER_PACKAGES,
      leadName: "Budget & Monthly Variance Review",
      leadDescription:
        "We build your operating budget and show where actual results are ahead of or behind plan each month.",
    },
    {
      offerKey: "advanced-receipt-management",
      showInProposal: false,
      packages: ALL_PACKAGES,
      leadName: "Receipt Capture & Matching",
      leadDescription:
        "We help collect receipts, match them to transactions, and keep supporting documents attached to the books.",
    },
  ],
  bonuses: [
    ...CLIENT_READY_ESSENTIAL_TEMPLATE.bonuses,
    {
      offerKey: "investor-reporting-kpi-review",
      packages: GROW_ONLY,
      leadName: "Owner & Investor KPI Scorecard",
      leadDescription:
        "Receive a concise scorecard showing the financial and operating measures that matter most to owners and investors.",
      billingCadence: "monthly",
    },
    {
      offerKey: "cash-flow-analysis",
      packages: GROW_ONLY,
      leadName: "Cash Flow Review",
      leadDescription:
        "See where cash is coming from, where it is going, and which near-term risks or opportunities deserve attention.",
      billingCadence: "monthly",
    },
  ],
};

const CLIENT_READY_REAL_ESTATE_TEMPLATE: TemplateConfig = {
  name: "Client-ready review — Real estate portfolio",
  description:
    "A real-estate-focused package ladder that makes property reporting and portfolio insight easy for a prospect to understand.",
  optionals: [
    {
      offerKey: "advanced-receipt-management",
      showInProposal: true,
      packages: ALL_PACKAGES,
      leadName: "Receipt Capture & Property Matching",
      leadDescription:
        "We collect and match receipts to transactions and, when the records support it, connect costs to the correct property.",
    },
    {
      offerKey: "budget-reporting",
      showInProposal: true,
      packages: HIGHER_PACKAGES,
      leadName: "Portfolio Budget & Variance Review",
      leadDescription:
        "We build a portfolio budget and show where actual income and spending differ from plan each month.",
    },
  ],
  bonuses: [
    ...CLIENT_READY_ESSENTIAL_TEMPLATE.bonuses,
    {
      offerKey: "property-reporting-setup",
      packages: ALL_PACKAGES,
      leadName: "Property-Level Reporting Setup",
      leadDescription:
        "We organize the books so income and expenses can be reviewed by property, using the records and platform available.",
    },
    {
      offerKey: "per-property-class-tracking",
      packages: HIGHER_PACKAGES,
      leadName: "Ongoing Property-Level Tracking",
      leadDescription:
        "We maintain property assignments each month so you can compare performance across the portfolio.",
      billingCadence: "monthly",
    },
    {
      offerKey: "investor-reporting-kpi-review",
      packages: GROW_ONLY,
      leadName: "Portfolio KPI Scorecard",
      leadDescription:
        "Receive a concise owner-and-investor scorecard focused on portfolio performance and the measures selected for your business.",
      billingCadence: "monthly",
    },
    {
      offerKey: "stessa-migration",
      packages: GROW_ONLY,
      leadName: "QuickBooks-to-Stessa Migration",
      leadDescription:
        "When Stessa is selected for ongoing bookkeeping, we move the agreed bookkeeping data and establish the new monthly workflow.",
    },
  ],
};

const CLIENT_READY_COMPLIANCE_TEMPLATE: TemplateConfig = {
  name: "Client-ready review — Compliance & coordination",
  description:
    "A focused template for clients with sales-tax, documentation, and tax-preparer coordination needs. Registered-agent service is intentionally excluded.",
  optionals: [
    {
      offerKey: "sales-tax-filing",
      showInProposal: true,
      packages: ALL_PACKAGES,
      leadName: "Sales Tax Filing & Remittance",
      leadDescription:
        "We prepare and file the agreed sales-tax returns and coordinate remittance using the registrations and information you provide. Additional jurisdictions or notices require separate approval.",
    },
    {
      offerKey: "advanced-receipt-management",
      showInProposal: true,
      packages: ALL_PACKAGES,
      leadName: "Receipt Capture & Matching",
      leadDescription:
        "We help collect receipts, match them to transactions, and keep supporting documents attached to the books.",
    },
  ],
  bonuses: [
    ...CLIENT_READY_ESSENTIAL_TEMPLATE.bonuses,
    {
      offerKey: "tax-preparer-coordination",
      packages: HIGHER_PACKAGES,
      leadName: "Tax-Ready Handoff & CPA Coordination",
      leadDescription:
        "We provide organized year-end bookkeeping records and coordinate reasonable bookkeeping questions with your tax preparer.",
      billingCadence: "one-time",
    },
  ],
};

const STARTER_TEMPLATES: TemplateConfig[] = [
  BASIC_TEMPLATE,
  REAL_ESTATE_TEMPLATE,
  ALL_ADDONS_TEMPLATE,
  CLIENT_READY_ESSENTIAL_TEMPLATE,
  CLIENT_READY_VISIBILITY_TEMPLATE,
  CLIENT_READY_REAL_ESTATE_TEMPLATE,
  CLIENT_READY_COMPLIANCE_TEMPLATE,
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
      name: option.leadName ?? meta.name,
      description: option.leadDescription ?? meta.description,
      monthlyPrice: option.monthlyPrice ?? meta.defaultPrice,
      showInProposal: option.showInProposal,
      archived: false,
      realEstateSpecific: meta.realEstateSpecific ? true : undefined,
    });
    const packages = option.packages ?? ALL_PACKAGES;
    if (packages.length > 0) {
      bonusPackageSelections[option.offerKey] = [...packages];
    }
    order.push(option.offerKey);
  }

  for (const bonus of config.bonuses) {
    const meta = catalog.get(bonus.offerKey);
    if (!meta) continue;
    bonuses.push({
      id: bonus.offerKey,
      name: bonus.leadName ?? meta.name,
      description: bonus.leadDescription ?? meta.description,
      archived: false,
      realEstateSpecific: meta.realEstateSpecific ? true : undefined,
      billingCadence: bonus.billingCadence ?? meta.billingCadence,
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
  if (input.slice.additionalOptions.length === 0 && input.slice.bonuses.length === 0) {
    return null;
  }
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
    if (config.isDefault && !basicTemplate && created) basicTemplate = created;
  }

  return basicTemplate ?? { id: "" };
}
