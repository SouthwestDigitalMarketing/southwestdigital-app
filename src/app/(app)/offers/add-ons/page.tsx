import { Suspense } from "react";
import { prisma } from "@/lib/prisma";
import { getSchemaCapabilities } from "@/lib/database/schemaCapabilities";
import { requireQuoteStaff } from "@/lib/quotes/access";
import { tagMarksRealEstate, type ProposalOptionCatalogItem } from "@/lib/quotes/catalog";
import ProposalAddOnsDemo from "../builder/ProposalAddOnsDemo";

export default async function QuotesAddOnsPage() {
  const { brand } = await requireQuoteStaff();
  const { proposalCatalog } = await getSchemaCapabilities();
  const services = proposalCatalog ? await prisma.catalogService.findMany({
    where: { brandId: brand.id, active: true, offerSection: "options", offerKey: { not: null } },
    orderBy: [{ priority: "asc" }, { name: "asc" }],
    select: {
      id: true,
      name: true,
      code: true,
      realEstateSpecific: true,
      offerKey: true,
      clientBenefit: true,
      internalDescription: true,
      defaultInclusion: true,
      defaultPrice: true,
      billingCadence: true,
      requiresPlatformMigration: true,
      requiredTargetPlatform: true,
      applicabilityNote: true,
      tags: {
        where: { tag: { isActive: true } },
        select: { tag: { select: { key: true, label: true } } },
      },
    },
  }) : [];
  const catalog = services.flatMap<ProposalOptionCatalogItem>((service) => {
    if (!service.offerKey) return [];
    return [{
      id: service.id,
      offerKey: service.offerKey,
      name: service.name,
      code: service.code,
      description: service.clientBenefit ?? service.internalDescription ?? "",
      defaultInclusion: service.defaultInclusion === "optional" ? "optional" : "included",
      defaultPrice: service.defaultPrice == null ? 0 : Number(service.defaultPrice),
      billingCadence: service.billingCadence,
      requiresPlatformMigration: service.requiresPlatformMigration,
      requiredTargetPlatform: service.requiredTargetPlatform,
      applicabilityNote: service.applicabilityNote,
      realEstateSpecific:
        service.realEstateSpecific || service.tags.some(({ tag }) => tagMarksRealEstate(tag)),
    }];
  });
  return (
    <Suspense fallback={<div className="p-8 text-sm text-slate-400">Loading pricing generator…</div>}>
      <ProposalAddOnsDemo catalog={catalog} />
    </Suspense>
  );
}
