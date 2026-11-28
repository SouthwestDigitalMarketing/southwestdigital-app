// Spec 04 builder state rules for `assessment.cleanupPlan`.
//
// Creation rule (so old drafts are never silently changed on open): a plan
// exists only after explicit staff interaction — toggling "books over two
// months behind" on with periods present, adding/editing cleanup periods, or
// the wrap-up card's own "Add wrap-up plan" button. Loading, rendering, and
// publishing never create or heal a plan: a draft without one snapshots,
// prices, and reads exactly as today (legacy).
//
// Refresh rule: period edits update `caughtUpThrough` (last selected period
// end) and recompute the wrap-up default, but a staff override is kept until
// staff reset it. Clearing every period drops the plan — no cleanup, no plan.

import {
  defaultWrapUpDate,
  isIsoDateString,
  normalizeCleanupPlan,
  type CleanupPaymentPlan,
  type CleanupPlan,
} from "@/lib/quotes/cleanupPlan";

export type CleanupPeriodInput = {
  year: number;
  startMonth: number;
  endMonth: number;
};

function isValidPeriod(period: CleanupPeriodInput): boolean {
  return (
    Number.isInteger(period.startMonth) &&
    Number.isInteger(period.endMonth) &&
    period.startMonth >= 1 &&
    period.endMonth >= period.startMonth &&
    period.endMonth <= 12
  );
}

/** Total backlog months across valid periods (inclusive per period). */
export function cleanupBacklogMonths(periods: readonly CleanupPeriodInput[]): number {
  return periods.reduce(
    (total, period) => total + (isValidPeriod(period) ? period.endMonth - period.startMonth + 1 : 0),
    0,
  );
}

/** "YYYY-MM" of the last selected period end, or "" when there is none. */
export function lastCleanupPeriodEnd(periods: readonly CleanupPeriodInput[]): string {
  let latest = "";
  for (const period of periods) {
    if (!isValidPeriod(period)) continue;
    const key = `${period.year}-${String(period.endMonth).padStart(2, "0")}`;
    if (key > latest) latest = key;
  }
  return latest;
}

/**
 * Create a fresh plan for newly configured cleanup. The builder has no
 * proposal date field, so "proposal date + 14 days" is today + 14 days
 * (pass `todayISO` in tests for a fixed start).
 */
export function ensureCleanupPlan(
  raw: unknown,
  periods: readonly CleanupPeriodInput[],
  opts: { todayISO?: string } = {},
): CleanupPlan {
  return normalizeCleanupPlan(
    { ...(typeof raw === "object" && raw !== null ? raw : {}), caughtUpThrough: lastCleanupPeriodEnd(periods) },
    { backlogMonths: cleanupBacklogMonths(periods), todayISO: opts.todayISO },
  );
}

/**
 * Next plan after a period edit. Null stays null (never auto-create here);
 * an existing plan keeps its start, override, and payment choice, only the
 * caught-up-through month follows the periods and the default wrap-up is
 * recomputed from the new backlog. Empty periods drop the plan.
 */
export function refreshCleanupPlanForPeriods(
  plan: CleanupPlan | null | undefined,
  periods: readonly CleanupPeriodInput[],
  opts: { todayISO?: string } = {},
): CleanupPlan | null {
  if (!plan) return null;
  if (periods.filter(isValidPeriod).length === 0) return null;
  const backlogMonths = cleanupBacklogMonths(periods);
  const caughtUpThrough = lastCleanupPeriodEnd(periods);
  if (plan.wrapUpSource === "default") {
    // Drop the stored date so the default recomputes from the new backlog.
    const { startDate, paymentPlan } = plan;
    return normalizeCleanupPlan(
      { caughtUpThrough, startDate, paymentPlan },
      { backlogMonths, todayISO: opts.todayISO },
    );
  }
  return normalizeCleanupPlan({ ...plan, caughtUpThrough }, { backlogMonths, todayISO: opts.todayISO });
}

/**
 * Next plan after a cleanup-periods change in the builder: create on first
 * configuration, refresh an existing plan, drop when periods are gone.
 * Drafts that merely load (no edit) never reach this function.
 */
export function nextCleanupPlanOnPeriodsChange(
  current: CleanupPlan | null | undefined,
  periods: readonly CleanupPeriodInput[],
  opts: { booksOverTwoMonthsBehind: boolean; todayISO?: string },
): CleanupPlan | null {
  if (periods.filter(isValidPeriod).length === 0) return null;
  if (current) return refreshCleanupPlanForPeriods(current, periods, opts);
  if (!opts.booksOverTwoMonthsBehind) return null;
  return ensureCleanupPlan(current, periods, opts);
}

/** Commit a staff-edited wrap-up date; invalid or pre-start dates are ignored. */
export function setCleanupWrapUpOverride(
  plan: CleanupPlan,
  dateISO: string,
  periods: readonly CleanupPeriodInput[],
): CleanupPlan {
  if (!isIsoDateString(dateISO) || dateISO < plan.startDate) return plan;
  return normalizeCleanupPlan(
    { ...plan, wrapUpDate: dateISO },
    { backlogMonths: cleanupBacklogMonths(periods) },
  );
}

/** Drop the staff override and recompute the default from current backlog. */
export function resetCleanupWrapUp(
  plan: CleanupPlan,
  periods: readonly CleanupPeriodInput[],
): CleanupPlan {
  const { startDate, paymentPlan, caughtUpThrough } = plan;
  return normalizeCleanupPlan(
    { caughtUpThrough, startDate, paymentPlan },
    { backlogMonths: cleanupBacklogMonths(periods) },
  );
}

/** Change the payment plan; unknown values keep the current choice. */
export function setCleanupPaymentPlan(
  plan: CleanupPlan,
  paymentPlan: string,
  periods: readonly CleanupPeriodInput[],
): CleanupPlan {
  const valid: CleanupPaymentPlan | null =
    paymentPlan === "monthly" || paymentPlan === "full" || paymentPlan === "split_50_50" ? paymentPlan : null;
  if (!valid) return plan;
  return normalizeCleanupPlan(
    { ...plan, paymentPlan: valid },
    { backlogMonths: cleanupBacklogMonths(periods) },
  );
}

/** Default wrap-up for display before a plan exists (same math as creation). */
export function previewDefaultWrapUpDate(startISO: string, periods: readonly CleanupPeriodInput[]): string {
  return defaultWrapUpDate(startISO, cleanupBacklogMonths(periods));
}
