import Link from "next/link";
import { Check, Eye, FileText } from "lucide-react";
import {
  GSA_DUE_HOURS, GSA_STEPS, GSA_STEP_LABELS, currentGsaStep, formatWaiting, gsaFolderCandidates, hoursSincePaid, nextGsaAction,
} from "@/lib/gsa/progress";
import type { GsaProposal } from "@/lib/gsa/store";
import { GsaStepButton } from "./GsaStepButton";

const STEP_FIELD = { drafted: "gsaDraftedAt", sent: "gsaSentAt", signed: "gsaSignedAt" } as const;

function day(date: Date | null) {
  return date ? date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "America/Chicago" }) : null;
}

function pdfHref(proposal: GsaProposal, company: string, doc?: "draft" | "signed", returnTo?: string) {
  const params = new URLSearchParams();
  for (const folder of gsaFolderCandidates(proposal.gsaClientFolder, company)) params.append("folder", folder);
  if (doc) params.set("doc", doc);
  if (doc && returnTo) params.set("ret", `${returnTo}#gsa`);
  return `/agreements/pdfs?${params.toString()}`;
}

/** The step whose PDF a "View" button opens: the draft (also what was sent), or the signed copy. */
const VIEW_DOC = { drafted: "draft", signed: "signed" } as const;

/**
 * The GSA detail for one paid proposal agreement: what was bought, the three
 * GSA steps with dates, what to do next, and the agreement PDFs on ripley.
 */
export function GsaPanel({ proposal, company, now, returnTo }: {
  proposal: GsaProposal;
  company: string;
  now: Date;
  /** This page's path, so the viewer's Back button comes here. */
  returnTo?: string;
}) {
  const step = currentGsaStep(proposal);
  const signed = step === "signed";
  const hours = hoursSincePaid(proposal.paid.paidAt, now);
  const overdue = !signed && hours >= GSA_DUE_HOURS;
  const amount = proposal.paid.amount === null
    ? null
    : proposal.paid.amount.toLocaleString("en-US", { style: "currency", currency: proposal.paid.currency });
  return (
    <section id="gsa" className="scroll-mt-20 rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-base font-semibold text-slate-900">GSA</h2>
          <p className="mt-0.5 text-sm text-slate-500">
            {[proposal.paid.tier, amount ? `${amount} paid` : "Paid", day(proposal.paid.paidAt)].filter(Boolean).join(" · ")}
          </p>
        </div>
        <span
          className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-semibold ${
            signed ? "bg-emerald-50 text-emerald-700" : overdue ? "bg-rose-100 text-rose-700" : "bg-amber-100 text-amber-800"}`}
        >
          {signed ? "Signed, client won" : `Waiting ${formatWaiting(hours)}`}
        </span>
      </div>

      <p className={`mt-3 text-sm font-medium ${signed ? "text-emerald-700" : "text-slate-800"}`}>{nextGsaAction(proposal)}</p>

      <ol className="mt-3 divide-y divide-slate-100 rounded-lg border border-slate-100">
        {GSA_STEPS.map((key) => {
          const at = proposal[STEP_FIELD[key]];
          return (
            <li key={key} className="flex min-h-12 items-center gap-3 px-3 py-2">
              <span
                className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full border ${
                  at ? "border-emerald-600 bg-emerald-600 text-white" : "border-slate-300 text-transparent"}`}
                aria-hidden="true"
              >
                <Check className="h-3.5 w-3.5" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-medium text-slate-900">{GSA_STEP_LABELS[key]}</span>
                <span className="block text-xs text-slate-500">{at ? day(at) : "Not yet"}</span>
              </span>
              {at && key in VIEW_DOC ? (
                <Link
                  href={pdfHref(proposal, company || proposal.clientName, VIEW_DOC[key as keyof typeof VIEW_DOC], returnTo)}
                  aria-label={`View the ${key === "signed" ? "signed GSA" : "GSA draft"}`}
                  className="ui-action-secondary inline-flex min-h-9 items-center gap-1.5 rounded-lg border px-3 text-xs font-semibold transition"
                >
                  <Eye className="h-3.5 w-3.5" aria-hidden="true" />
                  View
                </Link>
              ) : null}
              <GsaStepButton engagementId={proposal.engagementId} step={key} done={Boolean(at)} label={GSA_STEP_LABELS[key]} />
            </li>
          );
        })}
      </ol>

      <Link
        href={pdfHref(proposal, company || proposal.clientName)}
        className="mt-3 inline-flex min-h-10 items-center gap-2 text-sm font-medium text-slate-700 hover:underline"
      >
        <FileText className="h-4 w-4" aria-hidden="true" />
        All agreement PDFs (needs Tailscale)
      </Link>
    </section>
  );
}
