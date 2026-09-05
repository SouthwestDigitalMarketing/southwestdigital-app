import Link from "next/link";
import { requireStaffBrand } from "@/lib/brands/staff";
import { prisma } from "@/lib/prisma";
import { ensureDefaultOptionsTemplate } from "@/lib/quotes/optionsTemplatesSeed";
import OptionsTemplatesManager from "./OptionsTemplatesManager";
import type { OptionsTemplateListItem } from "./actions";

export default async function OptionsTemplatesPage() {
  const { brand } = await requireStaffBrand();
  await ensureDefaultOptionsTemplate(brand.id);
  const rows = await prisma.proposalOptionsTemplate.findMany({
    where: { brandId: brand.id },
    orderBy: [{ archivedAt: "asc" }, { name: "asc" }],
    select: {
      id: true,
      name: true,
      description: true,
      productKind: true,
      defaultForProductKind: true,
      archivedAt: true,
      updatedAt: true,
    },
  });

  const templates: OptionsTemplateListItem[] = rows.map((row) => ({
    id: row.id,
    name: row.name,
    description: row.description,
    productKind: row.productKind,
    defaultForProductKind: row.defaultForProductKind,
    archivedAt: row.archivedAt ? row.archivedAt.toISOString() : null,
    updatedAt: row.updatedAt.toISOString(),
  }));

  return (
    <div className="p-5 sm:p-8">
      <div className="mb-4 flex items-center gap-3 text-sm">
        <Link
          href="/offers"
          className="inline-flex items-center rounded-lg px-2 py-1 font-semibold text-slate-600 hover:bg-slate-100 hover:text-slate-900"
        >
          ← Back to Offers
        </Link>
        <Link
          href="/offers/add-ons"
          className="inline-flex items-center rounded-lg px-2 py-1 font-semibold text-slate-600 hover:bg-slate-100 hover:text-slate-900"
        >
          Options step →
        </Link>
      </div>
      <OptionsTemplatesManager templates={templates} />
    </div>
  );
}
