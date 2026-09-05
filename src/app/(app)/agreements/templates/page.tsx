import Link from "next/link";
import { ensureDefaultAgreementTemplate } from "@/lib/agreements/repository";
import { requireStaffBrand } from "@/lib/brands/staff";
import { getSchemaCapabilities } from "@/lib/database/schemaCapabilities";
import { prisma } from "@/lib/prisma";
import { AgreementTemplatesManager } from "../AgreementTemplatesManager";

export default async function AgreementTemplatesPage() {
  const { brand } = await requireStaffBrand();
  const { agreementTemplates } = await getSchemaCapabilities();

  const templates = agreementTemplates
    ? await (async () => {
        await ensureDefaultAgreementTemplate(brand.id);
        return prisma.agreementTemplate.findMany({
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
            defaultForProductKind: true,
            updatedAt: true,
          },
        });
      })()
    : [];

  return (
    <div className="agreements-readable p-5 sm:p-8">
      <Link
        href="/agreements"
        className="inline-flex items-center rounded-lg px-2 py-1 text-sm font-semibold text-slate-600 hover:bg-slate-100 hover:text-slate-900"
      >
        ← Back to Agreements
      </Link>

      <div className="mt-4">
        {agreementTemplates ? (
          <AgreementTemplatesManager
            templates={templates.map((template) => ({
              ...template,
              status: template.status === "archived" ? "archived" : "active",
              updatedAt: template.updatedAt.toISOString(),
            }))}
          />
        ) : (
          <div>
            <h1 className="text-xl font-semibold text-slate-900">Agreement Templates</h1>
            <p className="mt-2 max-w-2xl text-sm text-amber-700">
              The agreement-template database migration has not been applied yet. Apply the latest
              migration to manage agreement templates.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
