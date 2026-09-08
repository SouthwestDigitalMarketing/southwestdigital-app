import { requireQuoteStaff } from "@/lib/quotes/access";
import { prisma } from "@/lib/prisma";
import { pickActiveCatalogOffer } from "@/lib/discounts/eligibility";
import { getSchemaCapabilities } from "@/lib/database/schemaCapabilities";
import { ensureDefaultAgreementTemplate } from "@/lib/agreements/repository";
import {
  DEFAULT_AGREEMENT_TEMPLATE_NAME,
  DEFAULT_BOOKKEEPING_AGREEMENT_TEMPLATE,
} from "@/lib/agreements/template";
import type { AgreementTemplateOption } from "@/lib/agreements/types";
import LiveOfferPreview from "./LiveOfferPreview";

/**
 * Full-page live preview of the offer being built in another tab.
 *
 * Loads the same brand-scoped catalog offer and agreement templates the intro
 * step passes to its embedded preview, so the two surfaces render the same
 * proposal. Everything client-visible comes from the builder's local draft.
 */
export default async function OfferPreviewPage() {
  const { brand } = await requireQuoteStaff();
  const { agreementTemplates: hasAgreementTemplates } = await getSchemaCapabilities();

  const agreementTemplatesPromise: Promise<AgreementTemplateOption[]> = hasAgreementTemplates
    ? ensureDefaultAgreementTemplate(brand.id).then(() => prisma.agreementTemplate.findMany({
        where: { brandId: brand.id, status: "active" },
        orderBy: [{ isDefault: "desc" }, { name: "asc" }],
        select: { id: true, name: true, description: true, content: true, isDefault: true },
      }))
    : Promise.resolve([{
        id: "built-in-bookkeeping-services",
        name: DEFAULT_AGREEMENT_TEMPLATE_NAME,
        description: "Built-in bookkeeping services agreement",
        content: DEFAULT_BOOKKEEPING_AGREEMENT_TEMPLATE,
        isDefault: true,
      }]);

  const [discounts, agreementTemplates] = await Promise.all([
    prisma.brandDiscount.findMany({
      where: { brandId: brand.id, active: true, activationMode: "immediate" },
      orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
    }),
    agreementTemplatesPromise,
  ]);

  const catalogOffer = pickActiveCatalogOffer(
    discounts.map((discount) => ({
      kind: discount.kind,
      percent: discount.percent,
      amount: Number(discount.amount),
      title: discount.title,
      details: discount.details,
      activationMode: discount.activationMode,
      activationDelayDays: discount.activationDelayDays,
      deadlineMode: discount.deadlineMode,
      durationDays: discount.durationDays,
      deadlineDate: discount.deadlineDate,
      presentedAt: discount.presentedAt,
    })),
    { publishedAt: new Date() },
  );

  return (
    <LiveOfferPreview catalogOffer={catalogOffer} agreementTemplates={agreementTemplates} />
  );
}
