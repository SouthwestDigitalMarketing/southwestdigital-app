import { Suspense } from "react";
import { requireQuoteStaff } from "@/lib/quotes/access";
import ProposalCreationWorkspaceDemo from "../builder/ProposalCreationWorkspaceDemo";

export default async function QuotesPricingPage() {
  await requireQuoteStaff();
  return (
    <Suspense fallback={<div className="p-8 text-sm text-slate-400">Loading pricing generator…</div>}>
      <ProposalCreationWorkspaceDemo step="pricing" />
    </Suspense>
  );
}
