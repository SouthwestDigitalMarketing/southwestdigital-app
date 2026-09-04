import { getSchemaCapabilities } from "@/lib/database/schemaCapabilities";
import { requireStaffBrand } from "@/lib/brands/staff";
import { ensureDefaultAgreementTemplate } from "@/lib/agreements/repository";
import { prisma } from "@/lib/prisma";
import { AgreementTemplatesManager } from "./AgreementTemplatesManager";
import { IssuedAgreementsTable } from "./IssuedAgreementsTable";

export default async function AgreementsPage() {
  const { brand } = await requireStaffBrand();
  const { agreementTemplates } = await getSchemaCapabilities();

  const agreements = await prisma.engagement.findMany({
    where: {
      brandId: brand.id,
      OR: [
        { agreementText: { not: null } },
        { agreementSentAt: { not: null } },
        { signedAt: { not: null } },
      ],
    },
    orderBy: [{ signedAt: "desc" }, { agreementSentAt: "desc" }, { createdAt: "desc" }],
    select: {
      id: true,
      clientName: true,
      primaryContactName: true,
      primaryContactEmail: true,
      agreementText: true,
      agreementSentAt: true,
      signedAt: true,
      signerName: true,
      agreementManagerStatus: true,
      agreementCancellationRequestedAt: true,
      agreementCancellationReason: true,
      onboardingFeeStatus: true,
      createdAt: true,
      quotes: { orderBy: { createdAt: "desc" }, take: 1, select: { id: true } },
    },
  });

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
    <div className="p-8">
      <IssuedAgreementsTable agreements={agreements} />

      <section className="mt-10 border-t border-slate-200 pt-8">
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
            <h2 className="text-lg font-semibold text-slate-900">Agreement templates</h2>
            <p className="mt-2 max-w-2xl text-sm text-amber-700">
              The agreement-template database migration has not been applied yet. Apply the latest
              migration to manage templates.
            </p>
          </div>
        )}
      </section>
    </div>
  );
}
