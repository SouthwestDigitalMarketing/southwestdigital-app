// Idempotently seed the three curated options templates for every active brand.
// Safe to re-run; skips templates that already exist by name.

const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();

const ALL_PACKAGES = ["grow", "improve", "maintain"];
const HIGHER_PACKAGES = ["grow", "improve"];
const GROW_ONLY = ["grow"];

const STARTER_TEMPLATES = [
  {
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
  },
  {
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
  },
  {
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
  },
  {
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
        leadName: "Monthly QuickBooks Bookkeeping",
        leadDescription:
          "Recurring categorization and reconciliation for the QuickBooks accounts included in your plan, using the information and access available to us.",
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
        leadName: "Bookkeeping Document Organization",
        leadDescription:
          "We organize the documents you provide as part of the bookkeeping process.",
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
  },
  {
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
    bonuses: [],
    extendBonusesFrom: "essential",
  },
  {
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
    bonuses: [],
    extendBonusesFrom: "essential-real-estate",
  },
  {
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
    bonuses: [],
    extendBonusesFrom: "essential-compliance",
  },
];

const essentialTemplate = STARTER_TEMPLATES.find(
  (template) => template.name === "Client-ready review — Essential bookkeeping",
);
const essentialBonuses = essentialTemplate ? essentialTemplate.bonuses : [];
for (const template of STARTER_TEMPLATES) {
  if (template.extendBonusesFrom === "essential") {
    template.bonuses = [
      ...essentialBonuses,
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
    ];
  }
  if (template.extendBonusesFrom === "essential-real-estate") {
    template.bonuses = [
      ...essentialBonuses,
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
    ];
  }
  if (template.extendBonusesFrom === "essential-compliance") {
    template.bonuses = [
      ...essentialBonuses,
      {
        offerKey: "tax-preparer-coordination",
        packages: HIGHER_PACKAGES,
        leadName: "Tax-Ready Handoff & CPA Coordination",
        leadDescription:
          "We provide organized year-end bookkeeping records and coordinate reasonable bookkeeping questions with your tax preparer.",
        billingCadence: "one-time",
      },
    ];
  }
}

async function loadCatalogLookup(brandId) {
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
  const lookup = new Map();
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

function buildSnapshot(config, catalog) {
  const additionalOptions = [];
  const bonuses = [];
  const bonusPackageSelections = {};
  const order = [];

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
      ...(meta.realEstateSpecific ? { realEstateSpecific: true } : {}),
    });
    const optionPackages = option.packages ?? ALL_PACKAGES;
    if (optionPackages.length > 0) {
      bonusPackageSelections[option.offerKey] = [...optionPackages];
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
      ...(meta.realEstateSpecific ? { realEstateSpecific: true } : {}),
      billingCadence: bonus.billingCadence ?? meta.billingCadence,
      ...(bonus.packages.length > 0 ? { defaultPackageIds: [...bonus.packages] } : {}),
    });
    if (bonus.packages.length > 0) {
      bonusPackageSelections[bonus.offerKey] = [...bonus.packages];
    }
    order.push(bonus.offerKey);
  }

  return {
    version: 1,
    productKind: "bookkeeping",
    optionsCatalogOrder: order,
    additionalOptions,
    bonuses,
    bonusPackageSelections,
  };
}

async function main() {
  const brands = await prisma.brand.findMany({
    where: { status: "ACTIVE" },
    select: { id: true, slug: true },
  });
  console.log(`Seeding ${brands.length} brands...`);

  for (const brand of brands) {
    const catalog = await loadCatalogLookup(brand.id);
    const existingDefault = await prisma.proposalOptionsTemplate.findFirst({
      where: {
        brandId: brand.id,
        archivedAt: null,
        defaultForProductKind: "bookkeeping",
      },
      select: { id: true },
    });

    for (const config of STARTER_TEMPLATES) {
      const existing = await prisma.proposalOptionsTemplate.findFirst({
        where: { brandId: brand.id, name: config.name },
        select: { id: true },
      });
      if (existing) continue;
      const snapshot = buildSnapshot(config, catalog);
      if (snapshot.additionalOptions.length === 0 && snapshot.bonuses.length === 0) {
        console.log(`  ${brand.slug}: skipped empty ${config.name}`);
        continue;
      }
      await prisma.proposalOptionsTemplate.create({
        data: {
          brandId: brand.id,
          name: config.name,
          description: config.description,
          productKind: "bookkeeping",
          snapshotJson: snapshot,
          defaultForProductKind:
            config.isDefault && !existingDefault ? "bookkeeping" : null,
        },
      });
    }

    const rows = await prisma.proposalOptionsTemplate.findMany({
      where: { brandId: brand.id },
      select: { name: true, defaultForProductKind: true },
    });
    console.log(
      `  ${brand.slug}: ${rows
        .map((r) => (r.defaultForProductKind ? `${r.name} (default)` : r.name))
        .join(" | ")}`,
    );
  }

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  prisma.$disconnect();
  process.exit(1);
});
