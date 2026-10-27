import {
  CLEANUP_APPROVAL_TEXT, CLEANUP_MONTHLY_START_TEXT, NO_CLEANUP_MONTHLY_START_TEXT,
  proposalPaymentSchedule,
} from "@/lib/quotes/paymentSchedule";

const fmt = (value: number) => value.toLocaleString("en-US", { style: "currency", currency: "USD" });

export default function ProposalPaymentPlan({
  cleanupMonths, cleanupMonthlyRate, onboardingFee, recurringMonthlyTotal,
  additionalOneTimeTotal, requiredOneTime = [], annual, amountDueNow, showStages = false,
}: {
  cleanupMonths: number;
  cleanupMonthlyRate: number;
  onboardingFee: number;
  recurringMonthlyTotal: number;
  additionalOneTimeTotal: number;
  /** Required one-time services (e.g. a platform migration), listed by name instead of as a selected add-on. Already included in additionalOneTimeTotal. */
  requiredOneTime?: Array<{ name: string; price: number }>;
  annual: boolean;
  amountDueNow?: number;
  showStages?: boolean;
}) {
  const schedule = proposalPaymentSchedule({ cleanupMonths, cleanupMonthlyRate, onboardingFee, recurringMonthlyTotal, additionalOneTimeTotal });
  const requiredTotal = requiredOneTime.reduce((total, row) => total + row.price, 0);
  const selectedOneTimeTotal = Math.max(0, Math.round((additionalOneTimeTotal - requiredTotal) * 100) / 100);
  return (
    <section aria-label="Payment plan" className="space-y-4 text-sm text-slate-700">
      <div className="rounded-xl bg-slate-50 p-4">
        <p className="text-xs font-bold uppercase tracking-wide">Due today</p>
        <dl className="mt-3 space-y-2">
          <div className="flex justify-between gap-3"><dt>{schedule.hasCleanup ? "Onboarding + Discovery" : "Onboarding"}</dt><dd>{onboardingFee > 0 ? fmt(onboardingFee) : "Waived"}</dd></div>
          {!schedule.hasCleanup ? <div className="flex justify-between gap-3"><dt>First month of service</dt><dd>{fmt(schedule.firstMonthDueNow)}</dd></div> : null}
          {requiredOneTime.map((row) => <div key={row.name} className="flex justify-between gap-3"><dt>{row.name}</dt><dd>{fmt(row.price)}</dd></div>)}
          {selectedOneTimeTotal > 0 ? <div className="flex justify-between gap-3"><dt>Selected one-time add-ons</dt><dd>{fmt(selectedOneTimeTotal)}</dd></div> : null}
          <div className="flex justify-between gap-3 border-t border-slate-200 pt-2 font-bold"><dt>Total due today</dt><dd>{fmt(amountDueNow ?? schedule.amountDueNow)}</dd></div>
        </dl>
      </div>
      {schedule.hasCleanup ? (
        <div className="rounded-xl border border-slate-200 p-4">
          <p className="font-semibold">Estimated cleanup — later</p>
          <p className="mt-2">{cleanupMonths} {cleanupMonths === 1 ? "month" : "months"} × {fmt(cleanupMonthlyRate)}/month = <strong>{fmt(schedule.cleanupTotal)}</strong></p>
          <p className="mt-2 text-xs leading-5 text-slate-600">Estimate only. Final scope, price, and payment milestones require your approval after discovery. Not charged today.</p>
        </div>
      ) : null}
      <div>
        <p className="font-semibold">Ongoing service: {fmt(recurringMonthlyTotal)}/month</p>
        {annual ? <p className="mt-1">{fmt(recurringMonthlyTotal)} × 12 months = <strong>{fmt(schedule.annualTotal)}</strong></p> : null}
        {annual ? <p className="mt-1 text-xs text-slate-600">12-month commitment, paid monthly. Excludes onboarding, cleanup, and one-time add-ons.</p> : null}
        <p className="mt-2 text-xs leading-5 text-slate-600">{schedule.hasCleanup ? CLEANUP_MONTHLY_START_TEXT : NO_CLEANUP_MONTHLY_START_TEXT}</p>
      </div>
      {showStages ? (
        <div className="rounded-xl border border-slate-200 p-4">
          <h3 className="font-semibold">What happens next</h3>
          <ol className="mt-3 list-decimal space-y-3 pl-5 text-sm leading-6">
            <li><strong>Onboarding{schedule.hasCleanup ? " + Discovery" : ""}.</strong> After payment clears (or is waived), provide account access and required records. We confirm readiness and the service schedule.</li>
            {schedule.hasCleanup ? <li><strong>Cleanup approval and delivery.</strong> {CLEANUP_APPROVAL_TEXT}</li> : null}
            <li><strong>Monthly bookkeeping.</strong> {schedule.hasCleanup ? CLEANUP_MONTHLY_START_TEXT : NO_CLEANUP_MONTHLY_START_TEXT}</li>
          </ol>
        </div>
      ) : null}
    </section>
  );
}
