import { Suspense } from "react";
import { requireQuoteStaff } from "@/lib/quotes/access";
import { prisma } from "@/lib/prisma";
import ProposalIntroDemo from "../builder/ProposalIntroDemo";

export default async function OfferIntroPage() {
  const { brand } = await requireQuoteStaff();

  const mediaItems = await prisma.brandMedia.findMany({
    where: { brandId: brand.id },
    select: { id: true, name: true, type: true, url: true },
    orderBy: { sortOrder: "asc" },
  });

  return (
    <Suspense fallback={<div className="p-8 text-sm text-slate-400">Loading…</div>}>
      <ProposalIntroDemo mediaItems={mediaItems} />
    </Suspense>
  );
}
