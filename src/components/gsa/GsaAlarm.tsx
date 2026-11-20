import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { GSA_DUE_HOURS, GSA_STEP_LABELS, currentGsaStep, formatWaiting, hoursSincePaid } from "@/lib/gsa/progress";
import type { GsaProposal } from "@/lib/gsa/store";

function money(amount: number | null, currency: string) {
  if (amount === null) return "Paid";
  return `${amount.toLocaleString("en-US", { style: "currency", currency, maximumFractionDigits: 0 })} paid`;
}

function day(date: Date | null) {
  return date ? date.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "America/Chicago" }) : null;
}

export function gsaHref(proposal: GsaProposal) {
  if (proposal.leadId) return `/leads/${encodeURIComponent(proposal.leadId)}#gsa`;
  if (proposal.contactId) return `/contacts/${encodeURIComponent(proposal.contactId)}#gsa`;
  return "/agreements";
}

/**
 * Paid proposal agreements with no signed GSA: the hottest leads. Shown at the
 * top of the dashboard only when there are any; amber, red once a GSA is past
 * the 24-hour promise.
 */
export function GsaAlarm({ proposals, now }: { proposals: GsaProposal[]; now: Date }) {
  if (proposals.length === 0) return null;
  const late = proposals.some((p) => hoursSincePaid(p.paid.paidAt, now) >= GSA_DUE_HOURS);
  return (
    <section
      aria-label="Paid, GSA not signed"
      className={`mb-5 overflow-hidden rounded-xl border bg-white shadow-sm ${late ? "border-rose-300" : "border-amber-300"}`}
    >
      <div className={`flex items-center justify-between gap-3 px-4 py-2.5 ${late ? "bg-rose-600 text-white" : "bg-amber-100 text-amber-900"}`}>
        <p className="text-sm font-semibold">Paid, GSA not signed</p>
        <p className="shrink-0 text-xs font-medium opacity-90">
          {proposals.length} {proposals.length === 1 ? "lead" : "leads"}
          <span className="hidden sm:inline"> · GSA due within {GSA_DUE_HOURS}h of payment</span>
        </p>
      </div>
      <ul className="divide-y divide-slate-100">
        {proposals.map((proposal) => {
          const hours = hoursSincePaid(proposal.paid.paidAt, now);
          const overdue = hours >= GSA_DUE_HOURS;
          const step = currentGsaStep(proposal);
          const paidOn = day(proposal.paid.paidAt);
          return (
            <li key={proposal.engagementId}>
              <Link href={gsaHref(proposal)} className="flex min-h-14 items-center gap-3 px-4 py-3 hover:bg-slate-50">
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-semibold text-slate-900">{proposal.clientName}</span>
                  <span className="block text-sm leading-snug text-slate-500">
                    {[proposal.paid.tier, money(proposal.paid.amount, proposal.paid.currency) + (paidOn ? ` ${paidOn}` : ""),
                      step ? `GSA ${GSA_STEP_LABELS[step].toLowerCase()}` : "GSA not drafted"].filter(Boolean).join(" · ")}
                  </span>
                </span>
                <span
                  className={`shrink-0 rounded-full px-2.5 py-0.5 text-sm font-semibold tabular-nums ${overdue ? "bg-rose-100 text-rose-700" : "bg-amber-100 text-amber-800"}`}
                  title={overdue ? "Past the 24-hour promise" : "Within the 24-hour promise"}
                >
                  {formatWaiting(hours)}
                </span>
                <ChevronRight className="h-4 w-4 shrink-0 text-slate-400" aria-hidden="true" />
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
