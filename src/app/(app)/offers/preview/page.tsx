import { Suspense } from "react";
import { requireQuoteStaff } from "@/lib/quotes/access";
import OfferProposalPreview from "../builder/OfferProposalPreview";

export default async function OfferPreviewPage() {
  await requireQuoteStaff();
  return (
    <Suspense fallback={<div className="p-8 text-sm text-slate-400">Loading proposal…</div>}>
      <OfferProposalPreview />
    </Suspense>
  );
}
