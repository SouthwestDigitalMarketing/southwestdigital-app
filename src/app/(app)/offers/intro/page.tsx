import { Suspense } from "react";
import { requireQuoteStaff } from "@/lib/quotes/access";
import { prisma } from "@/lib/prisma";
import { pickActiveCatalogOffer } from "@/lib/discounts/eligibility";
import ProposalIntroDemo from "../builder/ProposalIntroDemo";

export default async function OfferIntroPage() {
  const { brand } = await requireQuoteStaff();

  const [mediaItems, mediaFolders, discounts] = await Promise.all([
    prisma.brandMedia.findMany({
      where: { brandId: brand.id },
      select: { id: true, name: true, type: true, url: true, folderId: true },
      orderBy: { sortOrder: "asc" },
    }),
    prisma.brandMediaFolder.findMany({
      where: { brandId: brand.id },
      select: { id: true, name: true },
      orderBy: { sortOrder: "asc" },
    }),
    prisma.brandDiscount.findMany({
      where: { brandId: brand.id, active: true, activationMode: "immediate" },
      orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
    }),
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
    <Suspense fallback={<div className="p-8 text-sm text-slate-400">Loading…</div>}>
      <ProposalIntroDemo mediaItems={mediaItems} mediaFolders={mediaFolders} catalogOffer={catalogOffer} />
    </Suspense>
  );
}
