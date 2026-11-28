"use client";

// Spec 04 wrap-up section inside the builder's Historical Cleanup card.
// Inputs only (no amounts): caught-up-through is read-only, the wrap-up date
// is editable (override) with a reset to the default, and the payment plan is
// a select. The parent owns creation/refresh (see cleanupPlanState.ts); this
// card only forwards explicit staff edits.

import {
  cleanupWrapUpLengthText,
  cleanupWrapUpText,
  formatCaughtUpThrough,
  formatWrapUpDateLong,
  type CleanupPaymentPlan,
  type CleanupPlan,
} from "@/lib/quotes/cleanupPlan";
import type { CleanupPeriodInput } from "./cleanupPlanState";

const INPUT_CLASS_NAME =
  "w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-base text-slate-900 shadow-sm transition focus:border-brandnavy focus:outline-none focus:ring-2 focus:ring-brandnavy/10";
const LABEL_CLASS = "text-sm font-semibold uppercase tracking-[0.08em] text-slate-500";

const PAYMENT_PLAN_OPTIONS: Array<{ value: CleanupPaymentPlan; label: string }> = [
  { value: "monthly", label: "Monthly installments (default)" },
  { value: "full", label: "Pay in full" },
  { value: "split_50_50", label: "50-50 (half at approval, half at completion)" },
];

function formatStartDate(plan: CleanupPlan): string {
  try {
    return formatWrapUpDateLong(plan.startDate);
  } catch {
    return plan.startDate;
  }
}

export default function CleanupWrapUpCard({
  plan,
  onCreatePlan,
  onWrapUpChange,
  onResetWrapUp,
  onPaymentPlanChange,
}: {
  plan: CleanupPlan | null;
  periods: readonly CleanupPeriodInput[];
  onCreatePlan: () => void;
  onWrapUpChange: (dateISO: string) => void;
  onResetWrapUp: () => void;
  onPaymentPlanChange: (paymentPlan: CleanupPaymentPlan) => void;
}) {
  if (!plan) {
    return (
      <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-4 py-3">
        <p className={LABEL_CLASS}>Cleanup wrap-up</p>
        <p className="mt-1 text-base text-slate-500">
          No wrap-up plan yet. Proposals without one render, price, and agree exactly as today.
        </p>
        <button
          type="button"
          onClick={onCreatePlan}
          className="mt-2 inline-flex items-center gap-1.5 text-base font-semibold text-brandnavy hover:underline"
        >
          Add wrap-up plan
        </button>
      </div>
    );
  }

  let caughtUpLabel = "—";
  try {
    caughtUpLabel = plan.caughtUpThrough ? formatCaughtUpThrough(plan.caughtUpThrough) : "—";
  } catch {
    caughtUpLabel = plan.caughtUpThrough || "—";
  }

  return (
    <div className="space-y-4 rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
      <div className="flex items-center justify-between gap-4">
        <p className={LABEL_CLASS}>Cleanup wrap-up</p>
        {plan.wrapUpSource === "override" ? (
          <button
            type="button"
            onClick={onResetWrapUp}
            className="inline-flex items-center gap-1.5 text-base font-semibold text-brandnavy hover:underline"
          >
            Reset to default
          </button>
        ) : null}
      </div>
      <dl className="grid gap-4 md:grid-cols-3">
        <div>
          <dt className={LABEL_CLASS}>Caught up through</dt>
          <dd className="mt-2 text-base font-semibold text-slate-900">{caughtUpLabel}</dd>
        </div>
        <div>
          <dt className={LABEL_CLASS}>Cleanup starts</dt>
          <dd className="mt-2 text-base font-semibold text-slate-900">{formatStartDate(plan)}</dd>
        </div>
        <div>
          <dt className={LABEL_CLASS}>
            <label htmlFor="cleanup-wrap-up-date">Wrap-up date{plan.wrapUpSource === "override" ? " (override)" : ""}</label>
          </dt>
          <dd className="mt-2">
            <input
              id="cleanup-wrap-up-date"
              type="date"
              value={plan.wrapUpDate}
              onChange={(event) => onWrapUpChange(event.target.value)}
              className={INPUT_CLASS_NAME}
            />
          </dd>
        </div>
      </dl>
      <div className="grid gap-2">
        <label className={LABEL_CLASS} htmlFor="cleanup-payment-plan">
          Cleanup payment plan
        </label>
        <select
          id="cleanup-payment-plan"
          value={plan.paymentPlan}
          onChange={(event) => onPaymentPlanChange(event.target.value as CleanupPaymentPlan)}
          className={INPUT_CLASS_NAME}
        >
          {PAYMENT_PLAN_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </div>
      <p className="text-base text-slate-500">{cleanupWrapUpText(plan)}</p>
      <p className="text-base text-slate-500">Client sees: {cleanupWrapUpLengthText(plan)}</p>
    </div>
  );
}
