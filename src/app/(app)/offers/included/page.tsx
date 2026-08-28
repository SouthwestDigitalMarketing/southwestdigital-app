import { Suspense } from "react";
import { prisma } from "@/lib/prisma";
import { requireQuoteStaff } from "@/lib/quotes/access";
import ProposalCreationWorkspaceDemo from "../builder/ProposalCreationWorkspaceDemo";
import type { IncludedCatalogService } from "../builder/IncludedServicesBuilder";

const FALLBACK_CATALOG_SERVICES: IncludedCatalogService[] = [
  {
    id: "fallback-monthly-bookkeeping",
    code: "MBK-100",
    name: "Monthly Bookkeeping",
    category: "monthly bookkeeping",
    serviceType: "bookkeeping",
    cardLabel: "Core monthly bookkeeping",
    clientBenefit: "Keeps the books current and supports a reliable monthly close.",
    defaultInclusion: "included",
    priority: 100,
  },
  {
    id: "fallback-reconciliations",
    code: "REC-200",
    name: "Account Reconciliations",
    category: "reconciliation",
    serviceType: "bookkeeping",
    cardLabel: "Bank, card, and loan reconciliations",
    clientBenefit: "Matches accounts to source statements and resolves discrepancies.",
    defaultInclusion: "included",
    priority: 200,
  },
  {
    id: "fallback-reporting",
    code: "RPT-300",
    name: "Monthly Financial Reporting",
    category: "reporting",
    serviceType: "reporting",
    cardLabel: "Monthly financial statements",
    clientBenefit: "Provides clean monthly reports owners can actually use.",
    defaultInclusion: "included",
    priority: 300,
  },
];

export default async function QuotesIncludedPage() {
  const { brand } = await requireQuoteStaff();

  let catalogServices = FALLBACK_CATALOG_SERVICES;
  try {
    const services = await prisma.catalogService.findMany({
      where: { brandId: brand.id, active: true },
      orderBy: [{ priority: "asc" }, { category: "asc" }, { name: "asc" }],
      select: {
        id: true,
        code: true,
        name: true,
        category: true,
        service: true,
        cardLabel: true,
        clientBenefit: true,
        defaultInclusion: true,
        priority: true,
        realEstateSpecific: true,
      },
    });
    if (services.length) {
      catalogServices = services.map((service) => ({
        id: service.id,
        code: service.code ?? service.id.slice(-6).toUpperCase(),
        name: service.name,
        category: service.category,
        serviceType: service.service,
        cardLabel: service.cardLabel ?? "",
        clientBenefit: service.clientBenefit ?? "",
        defaultInclusion: service.defaultInclusion ?? "",
        priority: service.priority,
        realEstateSpecific: service.realEstateSpecific,
      }));
    }
  } catch {
    catalogServices = FALLBACK_CATALOG_SERVICES;
  }

  return (
    <Suspense fallback={<div className="p-8 text-sm text-slate-400">Loading pricing generator…</div>}>
      <ProposalCreationWorkspaceDemo step="included" catalogServices={catalogServices} />
    </Suspense>
  );
}
