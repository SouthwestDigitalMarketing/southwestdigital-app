import { Suspense } from "react";
import { requireQuoteStaff } from "@/lib/quotes/access";
import ProposalFinalizeDemo from "../builder/ProposalFinalizeDemo";

export default async function OfferFinalizePage() {
  await requireQuoteStaff();
  return (
    <Suspense fallback={<div className="p-8 text-sm text-slate-400">Loading…</div>}>
      <ProposalFinalizeDemo />
    </Suspense>
  );
}
