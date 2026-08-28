import { prisma } from "@/lib/prisma";
import { requireStaffBrand } from "@/lib/brands/staff";
import { ensureDefaultContactTags } from "@/lib/contacts/seed";
import { parseArchivedView } from "@/lib/quotes/status";
import { ServicesCatalog } from "./ServicesCatalog";

type SearchParams = Promise<{ archived?: string }>;

export default async function ServicesPage({ searchParams }: { searchParams: SearchParams }) {
  const { brand } = await requireStaffBrand();
  const params = await searchParams;
  const archived = parseArchivedView(params.archived);
  await ensureDefaultContactTags(brand.id);

  const [services, tags] = await Promise.all([
    prisma.catalogService.findMany({
      where: { brandId: brand.id, active: !archived },
      orderBy: [{ priority: "asc" }, { category: "asc" }, { name: "asc" }],
      select: {
        id: true,
        name: true,
        category: true,
        service: true,
        code: true,
        cardLabel: true,
        clientBenefit: true,
        internalDescription: true,
        defaultInclusion: true,
        priority: true,
        realEstateSpecific: true,
        active: true,
        tagId: true,
        tags: { select: { tag: { select: { id: true, label: true, kind: true, key: true } } } },
        _count: { select: { packageServices: true } },
      },
    }),
    prisma.contactTag.findMany({
      where: { brandId: brand.id, isActive: true },
      orderBy: [{ kind: "asc" }, { sortOrder: "asc" }, { label: "asc" }],
      select: { id: true, label: true, kind: true },
    }),
  ]);

  return (
    <div className="p-8">
      <h1 className="text-2xl font-semibold text-slate-900">Services</h1>
      <p className="mt-1 text-base text-slate-500">
        Product catalogue for {brand.name}. Tags and their kinds are managed on the Tags page.
        Attach the Real estate tag when a service should only appear on real-estate or mixed-book
        engagements.
      </p>
      <div className="mt-6">
        <ServicesCatalog
          archived={archived}
          tags={tags}
          services={services.map((service) => ({
            id: service.id,
            name: service.name,
            category: service.category,
            service: service.service,
            tagId: service.tagId,
            tags: service.tags.map((link) => ({
              id: link.tag.id,
              label: link.tag.label,
              kind: link.tag.kind,
              key: link.tag.key,
            })),
            code: service.code,
            cardLabel: service.cardLabel,
            clientBenefit: service.clientBenefit,
            internalDescription: service.internalDescription,
            defaultInclusion: service.defaultInclusion,
            priority: service.priority,
            realEstateSpecific: service.realEstateSpecific,
            active: service.active,
            packageCount: service._count.packageServices,
          }))}
        />
      </div>
    </div>
  );
}
