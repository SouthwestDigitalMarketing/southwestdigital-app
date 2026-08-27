import "server-only";

import { prisma } from "@/lib/prisma";
import { computeQuoteLineItems } from "./pricing";
import type {
  BuildQuoteResult,
  PackagePreview,
  QuoteInputs,
  QuoteSnapshot,
  QuoteSnapshotFeature,
  QuoteSnapshotService,
} from "./types";
import type { ProposalCatalogScenario } from "@prisma/client";

function generateSlug(clientName: string): string {
  const clientPart = clientName
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/, "")
    .slice(0, 20);
  const datePart = new Date().toISOString().slice(0, 10);
  const rand = Math.random().toString(36).slice(2, 6);
  return `${clientPart}-${datePart}-${rand}`;
}

const packageInclude = {
  features: { orderBy: { displayOrder: "asc" as const } },
  packageServices: { include: { service: true } },
  pricingRules: { orderBy: { sortOrder: "asc" as const } },
};

export async function previewScenarioQuotes(
  brandId: string,
  scenario: ProposalCatalogScenario,
  inputs: QuoteInputs,
): Promise<PackagePreview[]> {
  const packages = await prisma.proposalPackage.findMany({
    where: { brandId, scenario, isActive: true },
    orderBy: [{ tier: "asc" }, { displayOrder: "asc" }],
    include: packageInclude,
  });

  return packages.map((pkg) => {
    const { lineItems, totals } = computeQuoteLineItems(pkg, inputs);
    return {
      packageId: pkg.id,
      key: pkg.key,
      name: pkg.name,
      summary: pkg.summary,
      scenario: pkg.scenario,
      tier: pkg.tier,
      highlightLabel: pkg.highlightLabel,
      supportLabel: pkg.supportLabel,
      supportStars: pkg.supportStars,
      features: pkg.features.map((feature) => ({
        kind: feature.kind,
        shortLabel: feature.shortLabel,
      })),
      lineItems,
      totals,
    };
  });
}

export async function buildQuote(
  brandId: string,
  clientId: string,
  packageId: string,
  inputs: QuoteInputs,
): Promise<BuildQuoteResult> {
  const [client, pkg] = await Promise.all([
    prisma.quoteClient.findFirst({ where: { id: clientId, brandId } }),
    prisma.proposalPackage.findFirst({
      where: { id: packageId, brandId },
      include: packageInclude,
    }),
  ]);

  if (!client) throw new Error("Client not found");
  if (!pkg) throw new Error("Package not found");

  const { lineItems, totals } = computeQuoteLineItems(pkg, inputs);

  const features: QuoteSnapshotFeature[] = pkg.features.map((feature) => ({
    id: feature.id,
    kind: feature.kind,
    shortLabel: feature.shortLabel,
    longDescription: feature.longDescription ?? null,
    displayOrder: feature.displayOrder,
  }));

  const services: QuoteSnapshotService[] = pkg.packageServices.map((packageService) => ({
    id: packageService.service.id,
    name: packageService.service.name,
    description: packageService.service.internalDescription ?? null,
    category: packageService.service.category,
    inclusionType: packageService.inclusionType as "included" | "optional" | "excluded",
    notes: packageService.notes ?? null,
  }));

  const whyItMatters = Array.isArray(pkg.whyItMatters) ? (pkg.whyItMatters as string[]) : [];

  const snapshot: QuoteSnapshot = {
    version: 1,
    generatedAt: new Date().toISOString(),
    client: {
      id: client.id,
      name: client.name,
      email: client.email,
      company: client.company ?? null,
    },
    package: {
      id: pkg.id,
      key: pkg.key,
      name: pkg.name,
      scenario: pkg.scenario,
      tier: pkg.tier,
      summary: pkg.summary,
      descriptionLong: pkg.descriptionLong ?? null,
      supportLabel: pkg.supportLabel,
      supportIncludes: pkg.supportIncludes,
      supportStars: pkg.supportStars,
      highlightLabel: pkg.highlightLabel ?? null,
      billingType: pkg.billingType,
      whyItMatters,
    },
    services,
    features,
    inputs,
    lineItems,
    totals,
  };

  const slug = generateSlug(client.name);

  const created = await prisma.quote.create({
    data: {
      brandId,
      slug,
      clientId,
      packageId,
      status: "draft",
      totalOneTime: totals.oneTime,
      totalRecurring: totals.recurring,
      onboardingFee: totals.onboardingFee,
      snapshotJson: snapshot as object,
      lineItems: {
        create: lineItems.map((item, index) => ({
          label: item.label,
          description: item.description ?? null,
          amount: item.amount,
          billingType: item.billingType,
          sortOrder: index * 10,
        })),
      },
    },
  });

  return { quoteId: created.id, slug, totals, lineItems };
}
