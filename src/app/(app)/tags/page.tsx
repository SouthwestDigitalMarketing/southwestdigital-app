import { prisma } from "@/lib/prisma";
import { requireStaffBrand } from "@/lib/brands/staff";
import { ensureDefaultContactTags } from "@/lib/contacts/seed";
import { TagsCatalog } from "./TagsCatalog";

export default async function TagsPage() {
  const { brand } = await requireStaffBrand();
  await ensureDefaultContactTags(brand.id);

  const [tags, pipelines, services] = await Promise.all([
    prisma.contactTag.findMany({
      where: { brandId: brand.id },
      orderBy: [{ sortOrder: "asc" }, { label: "asc" }],
      select: {
        id: true,
        label: true,
        kind: true,
        automations: {
          where: { isActive: true },
          select: { pipelineId: true },
          take: 1,
        },
        _count: { select: { contacts: true, catalogServiceTags: true } },
      },
    }),
    prisma.pipeline.findMany({
      where: { brandId: brand.id, isActive: true },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
    prisma.catalogService.findMany({
      where: { brandId: brand.id },
      orderBy: [{ active: "desc" }, { name: "asc" }],
      select: {
        id: true,
        name: true,
        code: true,
        active: true,
        tags: { select: { tagId: true } },
      },
    }),
  ]);

  return (
    <div className="p-8">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">Tags</h1>
        <p className="mt-1 text-sm text-slate-500">
          Shared tag list for {brand.name}. Contacts and catalogue services pick from this list;
          editing a tag updates it everywhere.
        </p>
      </div>

      <div className="mt-6 w-full">
        <TagsCatalog
          tags={tags.map((tag) => ({
            id: tag.id,
            label: tag.label,
            kind: tag.kind,
            usageCount: tag._count.contacts,
            serviceCount: tag._count.catalogServiceTags,
            pipelineId: tag.automations[0]?.pipelineId ?? null,
          }))}
          pipelines={pipelines}
          services={services.map((service) => ({
            id: service.id,
            name: service.name,
            code: service.code,
            active: service.active,
            tagIds: service.tags.map((link) => link.tagId),
          }))}
        />
      </div>
    </div>
  );
}
