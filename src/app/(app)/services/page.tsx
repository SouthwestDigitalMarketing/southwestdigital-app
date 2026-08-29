import { prisma } from "@/lib/prisma";
import { getSchemaCapabilities } from "@/lib/database/schemaCapabilities";
import { requireStaffBrand } from "@/lib/brands/staff";
import { ensureDefaultContactTags } from "@/lib/contacts/seed";
import { parseArchivedView } from "@/lib/quotes/status";
import { ServicesCatalog, type ServiceRow } from "./ServicesCatalog";

type SearchParams = Promise<{ archived?: string }>;

export default async function ServicesPage({ searchParams }: { searchParams: SearchParams }) {
  const { brand } = await requireStaffBrand();
  const params = await searchParams;
  const archived = parseArchivedView(params.archived);
  await ensureDefaultContactTags(brand.id);
  const { proposalCatalog } = await getSchemaCapabilities();

  const baseSelect = {
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
    tags: {
      where: { tag: { isActive: true } },
      select: { tag: { select: { id: true, label: true, kind: true, key: true } } },
    },
    _count: { select: { packageServices: true } },
  } as const;

  const servicesPromise: Promise<ServiceRow[]> = proposalCatalog
    ? prisma.catalogService.findMany({
        where: { brandId: brand.id, active: !archived },
        orderBy: [{ priority: "asc" }, { category: "asc" }, { name: "asc" }],
        select: {
          ...baseSelect,
          offerKey: true,
          offerSection: true,
          defaultPrice: true,
          billingCadence: true,
          requiresPlatformMigration: true,
          requiredTargetPlatform: true,
          applicabilityNote: true,
        },
      }).then((services) => services.map((service) => ({
        ...service,
        tags: service.tags.map((link) => link.tag),
        defaultPrice: service.defaultPrice == null ? null : Number(service.defaultPrice),
        packageCount: service._count.packageServices,
      })))
    : prisma.catalogService.findMany({
        where: { brandId: brand.id, active: !archived },
        orderBy: [{ priority: "asc" }, { category: "asc" }, { name: "asc" }],
        select: baseSelect,
      }).then((services) => services.map((service) => ({
        ...service,
        tags: service.tags.map((link) => link.tag),
        offerKey: null,
        offerSection: "included-services",
        defaultPrice: null,
        billingCadence: "monthly",
        requiresPlatformMigration: false,
        requiredTargetPlatform: null,
        applicabilityNote: null,
        packageCount: service._count.packageServices,
      })));

  const [services, tags] = await Promise.all([
    servicesPromise,
    prisma.contactTag.findMany({
      where: { brandId: brand.id, isActive: true },
      orderBy: [{ kind: "asc" }, { sortOrder: "asc" }, { label: "asc" }],
      select: { id: true, label: true, kind: true },
    }),
  ]);

  return (
    <div className="p-8">
      <h1 className="sr-only">Services</h1>
      <ServicesCatalog
        archived={archived}
        tags={tags}
        services={services}
      />
    </div>
  );
}
