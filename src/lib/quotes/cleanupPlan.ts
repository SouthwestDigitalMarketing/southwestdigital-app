// Spec 04 cleanup path contract: wrap-up date, payment plan, and clause texts.
//
// Pure and timezone-safe. Dates are ISO "yyyy-mm-dd" calendar strings; all
// math is civil-date arithmetic (no Date/UTC parsing), and display goes
// through the firm America/Chicago calendar helper zone. Quotes without an
// `assessment.cleanupPlan` snapshot key never touch this module, so legacy
// payment-schedule texts and math stay byte-identical.
import { STAFF_TIME_ZONE, staffDateKey } from "./staffDates";

export type CleanupPaymentPlan = "monthly" | "full" | "split_50_50";

export const DEFAULT_CLEANUP_PAYMENT_PLAN: CleanupPaymentPlan = "monthly";

export type CleanupPlan = {
  /** Last cleanup month, "YYYY-MM" (the cleanup end month). */
  caughtUpThrough: string;
  /** Approval date, or proposal date + 14 days when built in the builder. */
  startDate: string;
  /** Target date the books are caught up through `caughtUpThrough`. */
  wrapUpDate: string;
  wrapUpSource: "default" | "override";
  paymentPlan: CleanupPaymentPlan;
  /**
   * Set at selection time when a stored wrap-up override predated the
   * refreshed start and was reset to the default. Never published to the
   * public payload; shown to staff only.
   */
  wrapUpAdjustedAtSelection?: boolean;
};

export type CleanupInstallmentDue = "at-approval" | "monthly" | "at-completion";

export type CleanupInstallment = {
  label: string;
  amountCents: number;
  due: CleanupInstallmentDue;
  dueDate?: string;
};

/** Minimal period shape for the one month count (matches the builder type). */
export type CleanupPeriodLike = {
  id: string;
  year: number;
  startMonth: number;
  endMonth: number;
};

// ---------------------------------------------------------------------------
// Civil-date helpers (pure calendar math, no timezones involved)
// ---------------------------------------------------------------------------

const ISO_DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/;
const YEAR_MONTH_RE = /^(\d{4})-(0[1-9]|1[0-2])$/;

function isLeapYear(year: number): boolean {
  return year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
}

function daysInMonth(year: number, month: number): number {
  if (month === 2) return isLeapYear(year) ? 29 : 28;
  return [4, 6, 9, 11].includes(month) ? 30 : 31;
}

function parseIsoDate(value: unknown): [number, number, number] | null {
  if (typeof value !== "string") return null;
  const match = ISO_DATE_RE.exec(value);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (month < 1 || month > 12 || day < 1 || day > daysInMonth(year, month)) return null;
  return [year, month, day];
}

export function isIsoDateString(value: unknown): value is string {
  return parseIsoDate(value) !== null;
}

