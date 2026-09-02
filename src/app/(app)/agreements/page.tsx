import { getSchemaCapabilities } from "@/lib/database/schemaCapabilities";
import { requireStaffBrand } from "@/lib/brands/staff";
import { ensureDefaultAgreementTemplate } from "@/lib/agreements/repository";
import { prisma } from "@/lib/prisma";
import { AgreementTemplatesManager } from "./AgreementTemplatesManager";

export default async function AgreementsPage() {
  const { brand } = await requireStaffBrand();
  const { agreementTemplates } = await getSchemaCapabilities();

  if (!agreementTemplates) {
    return (
      <div className="p-8">
        <h1 className="text-xl font-semibold text-slate-900">Agreement Templates</h1>
        <p className="mt-2 max-w-2xl text-sm text-amber-700">
          The agreement-template database migration has not been applied yet. Apply the latest
          migration, then reload this page.
        </p>
      </div>
    );
  }

  await ensureDefaultAgreementTemplate(brand.id);
  const templates = await prisma.agreementTemplate.findMany({
    where: { brandId: brand.id },
    orderBy: [{ status: "asc" }, { isDefault: "desc" }, { name: "asc" }],
    select: {
      id: true,
      key: true,
      name: true,
      description: true,
      content: true,
      status: true,
      isDefault: true,
      updatedAt: true,
    },
  });

  return (
    <AgreementTemplatesManager
      templates={templates.map((template) => ({
        ...template,
        status: template.status === "archived" ? "archived" : "active",
        updatedAt: template.updatedAt.toISOString(),
      }))}
    />
  );
}
