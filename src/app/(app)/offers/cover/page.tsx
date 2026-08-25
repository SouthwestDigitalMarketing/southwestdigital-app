import { Suspense } from "react";
import { requireQuoteStaff } from "@/lib/quotes/access";
import ProposalCoverLetterDemo from "../builder/ProposalCoverLetterDemo";

export default async function OfferCoverPage() {
  await requireQuoteStaff();
  return (
    <Suspense fallback={<div className="p-8 text-sm text-slate-400">Loading email…</div>}>
      <ProposalCoverLetterDemo />
    </Suspense>
  );
}