function isoString(year: number, month: number, day: number): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${String(year).padStart(4, "0")}-${pad(month)}-${pad(day)}`;
}

// Days-from-civil / civil-from-days (Howard Hinnant's algorithms).
function daysFromCivil(year: number, month: number, day: number): number {
  const y = month <= 2 ? year - 1 : year;
  const era = Math.floor(y / 400);
  const yoe = y - era * 400;
  const mp = (month + 9) % 12;
  const doy = Math.floor((153 * mp + 2) / 5) + day - 1;
  const doe = yoe * 365 + Math.floor(yoe / 4) - Math.floor(yoe / 100) + doy;
  return era * 146097 + doe - 719468;
}

function civilFromDays(z: number): [number, number, number] {
  const z2 = z + 719468;
  const era = Math.floor(z2 / 146097);
  const doe = z2 - era * 146097;
  const yoe = Math.floor((doe - Math.floor(doe / 1460) + Math.floor(doe / 36524) - Math.floor(doe / 146096)) / 365);
  const y = yoe + era * 400;
  const doy = doe - (365 * yoe + Math.floor(yoe / 4) - Math.floor(yoe / 100));
  const mp = Math.floor((5 * doy + 2) / 153);
  const day = doy - Math.floor((153 * mp + 2) / 5) + 1;
  const month = mp < 10 ? mp + 3 : mp - 9;
  return [mp < 10 ? y : y + 1, month, day];
}

export function addDaysIso(startISO: string, days: number): string {
  const parsed = parseIsoDate(startISO);
  if (!parsed) throw new Error(`Invalid ISO date: ${startISO}`);
  const [year, month, day] = parsed;
  const [y, m, d] = civilFromDays(daysFromCivil(year, month, day) + days);
  return isoString(y, m, d);
}

/** Month-end safe: Jan 31 + 1 month -> Feb 28 (Feb 29 in a leap year). */
export function addMonthsIso(startISO: string, months: number): string {
  const parsed = parseIsoDate(startISO);
  if (!parsed) throw new Error(`Invalid ISO date: ${startISO}`);
  const [year, month, day] = parsed;
  const total = year * 12 + (month - 1) + months;
  const y = Math.floor(total / 12);
  const m = (total % 12) + 1;
  return isoString(y, m, Math.min(day, daysInMonth(y, m)));
}

// ---------------------------------------------------------------------------
// Display (firm Chicago calendar; noon-UTC input is always the same Chicago day)
// ---------------------------------------------------------------------------

const longDateFmt = new Intl.DateTimeFormat("en-US", {
  timeZone: STAFF_TIME_ZONE,
  month: "long",
  day: "numeric",
  year: "numeric",
});

const monthYearFmt = new Intl.DateTimeFormat("en-US", {
  timeZone: STAFF_TIME_ZONE,
  month: "long",
  year: "numeric",
});

function utcNoonDate(year: number, month: number, day: number): Date {
  return new Date(Date.UTC(year, month - 1, day, 12));
}

export function formatWrapUpDateLong(dateISO: string): string {
  const parsed = parseIsoDate(dateISO);
  if (!parsed) throw new Error(`Invalid ISO date: ${dateISO}`);
  return longDateFmt.format(utcNoonDate(parsed[0], parsed[1], parsed[2]));
}

export function formatCaughtUpThrough(yearMonth: string): string {
  const match = YEAR_MONTH_RE.exec(yearMonth);
  if (!match) throw new Error(`Invalid year-month: ${yearMonth}`);
  return monthYearFmt.format(utcNoonDate(Number(match[1]), Number(match[2]), 1));
}

function formatCentsUsd(cents: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(cents / 100);
}

// ---------------------------------------------------------------------------
// Wrap-up date
// ---------------------------------------------------------------------------

/** start + max(30 days, ceil(backlogMonths / 3) calendar months). */
export function defaultWrapUpDate(startISO: string, backlogMonths: number): string {
  const backlog = typeof backlogMonths === "number" && Number.isFinite(backlogMonths) ? backlogMonths : 0;
  const byDays = addDaysIso(startISO, 30);
  const byMonths = addMonthsIso(startISO, Math.max(0, Math.ceil(backlog / 3)));
  return byDays > byMonths ? byDays : byMonths;
}

function validPaymentPlan(value: unknown): CleanupPaymentPlan | null {
  return value === "monthly" || value === "full" || value === "split_50_50" ? value : null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

/**
 * Tolerant normalize: unknown stored values always yield a usable plan.
 * A stored wrap-up override is kept only when it is a valid date on or
 * after the start; anything else falls back to the default.
 */
export function normalizeCleanupPlan(
  raw: unknown,
  opts: { backlogMonths: number; proposalDate?: string; approvalDate?: string; todayISO?: string },
): CleanupPlan {
  const stored = isRecord(raw) ? raw : {};
  // Firm-Chicago calendar date everywhere: a UTC slice reads a day early
  // for Chicago evenings.
  const todayISO = parseIsoDate(opts.todayISO) !== null
    ? (opts.todayISO as string)
    : staffDateKey(new Date());
  const startDate =
    parseIsoDate(stored.startDate) !== null
      ? (stored.startDate as string)
      : parseIsoDate(opts.approvalDate) !== null
        ? (opts.approvalDate as string)
        : parseIsoDate(opts.proposalDate) !== null
          ? addDaysIso(opts.proposalDate as string, 14)
          : todayISO;
  const storedWrap = typeof stored.wrapUpDate === "string" ? stored.wrapUpDate : null;
  const wrapUpDate = storedWrap !== null && parseIsoDate(storedWrap) !== null && storedWrap >= startDate ? storedWrap : null;
  return {
    caughtUpThrough:
      typeof stored.caughtUpThrough === "string" && YEAR_MONTH_RE.test(stored.caughtUpThrough) ? stored.caughtUpThrough : "",
    startDate,
    wrapUpDate: wrapUpDate ?? defaultWrapUpDate(startDate, opts.backlogMonths),
    wrapUpSource: wrapUpDate === null ? "default" : "override",
    paymentPlan: validPaymentPlan(stored.paymentPlan) ?? DEFAULT_CLEANUP_PAYMENT_PLAN,
  };
}

/**
 * The one strict Spec 04 plan validator, shared by the checkout parser, the
 * agreement reader, and (through the checkout parser) the receipt. Anything
 * unexpected — pre-plan records, hand edits, impossible calendar dates —
 * reads as no plan, so renderers never throw on stored junk.
 */
export function readCleanupPlan(value: unknown): CleanupPlan | null {
  if (!isRecord(value)) return null;
  const { caughtUpThrough, startDate, wrapUpDate, wrapUpSource, paymentPlan, wrapUpAdjustedAtSelection } = value;
  if (typeof caughtUpThrough !== "string") return null;
  if (caughtUpThrough !== "" && !YEAR_MONTH_RE.test(caughtUpThrough)) return null;
  if (typeof startDate !== "string" || !isIsoDateString(startDate)) return null;
  if (typeof wrapUpDate !== "string" || !isIsoDateString(wrapUpDate)) return null;
  if (wrapUpDate < startDate) return null;
  if (wrapUpSource !== "default" && wrapUpSource !== "override") return null;
  const validPlan = validPaymentPlan(paymentPlan);
  if (validPlan === null) return null;
  return {
    caughtUpThrough,
    startDate,
    wrapUpDate,
    wrapUpSource,
    paymentPlan: validPlan,
    ...(wrapUpAdjustedAtSelection === true ? { wrapUpAdjustedAtSelection: true as const } : {}),
  };
}

/**
 * The one strict Spec 04 installments validator, shared like
 * {@link readCleanupPlan}. Junk (negative amounts, unknown dues, malformed
 * due dates) drops the whole schedule; it never throws.
 */
export function readCleanupInstallments(value: unknown): CleanupInstallment[] | null {
  if (!Array.isArray(value) || value.length === 0) return null;
  const installments: CleanupInstallment[] = [];
  for (const item of value) {
    if (!isRecord(item)) return null;
    if (typeof item.label !== "string" || item.label.length === 0) return null;
    if (typeof item.amountCents !== "number" || !Number.isFinite(item.amountCents) || item.amountCents < 0) return null;
    if (item.due !== "at-approval" && item.due !== "monthly" && item.due !== "at-completion") return null;
    if (item.dueDate !== undefined && !isIsoDateString(item.dueDate)) return null;
    installments.push({
      label: item.label,
      amountCents: Math.round(item.amountCents),
      due: item.due,
      ...(typeof item.dueDate === "string" ? { dueDate: item.dueDate } : {}),
    });
  }
  return installments;
}

/**
 * "Caught up through" for a stored checkout: the end month of the latest
 * SELECTED cleanup period ("YYYY-MM"), or "" when nothing parseable was
 * selected. Keys match the checkout selection format "year-startMonth-endMonth".
 */
export function caughtUpThroughFromSelectedKeys(selectedKeys: readonly string[]): string {
  let best: [number, number] | null = null;
  for (const key of new Set(selectedKeys)) {
    if (typeof key !== "string") continue;
    const parts = key.split("-");
    if (parts.length !== 3) continue;
    const year = Number(parts[0]);
    const endMonth = Number(parts[2]);
    if (!Number.isInteger(year) || !Number.isInteger(endMonth) || endMonth < 1 || endMonth > 12) continue;
    if (!best || year * 12 + endMonth > best[0] * 12 + best[1]) best = [year, endMonth];
  }
  return best ? `${String(best[0]).padStart(4, "0")}-${String(best[1]).padStart(2, "0")}` : "";
}

/**
 * Selection-time refresh for a stored Spec 04 plan (M3). The start is the
 * selection date (firm-Chicago calendar) + 14 days — never the stale builder
 * start. A default-source wrap-up is recomputed from the new start; an
 * override is kept only when it is on/after new start + 30 days, else it
 * resets to the default and the stored plan is flagged with
 * `wrapUpAdjustedAtSelection: true` (staff only). Installment due dates cut
 * from the refreshed plan therefore always follow the refreshed start.
 */
export function refreshCleanupPlanAtSelection(
  raw: unknown,
  opts: { backlogMonths: number; selectedKeys: readonly string[]; todayISO: string },
): CleanupPlan {
  const stored = isRecord(raw) ? raw : {};
  const todayISO = parseIsoDate(opts.todayISO) !== null ? opts.todayISO : staffDateKey(new Date());
  const startDate = addDaysIso(todayISO, 14);
  const paymentPlan = validPaymentPlan(stored.paymentPlan) ?? DEFAULT_CLEANUP_PAYMENT_PLAN;
  const rawSource = stored.wrapUpSource === "override" ? "override" : "default";
  const storedWrap = typeof stored.wrapUpDate === "string" && parseIsoDate(stored.wrapUpDate) !== null
    ? stored.wrapUpDate
    : null;
  const keepOverride = rawSource === "override"
    && storedWrap !== null
    && storedWrap >= addDaysIso(startDate, 30);
  return {
    caughtUpThrough: caughtUpThroughFromSelectedKeys(opts.selectedKeys),
    startDate,
    wrapUpDate: keepOverride && storedWrap !== null ? storedWrap : defaultWrapUpDate(startDate, opts.backlogMonths),
    wrapUpSource: keepOverride ? "override" : "default",
    paymentPlan,
    ...(rawSource === "override" && storedWrap !== null && !keepOverride
      ? { wrapUpAdjustedAtSelection: true as const }
      : {}),
  };
}

// ---------------------------------------------------------------------------
// Installments
// ---------------------------------------------------------------------------

/** Number of monthly payments: max(1, ceil(calendar months between)). */
export function monthsBetween(startISO: string, wrapUpISO: string): number {
  const start = parseIsoDate(startISO);
  const end = parseIsoDate(wrapUpISO);
  if (!start || !end) return 1;
  if (wrapUpISO <= startISO) return 1;
  const diff = (end[0] - start[0]) * 12 + (end[1] - start[1]) + (end[2] > start[2] ? 1 : 0);
  return Math.max(1, diff);
}

/**
 * Installment schedule for a cleanup total. Amounts are whole cents and
 * always sum to the total: monthly splits are equal with the LAST absorbing
 * the remainder; 50/50 rounds the first half down to the cent.
 */
export function buildCleanupInstallments(totalCents: number, plan: CleanupPlan): CleanupInstallment[] {
  const total = Math.max(0, Math.round(typeof totalCents === "number" && Number.isFinite(totalCents) ? totalCents : 0));
  if (plan.paymentPlan === "full") {
    return [{ label: "Cleanup payment in full", amountCents: total, due: "at-approval", dueDate: plan.startDate }];
  }
  if (plan.paymentPlan === "split_50_50") {
    const first = Math.floor(total / 2);
    return [
      { label: "Cleanup payment 1 of 2 — due at approval", amountCents: first, due: "at-approval", dueDate: plan.startDate },
      {
        label: "Cleanup payment 2 of 2 — due at completion",
        amountCents: total - first,
        due: "at-completion",
      },
    ];
  }
  const count = monthsBetween(plan.startDate, plan.wrapUpDate);
  if (count === 1) {
    return [{ label: "Cleanup installment 1 of 1", amountCents: total, due: "monthly", dueDate: plan.startDate }];
  }
  const base = Math.floor(total / count);
  return Array.from({ length: count }, (_, i) => ({
    label: `Cleanup installment ${i + 1} of ${count}`,
    amountCents: i < count - 1 ? base : total - base * (count - 1),
    due: "monthly" as const,
    dueDate: addMonthsIso(plan.startDate, i),
  }));
}

// ---------------------------------------------------------------------------
// Texts (exact; shared by the proposal terms and the agreement builder)
// ---------------------------------------------------------------------------

/** "We will have your books caught up through <Month YYYY> by <Month D, YYYY>." */
export function cleanupWrapUpText(plan: CleanupPlan): string {
  const by = formatWrapUpDateLong(plan.wrapUpDate);
  if (plan.caughtUpThrough && YEAR_MONTH_RE.test(plan.caughtUpThrough)) {
    return `We will have your books caught up through ${formatCaughtUpThrough(plan.caughtUpThrough)} by ${by}.`;
  }
  return `We will have your books caught up by ${by}.`;
}

/**
 * Whole weeks between the plan start and wrap-up, rounded up (ceil of
 * days / 7), with a floor of 1. Pre-selection surfaces show this length
 * ("about N weeks after you accept") instead of the wrap-up calendar date,
 * which would go stale between the builder preview and the client selecting.
 */
export function cleanupWeeksBetween(startISO: string, wrapUpISO: string): number {
  const start = parseIsoDate(startISO);
  const end = parseIsoDate(wrapUpISO);
  if (!start || !end) return 1;
  const days = daysFromCivil(end[0], end[1], end[2]) - daysFromCivil(start[0], start[1], start[2]);
  return Math.max(1, Math.ceil(days / 7));
}

function weeksAfterAccept(weeks: number): string {
  return `about ${weeks} ${weeks === 1 ? "week" : "weeks"} after you accept`;
}

/**
 * Pre-selection wrap-up line: the caught-up-through month plus the cleanup
 * length, never a calendar date. Post-selection (stored checkout plan) keeps
 * {@link cleanupWrapUpText} with its exact date.
 */
export function cleanupWrapUpLengthText(plan: CleanupPlan): string {
  const when = weeksAfterAccept(cleanupWeeksBetween(plan.startDate, plan.wrapUpDate));
  if (plan.caughtUpThrough && YEAR_MONTH_RE.test(plan.caughtUpThrough)) {
    return `We will have your books caught up through ${formatCaughtUpThrough(plan.caughtUpThrough)} ${when}.`;
  }
  return `We will have your books caught up ${when}.`;
}

export function monthlyStartText(input: {
  hasCleanup: boolean;
  plan?: CleanupPlan | null;
  prepaidAnnual?: boolean;
}): string {
  const annual = input.prepaidAnnual === true;
  if (input.plan) {
    const when = `${formatWrapUpDateLong(input.plan.wrapUpDate)} or when cleanup is complete, whichever comes first`;
    return annual
      ? `Your 12 months of service begin on ${when}.`
      : `Monthly service and billing begin on ${when}.`;
  }
  if (!input.hasCleanup) {
    return annual
      ? "Today's payment covers your first 12 months of service in full. We confirm your service start date during onboarding; your next payment is due 12 months after that date."
      : "Today's payment includes your first month. We confirm your service start date during onboarding; the next monthly payment is due one month after that date.";
  }
  return annual
    ? "Your 12 months of service are billed on the start date confirmed with you after approved cleanup is complete. The annual service payment is not due today."
    : "Monthly service and billing begin on the start date confirmed with you after approved cleanup is complete. Your first monthly payment is not due today.";
}

/**
 * Pre-selection monthly-start rule: the same rule as {@link monthlyStartText}
 * with the plan branch reading the cleanup length instead of the wrap-up
 * calendar date. Without a plan there is no date to go stale, so the legacy
 * wording is reused unchanged.
 */
export function monthlyStartLengthText(input: {
  hasCleanup: boolean;
  plan?: CleanupPlan | null;
  prepaidAnnual?: boolean;
}): string {
  if (!input.plan) return monthlyStartText(input);
  const annual = input.prepaidAnnual === true;
  const when = `${weeksAfterAccept(cleanupWeeksBetween(input.plan.startDate, input.plan.wrapUpDate))}, or when cleanup is complete, whichever comes first`;
  return annual
    ? `Your 12 months of service begin ${when}.`
    : `Monthly service and billing begin ${when}.`;
}

/** One-line description of how the cleanup total is paid. */
export function cleanupPaymentPlanText(plan: CleanupPlan, installments: CleanupInstallment[]): string {
  const amounts = installments.map((i) => i.amountCents);
  const total = amounts.reduce((sum, cents) => sum + cents, 0);
  if (plan.paymentPlan === "full") {
    return `Cleanup is paid in full at approval: ${formatCentsUsd(total)} due when cleanup is approved.`;
  }
  if (plan.paymentPlan === "split_50_50") {
    const [first = 0, second = 0] = amounts;
    return `Cleanup is split into two payments: ${formatCentsUsd(first)} due at approval and ${formatCentsUsd(second)} due when cleanup is complete.`;
  }
  if (installments.length <= 1) {
    return `Cleanup is paid in one installment of ${formatCentsUsd(total)}.`;
  }
  const first = amounts[0] ?? 0;
  const last = amounts[amounts.length - 1] ?? 0;
  if (first === last) {
    return `Cleanup is paid in ${installments.length} monthly installments of ${formatCentsUsd(first)}.`;
  }
  return `Cleanup is paid in ${installments.length} monthly installments of ${formatCentsUsd(first)}, with a final installment of ${formatCentsUsd(last)}.`;
}

/**
 * Single extension-clause source for the agreement builder and proposal
 * terms: client-caused delay past wrap-up bills the monthly service rate
 * (replacing, never stacking with, the $150 file-maintenance fee for that
 * month); delay we cause moves the wrap-up date free.
 */
export function cleanupExtensionClauseText(input: { monthlyRate: number; brandName: string; mentionFileFee?: boolean }): string {
  const rate = new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(Math.max(0, input.monthlyRate));
  return (
    `If cleanup runs past the wrap-up date because documents, access, or answers from you were missing or late, ` +
    `each month past the wrap-up date is billed at the monthly service rate (currently ${rate}) until cleanup is complete. ` +
    // The $150 file-maintenance fee is named only when the agreement carrying
    // this clause charges it; custom templates without that sentence get
    // generic wording so the clause never dangles.
    (input.mentionFileFee === false
      ? `For any month billed under this clause, the monthly service rate replaces any file-maintenance fee for that month — ` +
        `the two are never charged together for the same month. `
      : `For any month billed under this clause, the monthly service rate replaces the $150 file-maintenance fee — ` +
        `the two are never charged together for the same month. `) +
    `If the delay is caused by ${input.brandName}, there is no extra charge and the wrap-up date moves.`
  );
}

// ---------------------------------------------------------------------------
// Month count
// ---------------------------------------------------------------------------

/**
 * The one cleanup month count to use whenever a cleanupPlan exists: the sum
 * of selected periods, inclusive (endMonth - startMonth + 1 each). Keys match
 * the checkout selection format "year-startMonth-endMonth" (falling back to
 * the period id); unknown keys and invalid periods contribute 0.
 */
export function cleanupMonthsFromSelectedPeriods(
  periods: readonly CleanupPeriodLike[],
  selectedKeys: readonly string[],
): number {
  const byKey = new Map<string, CleanupPeriodLike>();
  for (const period of periods) {
    if (!period || typeof period !== "object") continue;
    byKey.set(`${period.year}-${period.startMonth}-${period.endMonth}`, period);
    if (period.id) byKey.set(period.id, period);
  }
  const seen = new Set<CleanupPeriodLike>();
  let total = 0;
  for (const key of new Set(selectedKeys)) {
    const period = byKey.get(key);
    if (!period || seen.has(period)) continue;
    seen.add(period);
    const { startMonth, endMonth } = period;
    if (
      !Number.isInteger(startMonth) ||
      !Number.isInteger(endMonth) ||
      startMonth < 1 ||
      endMonth < startMonth ||
      endMonth > 12
    ) {
      continue;
    }
    total += endMonth - startMonth + 1;
  }
  return total;
}
