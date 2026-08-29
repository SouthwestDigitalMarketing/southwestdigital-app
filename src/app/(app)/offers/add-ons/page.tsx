import { Suspense } from "react";
import { prisma } from "@/lib/prisma";
import { requireQuoteStaff } from "@/lib/quotes/access";
import { tagMarksRealEstate } from "@/lib/quotes/catalog";
import ProposalAddOnsDemo from "../builder/ProposalAddOnsDemo";

export default async function QuotesAddOnsPage() {
  const { brand } = await requireQuoteStaff();
  const services = await prisma.catalogService.findMany({
    where: { brandId: brand.id, active: true },
    select: {
      id: true,
      name: true,
      code: true,
      realEstateSpecific: true,
      tags: { select: { tag: { select: { key: true, label: true } } } },
    },
  });
  const catalog = services.map((service) => ({
    id: service.id,
    name: service.name,
    code: service.code,
    realEstateSpecific:
      service.realEstateSpecific || service.tags.some(({ tag }) => tagMarksRealEstate(tag)),
  }));
  return (
    <Suspense fallback={<div className="p-8 text-sm text-slate-400">Loading pricing generator…</div>}>
      <ProposalAddOnsDemo catalog={catalog} />
    </Suspense>
  );
}
