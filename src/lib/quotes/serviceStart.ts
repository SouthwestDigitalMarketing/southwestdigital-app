// Spec 06 start-date / first-month / credit carry-over contract.
//
// Pure and timezone-safe. Months are civil "YYYY-MM" strings; defaults derive
// from the firm-Chicago calendar date (never a UTC slice), and display goes
// through the firm Chicago formatters. Snapshots without an
// `assessment.serviceStartMonth` key never touch this module, so legacy
// payment-schedule texts and math stay byte-identical.
import { STAFF_TIME_ZONE, staffDateKey } from "./staffDates";
import type { CleanupPlan } from "./cleanupPlan";

const YEAR_MONTH_RE = /^(\d{4})-(0[1-9]|1[0-2])$/;
const ISO_DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

/** "YYYY-MM" civil month. */
export function isServiceStartMonth(value: unknown): value is string {
  return typeof value === "string" && YEAR_MONTH_RE.test(value);
}

function isIsoDateString(value: unknown): value is string {
  if (typeof value !== "string") return false;
  const match = ISO_DATE_RE.exec(value);
  if (!match) return false;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (month < 1 || month > 12 || day < 1) return false;
  const leap = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  const maxDay = month === 2 ? (leap ? 29 : 28) : [4, 6, 9, 11].includes(month) ? 30 : 31;
  return day <= maxDay;
}

function finiteNumber(value: unknown, fallback = 0): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function money(value: number): number {
  return Math.round(Math.max(0, value) * 100) / 100;
}

/**
 * Tolerant normalize: a valid "YYYY-MM" passes through, anything else falls
 * back to the default — the 1st of NEXT month in the firm-Chicago calendar.
 * December rolls to January of the next year.
 */
export function normalizeServiceStartMonth(raw: unknown, opts?: { todayISO?: string }): string {
  if (isServiceStartMonth(raw)) return raw;
  const todayISO = isIsoDateString(opts?.todayISO) ? (opts?.todayISO as string) : staffDateKey(new Date());
  const year = Number(todayISO.slice(0, 4));
  const month = Number(todayISO.slice(5, 7));
  if (month === 12) return `${String(year + 1).padStart(4, "0")}-01`;
  return `${String(year).padStart(4, "0")}-${String(month + 1).padStart(2, "0")}`;
}

/** Start month for a cleanup plan: the month of the Spec 04 wrap-up date. */
export function serviceStartMonthForPlan(plan: CleanupPlan): string {
  const wrapUp = plan?.wrapUpDate;
  if (!isIsoDateString(wrapUp)) throw new Error(`Invalid wrap-up date: ${String(wrapUp)}`);
  return (wrapUp as string).slice(0, 7);
}

export type ServiceStartInput = {
  hasCleanup: boolean;
  plan?: CleanupPlan | null;
  startMonth?: string | null;
};

/**
 * With cleanup, service starts in the wrap-up month — unless staff set an
 * explicit month, which always wins. Without cleanup, the stored month wins,
 * else the default (1st of next month).
 */
export function resolveServiceStartMonth(input: ServiceStartInput, opts?: { todayISO?: string }): string {
  if (input.hasCleanup && input.plan) {
    if (isServiceStartMonth(input.startMonth)) return input.startMonth;
    return serviceStartMonthForPlan(input.plan);
  }
  return normalizeServiceStartMonth(input.startMonth, opts);
}

// ---------------------------------------------------------------------------
// Display (firm Chicago calendar; noon-UTC input is always the same Chicago day)
// ---------------------------------------------------------------------------

const monthYearFmt = new Intl.DateTimeFormat("en-US", {
  timeZone: STAFF_TIME_ZONE,
  month: "long",
  year: "numeric",
});

const monthDayYearFmt = new Intl.DateTimeFormat("en-US", {
  timeZone: STAFF_TIME_ZONE,
  month: "long",
  day: "numeric",
  year: "numeric",
});

function utcNoonDate(year: number, month: number, day: number): Date {
  return new Date(Date.UTC(year, month - 1, day, 12));
}

function serviceStartFirst(yearMonth: string): string {
  const match = YEAR_MONTH_RE.exec(yearMonth);
  if (!match) throw new Error(`Invalid year-month: ${yearMonth}`);
  return monthDayYearFmt.format(utcNoonDate(Number(match[1]), Number(match[2]), 1));
}

/** "October 2026". */
export function formatServiceStartMonth(yearMonth: string): string {
  const match = YEAR_MONTH_RE.exec(yearMonth);
  if (!match) throw new Error(`Invalid year-month: ${yearMonth}`);
  return monthYearFmt.format(utcNoonDate(Number(match[1]), Number(match[2]), 1));
}

/** "Service starts <Month 1, YYYY>. Billing is on the 1st of each month after." */
export function serviceStartText(yearMonth: string): string {
  return `Service starts ${serviceStartFirst(yearMonth)}. Billing is on the 1st of each month after.`;
}

/** Annual variant: "Your 12 months run from <Month 1, YYYY>." */
export function annualServiceStartText(yearMonth: string): string {
  return `Your 12 months run from ${serviceStartFirst(yearMonth)}.`;
}

/** The spec's one-line no-proration sentence (single source). */
export function firstMonthFullText(): string {
  return "The first month is billed in full, even if work starts mid-month, because it includes setup and account access.";
}

// ---------------------------------------------------------------------------
// Credit carry-over
// ---------------------------------------------------------------------------

export type CreditCarryover = {
  creditApplied: number;
  creditRemaining: number;
  creditRemainingReason: string;
};

/**
 * Splits a first-payment credit against today's amount: the capped deduction
 * plus the remainder for the next invoice. `amountDueNow` semantics are
 * untouched — the remainder is stored, never dropped, and applied only
 * against the next Donna-sent invoice.
 */
export function creditCarryover(input: {
  firstPaymentCredit: number;
  amountDueBeforeCredit: number;
  reason?: unknown;
}): CreditCarryover {
  const credit = money(finiteNumber(input.firstPaymentCredit));
  const due = money(finiteNumber(input.amountDueBeforeCredit));
  const creditApplied = Math.min(credit, due);
  const creditRemaining = money(credit - creditApplied);
  const creditRemainingReason = typeof input.reason === "string" ? input.reason.trim() : "";
  return { creditApplied, creditRemaining, creditRemainingReason };
}

/**
 * Strict reader for a stored carry-over (checkout services or acceptance):
 * a positive finite remainder, otherwise null — junk never throws, it reads
 * as no carry-over. A missing reason reads as "" (the amount is the
 * load-bearing fact: a remainder created by a later waiver may predate the
 * stored reason); a wrong-typed reason is junk.
 */
export function readCreditCarryover(
  value: unknown,
): { creditRemaining: number; creditRemainingReason: string } | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const record = value as Record<string, unknown>;
  const remaining = record.creditRemaining;
  const reason = record.creditRemainingReason;
  if (typeof remaining !== "number" || !Number.isFinite(remaining) || remaining <= 0) return null;
  if (reason !== undefined && typeof reason !== "string") return null;
  return {
    creditRemaining: Math.round(remaining * 100) / 100,
    creditRemainingReason: typeof reason === "string" ? reason : "",
  };
}
