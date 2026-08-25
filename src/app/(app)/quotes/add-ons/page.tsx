import { Suspense } from "react";
import { requireQuoteStaff } from "@/lib/quotes/access";
import ProposalAddOnsDemo from "../builder/ProposalAddOnsDemo";

export default async function QuotesAddOnsPage() {
  await requireQuoteStaff();
  return (
    <Suspense fallback={<div className="p-8 text-sm text-slate-400">Loading pricing generator…</div>}>
      <ProposalAddOnsDemo />
    </Suspense>
  );
}
