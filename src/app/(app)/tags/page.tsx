import { prisma } from "@/lib/prisma";
import { requireStaffBrand } from "@/lib/brands/staff";
import { ensureDefaultContactTags } from "@/lib/contacts/seed";
import { TagsCatalog } from "./TagsCatalog";

export default async function TagsPage() {
  const { brand } = await requireStaffBrand();
  await ensureDefaultContactTags(brand.id);

  const [tags, pipelines, services] = await Promise.all([
    prisma.contactTag.findMany({
      where: { brandId: brand.id, isActive: true },
      orderBy: [{ sortOrder: "asc" }, { label: "asc" }],
      select: {
        id: true,
        label: true,
        kind: true,
        automations: {
          where: { isActive: true },
          select: { pipelineId: true, stageId: true },
          take: 1,
        },
        _count: { select: { contacts: true, catalogServiceTags: true } },
      },
    }),
    prisma.pipeline.findMany({
      where: { brandId: brand.id, isActive: true },
      orderBy: { name: "asc" },
      select: {
        id: true,
        name: true,
        stages: {
          where: { isActive: true },
          orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
          select: { id: true, name: true },
        },
      },
    }),
    prisma.catalogService.findMany({
      where: { brandId: brand.id },
      orderBy: [{ active: "desc" }, { name: "asc" }],
      select: {
        id: true,
        name: true,
        code: true,
        active: true,
        tags: { where: { tag: { isActive: true } }, select: { tagId: true } },
      },
    }),
  ]);

  return (
    <div className="p-8">
      <h1 className="sr-only">Tags</h1>
      <h2 className="text-lg font-semibold text-slate-900">Tag catalogue</h2>
      <div className="mt-4">
        <TagsCatalog
          tags={tags.map((tag) => ({
            id: tag.id,
            label: tag.label,
            kind: tag.kind,
            usageCount: tag._count.contacts,
            serviceCount: tag._count.catalogServiceTags,
            pipelineId: tag.automations[0]?.pipelineId ?? null,
            stageId: tag.automations[0]?.stageId ?? null,
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
