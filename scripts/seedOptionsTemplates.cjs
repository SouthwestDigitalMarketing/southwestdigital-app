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
];

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
      name: meta.name,
      description: meta.description,
      monthlyPrice: meta.defaultPrice,
      showInProposal: option.showInProposal,
      archived: false,
      ...(meta.realEstateSpecific ? { realEstateSpecific: true } : {}),
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
      ...(meta.realEstateSpecific ? { realEstateSpecific: true } : {}),
      billingCadence: meta.billingCadence,
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
