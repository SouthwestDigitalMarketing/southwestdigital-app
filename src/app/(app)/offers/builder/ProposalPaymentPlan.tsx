import {
  ANNUAL_PREPAID_CLEANUP_START_TEXT, ANNUAL_PREPAID_START_TEXT,
  CLEANUP_APPROVAL_TEXT, CLEANUP_MONTHLY_START_TEXT, NO_CLEANUP_MONTHLY_START_TEXT,
  proposalPaymentSchedule,
} from "@/lib/quotes/paymentSchedule";
import {
  addDaysIso,
  buildCleanupInstallments,
  monthlyStartLengthText,
  type CleanupInstallment,
  type CleanupPlan,
} from "@/lib/quotes/cleanupPlan";
import CleanupTermsBlock from "./CleanupTermsBlock";

const fmt = (value: number) => value.toLocaleString("en-US", { style: "currency", currency: "USD" });

export default function ProposalPaymentPlan({
  cleanupMonths, cleanupMonthlyRate, onboardingFee, recurringMonthlyTotal,
  additionalOneTimeTotal, requiredOneTime = [], migrationOneTime = null, annual, amountDueNow, creditApplied = 0, creditLabel = "Credit for work already paid", originalOnboardingFee, annualSavingsPercent = 0, showStages = false,
  cleanupPlan = null, cleanupInstallments, brandName = "us", complexityCleanupAdd = 0, cleanupIsEstimate = false,
  cleanupLengthWeeks = null, mentionFileFee,
}: {
  cleanupMonths: number;
  cleanupMonthlyRate: number;
  onboardingFee: number;
  recurringMonthlyTotal: number;
  additionalOneTimeTotal: number;
  /** Required one-time services (e.g. a platform migration), listed by name instead of as a selected add-on. Already included in additionalOneTimeTotal. */
  requiredOneTime?: Array<{ name: string; price: number }>;
  /**
   * Spec 05 sized Desktop → Online migration charge, itemized on its own
   * line. Already included in additionalOneTimeTotal; the residual
   * Selected one-time add-ons line excludes it. Null (legacy or no choice)
   * renders exactly as today.
   */
  migrationOneTime?: { name: string; price: number } | null;
  annual: boolean;
  amountDueNow?: number;
  /** Dollars credited against today's payment; the line appears only when the schedule can apply some. */
  creditApplied?: number;
  creditLabel?: string;
  /** The fee before a waiver; shown struck through beside "Waived" when given. */
  originalOnboardingFee?: number;
  /** The offer's 12-month saving, in percent. Annual mode only: shows the gross price and the saving. */
  annualSavingsPercent?: number;
  showStages?: boolean;
  /**
   * Spec 04 wrap-up plan. Absent (legacy): the estimate block, start texts,
   * and stages render exactly as today. Present with cleanup: the block adds
   * the wrap-up line, the fixed monthly-start rule, the payment plan with
   * installments, and the extension clause.
   */
  cleanupPlan?: CleanupPlan | null;
  /**
   * Frozen installments for the displayed cleanup total (the stored checkout
   * carries these post-selection, complexity add included). Defaults to a
   * fresh cut of the displayed estimate when omitted.
   */
  cleanupInstallments?: CleanupInstallment[];
  /** Brand named in the extension clause ("delay caused by us" when omitted). */
  brandName?: string;
  /**
   * Spec 03 complexity cleanup weight inside the displayed cleanup total.
   * When positive the estimate itemizes it so the months × rate equation
   * adds up to the displayed total (which then equals the shown
   * installments). Absent renders the legacy base-only estimate.
   */
  complexityCleanupAdd?: number;
  /** Labels the cleanup terms as a pre-selection estimate. */
  cleanupIsEstimate?: boolean;
  /**
   * Pre-selection length mode: whole weeks between plan start and wrap-up,
   * shown instead of the wrap-up calendar date. Null (default) keeps the
   * exact stored dates. The live public display plan carries a placeholder
   * start, so its caller passes the server-computed weeks explicitly; a
   * staff plan with a real start resolves them when omitted.
   */
  cleanupLengthWeeks?: number | null;
  /**
   * Whether the agreement carrying the extension clause charges the $150
   * file-maintenance fee. Passed through to the terms block; undefined
   * (default) names the fee, matching the default template.
   */
  mentionFileFee?: boolean;
}) {
  const schedule = proposalPaymentSchedule({
    cleanupMonths, cleanupMonthlyRate, onboardingFee, recurringMonthlyTotal, additionalOneTimeTotal, annualPrepay: annual, creditApplied,
    ...(cleanupPlan ? { cleanupPlan } : {}),
  });
  // The plan only takes effect alongside cleanup; a stray plan with zero
  // months renders the legacy block (the schedule has no installments then).
  const withCleanupPlan = Boolean(cleanupPlan) && schedule.hasCleanup && "cleanupInstallments" in schedule;
  // Validated Spec 03 complexity add for the displayed estimate.
  const cleanupComplexityAdd = typeof complexityCleanupAdd === "number" && Number.isFinite(complexityCleanupAdd) && complexityCleanupAdd > 0
    ? Math.round(complexityCleanupAdd * 100) / 100
    : 0;
  // The fallback cut covers the whole displayed estimate: the schedule total
  // is months × rate only, so the complexity add joins it here. Frozen
  // post-selection installments already include the add and pass through.
  const planInstallments = cleanupInstallments
    ?? (withCleanupPlan && cleanupPlan
      ? buildCleanupInstallments(Math.round((schedule.cleanupTotal + cleanupComplexityAdd) * 100), cleanupPlan)
      : []);
  // Pre-selection length mode: show "about N weeks after you accept" instead
  // of the wrap-up calendar date, which would go stale before the client
  // selects. The wording plan rewinds the start by the week count so the
  // length builders resolve the same N for a placeholder-start public plan;
  // installments keep cutting from the real plan above. Null (default) keeps
  // the exact stored dates for post-selection views.
  const lengthWeeks = typeof cleanupLengthWeeks === "number" && Number.isFinite(cleanupLengthWeeks) && cleanupLengthWeeks > 0
    ? Math.max(1, Math.round(cleanupLengthWeeks))
    : null;
  const showLengthWording = withCleanupPlan && cleanupPlan !== null && lengthWeeks !== null;
  const wordingPlan = showLengthWording && cleanupPlan !== null && lengthWeeks !== null
    ? { ...cleanupPlan, startDate: addDaysIso(cleanupPlan.wrapUpDate, -lengthWeeks * 7) }
    : cleanupPlan;
  const monthlyStartRule = showLengthWording && wordingPlan
    ? monthlyStartLengthText({ hasCleanup: schedule.hasCleanup, plan: wordingPlan, prepaidAnnual: annual })
    : withCleanupPlan && "monthlyStartText" in schedule
      ? schedule.monthlyStartText
      : annual
        ? (schedule.hasCleanup ? ANNUAL_PREPAID_CLEANUP_START_TEXT : ANNUAL_PREPAID_START_TEXT)
        : (schedule.hasCleanup ? CLEANUP_MONTHLY_START_TEXT : NO_CLEANUP_MONTHLY_START_TEXT);
  // recurringMonthlyTotal is already discounted on an annual term; back out the undiscounted price.
  const discountFactor = annual && annualSavingsPercent > 0 && annualSavingsPercent < 100 ? 1 - annualSavingsPercent / 100 : 1;
  const grossMonthly = Math.round(recurringMonthlyTotal / discountFactor * 100) / 100;
  const grossRecurringDueNow = Math.round(grossMonthly * schedule.prepaidMonths * 100) / 100;
  const annualSavings = discountFactor < 1 ? Math.round((grossRecurringDueNow - schedule.recurringDueNow) * 100) / 100 : 0;
  const requiredTotal = requiredOneTime.reduce((total, row) => total + row.price, 0);
  const migrationOneTimeTotal = migrationOneTime && Number.isFinite(migrationOneTime.price) && migrationOneTime.price > 0
    ? migrationOneTime.price
    : 0;
  const selectedOneTimeTotal = Math.max(0, Math.round((additionalOneTimeTotal - requiredTotal - migrationOneTimeTotal) * 100) / 100);
  return (
    <section aria-label="Payment plan" className="space-y-4 text-sm text-slate-700">
      <div className="rounded-xl bg-slate-50 p-4">
        <p className="text-xs font-bold uppercase tracking-wide">Due today</p>
        <dl className="mt-3 space-y-2">
          {!schedule.hasCleanup ? <div className="flex justify-between gap-3"><dt>{annual ? `${schedule.prepaidMonths} months of service` : "First month of service"}</dt><dd>{fmt(annualSavings > 0 ? grossRecurringDueNow : schedule.recurringDueNow)}</dd></div> : null}
          {!schedule.hasCleanup && annualSavings > 0 ? <div className="flex justify-between gap-3 rounded bg-emerald-100 px-2 py-1 font-semibold text-emerald-800"><dt>{`12-month agreement savings (${annualSavingsPercent}%)`}</dt><dd>{`-${fmt(annualSavings)}`}</dd></div> : null}
          {onboardingFee > 0 ? (
            <div className="flex justify-between gap-3"><dt>{schedule.hasCleanup ? "Onboarding + Discovery" : "Onboarding"}</dt><dd>{fmt(onboardingFee)}</dd></div>
          ) : (
            <div className="flex items-center justify-between gap-3 rounded bg-emerald-100 px-2 py-1 font-semibold text-emerald-800">
              <dt>{schedule.hasCleanup ? "Onboarding + Discovery" : "Onboarding"}</dt>
              <dd>{originalOnboardingFee && originalOnboardingFee > 0 ? <span className="mr-1.5 font-normal text-emerald-700/70 line-through">{fmt(originalOnboardingFee)}</span> : null}Waived</dd>
            </div>
          )}
          {requiredOneTime.map((row) => <div key={row.name} className="flex justify-between gap-3"><dt>{row.name}</dt><dd>{fmt(row.price)}</dd></div>)}
          {migrationOneTimeTotal > 0 && migrationOneTime ? <div className="flex justify-between gap-3"><dt>{migrationOneTime.name}</dt><dd>{fmt(migrationOneTime.price)}</dd></div> : null}
          {selectedOneTimeTotal > 0 ? <div className="flex justify-between gap-3"><dt>Selected one-time add-ons</dt><dd>{fmt(selectedOneTimeTotal)}</dd></div> : null}
          {schedule.creditApplied > 0 ? <div className="flex justify-between gap-3 rounded bg-emerald-100 px-2 py-1 font-semibold text-emerald-800"><dt>{creditLabel}</dt><dd>{`-${fmt(schedule.creditApplied)}`}</dd></div> : null}
          <div className="flex justify-between gap-3 border-t border-slate-200 pt-2 font-bold"><dt>Total due today</dt><dd>{fmt(amountDueNow ?? schedule.amountDueNow)}</dd></div>
        </dl>
      </div>
      {schedule.hasCleanup ? (
        <div className="rounded-xl border border-slate-200 p-4">
          <p className="font-semibold">Estimated cleanup — later</p>
          <p className="mt-2">{cleanupMonths} {cleanupMonths === 1 ? "month" : "months"} × {fmt(cleanupMonthlyRate)}/month = <strong>{fmt(schedule.cleanupTotal)}</strong></p>
          {cleanupComplexityAdd > 0 ? <p className="mt-1">Complexity adjustment: {fmt(cleanupComplexityAdd)}</p> : null}
          {cleanupComplexityAdd > 0 ? <p className="mt-1">Estimated cleanup total: <strong>{fmt(schedule.cleanupTotal + cleanupComplexityAdd)}</strong></p> : null}
          <p className="mt-2 text-xs leading-5 text-slate-600">Estimate only. Final scope, price, and payment milestones require your approval after discovery. Not charged today.</p>
          {withCleanupPlan && wordingPlan ? (
            <div className="mt-3 border-t border-slate-200 pt-3 text-xs leading-5 text-slate-600">
              <CleanupTermsBlock
                plan={wordingPlan}
                installments={planInstallments}
                monthlyRate={recurringMonthlyTotal}
                brandName={brandName}
                annual={annual}
                isEstimate={cleanupIsEstimate}
                dateWording={showLengthWording ? "length" : "exact"}
                mentionFileFee={mentionFileFee}
              />
            </div>
          ) : null}
        </div>
      ) : null}
      <div>
        <p className="font-semibold">Ongoing service: {discountFactor < 1 ? <span className="mr-1 font-normal text-slate-400 line-through">{fmt(grossMonthly)}</span> : null}{fmt(recurringMonthlyTotal)}/month</p>
        {annual ? <p className="mt-1">{fmt(recurringMonthlyTotal)} × 12 months = <strong>{fmt(schedule.annualTotal)}</strong></p> : null}
        {annual && !schedule.hasCleanup ? <p className="mt-1 text-xs text-slate-600">12-month commitment, paid in full today. Excludes onboarding, cleanup, and one-time add-ons.</p> : null}
        {annual && schedule.hasCleanup ? <p className="mt-1 text-xs text-slate-600">12-month commitment, not due today. Billed when monthly service begins after cleanup is complete. Excludes onboarding, cleanup, and one-time add-ons.</p> : null}
        <p className="mt-2 text-xs leading-5 text-slate-600">{monthlyStartRule}</p>
      </div>
      {showStages ? (
        <div className="rounded-xl border border-slate-200 p-4">
          <h3 className="font-semibold">What happens next</h3>
          <ol className="mt-3 list-decimal space-y-3 pl-5 text-sm leading-6">
            <li><strong>Onboarding{schedule.hasCleanup ? " + Discovery" : ""}.</strong> After payment clears (or is waived), provide account access and required records. We confirm readiness and the service schedule.</li>
            {schedule.hasCleanup ? <li><strong>Cleanup approval and delivery.</strong> {CLEANUP_APPROVAL_TEXT}</li> : null}
            <li><strong>Monthly bookkeeping.</strong> {monthlyStartRule}</li>
          </ol>
        </div>
      ) : null}
    </section>
  );
}
