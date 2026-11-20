/**
 * Billing-calendar countdowns for the dashboard (Tom, 2026-11-20).
 * All dates are firm-local (America/Chicago) calendar days.
 *
 * - Payday: clients pay on the 1st of the month.
 * - Invoice reminders: go out 3 days before the last day of the month
 *   (Nov 30 -> Nov 27), warning clients their invoice is coming.
 * - Late fees: clients have 7 days from the 1st (the 1st through the 7th);
 *   unpaid invoices get the late fee on the 8th.
 */

/** Only Bookkeeping Conroe bills on this calendar (Tom, 2026-11-20). */
export const BILLING_TIMERS_BRAND_SLUG = "bookkeeping-conroe";

export const REMINDER_DAYS_BEFORE_MONTH_END = 3;
export const LATE_FEE_GRACE_DAYS = 7;

export type BillingEvent = "payday" | "reminders" | "late_fees";

type Ymd = { year: number; month: number; day: number }; // month 1-12

function parseKey(key: string): Ymd {
  const [year, month, day] = key.split("-").map(Number);
  return { year, month, day };
}

function toKey({ year, month, day }: Ymd): string {
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function serial({ year, month, day }: Ymd): number {
  return Date.UTC(year, month - 1, day) / 86_400_000;
}

function lastDayOf(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

function reminderDay(year: number, month: number): Ymd {
  return { year, month, day: lastDayOf(year, month) - REMINDER_DAYS_BEFORE_MONTH_END };
}

export type BillingCalendarDay = {
  date: string; // "YYYY-MM-DD"
  day: number;
  weekday: number; // 0 = Sunday
  offset: number; // days from today; 0 = today
  event: BillingEvent | null;
  /** The 1st-7th: clients can still pay without a late fee. */
  payWindow: boolean;
};

/** One entry per day from `before` days ago to `after` days ahead of `today`. */
export function billingCalendarDays(today: string, before: number, after: number): BillingCalendarDay[] {
  const start = serial(parseKey(today));
  const days: BillingCalendarDay[] = [];
  for (let offset = -before; offset <= after; offset++) {
    const d = new Date((start + offset) * 86_400_000);
    const ymd = { year: d.getUTCFullYear(), month: d.getUTCMonth() + 1, day: d.getUTCDate() };
    const event =
      ymd.day === 1
        ? "payday"
        : ymd.day === LATE_FEE_GRACE_DAYS + 1
          ? "late_fees"
          : ymd.day === reminderDay(ymd.year, ymd.month).day
            ? "reminders"
            : null;
    days.push({
      date: toKey(ymd),
      day: ymd.day,
      weekday: d.getUTCDay(),
      offset,
      event,
      payWindow: ymd.day <= LATE_FEE_GRACE_DAYS,
    });
  }
  return days;
}
