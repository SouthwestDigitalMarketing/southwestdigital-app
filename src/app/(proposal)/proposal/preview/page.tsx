import { Suspense } from "react";
import OfferProposalPreview from "@/app/(app)/offers/builder/OfferProposalPreview";

export default function ProposalPreviewPage() {
  return (
    <Suspense fallback={<div className="p-8 text-sm text-slate-400">Loading proposal…</div>}>
      <OfferProposalPreview />
    </Suspense>
  );
}
