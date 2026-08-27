import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireStaffBrand } from "@/lib/brands/staff";
import { ensureDefaultContactTags } from "@/lib/contacts/seed";
import { TagsCatalog } from "./TagsCatalog";

export default async function SettingsTagsPage() {
  const { brand } = await requireStaffBrand();
  await ensureDefaultContactTags(brand.id);

  const [tags, pipelines] = await Promise.all([
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
        _count: { select: { contacts: true } },
      },
    }),
    prisma.pipeline.findMany({
      where: { brandId: brand.id, isActive: true },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
  ]);

  return (
    <div className="p-8">
      <div>
        <Link href="/settings" className="text-xs text-slate-400 hover:underline">
          ← Settings
        </Link>
        <h1 className="mt-1 text-2xl font-semibold text-slate-900">Tags</h1>
        <p className="mt-1 text-sm text-slate-500">
          Shared tag list for {brand.name}. Contacts pick from this list; editing a tag updates it
          everywhere.
        </p>
      </div>

      <div className="mt-6 max-w-5xl">
        <TagsCatalog
          tags={tags.map((tag) => ({
            id: tag.id,
            label: tag.label,
            kind: tag.kind,
            usageCount: tag._count.contacts,
            pipelineId: tag.automations[0]?.pipelineId ?? null,
          }))}
          pipelines={pipelines}
        />
      </div>
    </div>
  );
}
