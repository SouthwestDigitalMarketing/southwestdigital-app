/**
 * Billing-calendar countdowns for the dashboard (Tom, 2026-11-20).
 * All dates are firm-local (America/Chicago) calendar days.
 *
 * - Payday: clients pay on the 1st of the month.
 * - Invoice reminders: go out 3 days before the last day of the month
 *   (Nov 30 -> Nov 27), warning clients their invoice is coming.
 * - Late fees: clients have 7 days from the 1st (the 1st through the 7th);
 *   unpaid invoices get the late fee on the 8th. This countdown only runs
 *   from the 1st; before that it says when it starts.
 */

/** Only Bookkeeping Conroe bills on this calendar (Tom, 2026-11-20). */
export const BILLING_TIMERS_BRAND_SLUG = "bookkeeping-conroe";

export const REMINDER_DAYS_BEFORE_MONTH_END = 3;
export const LATE_FEE_GRACE_DAYS = 7;

export type BillingTimer = {
  key: "payday" | "reminders" | "late_fees";
  label: string;
  /** Days from today to `date`; 0 means today. */
  days: number;
  /** "YYYY-MM-DD" the countdown lands on. */
  date: string;
  /** false while the late-fee window has not opened yet this month. */
  running: boolean;
};

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

function nextMonth({ year, month }: Ymd): Ymd {
  return month === 12 ? { year: year + 1, month: 1, day: 1 } : { year, month: month + 1, day: 1 };
}

function reminderDay(year: number, month: number): Ymd {
  return { year, month, day: lastDayOf(year, month) - REMINDER_DAYS_BEFORE_MONTH_END };
}

/** `today` is a firm-local "YYYY-MM-DD" (see firmDateKey). */
export function billingTimers(today: string): BillingTimer[] {
  const t = parseKey(today);
  const daysTo = (d: Ymd) => serial(d) - serial(t);

  // Payday: today if it is the 1st, otherwise the next 1st.
  const payday = t.day === 1 ? t : nextMonth(t);

  // Reminders: this month's reminder day, or next month's once it has passed.
  let reminder = reminderDay(t.year, t.month);
  if (daysTo(reminder) < 0) {
    const n = nextMonth(t);
    reminder = reminderDay(n.year, n.month);
  }

  // Late fees: running from the 1st through the 7th, landing on the 8th.
  const feeDay = LATE_FEE_GRACE_DAYS + 1;
  const running = t.day <= LATE_FEE_GRACE_DAYS;
  const lateFee: Ymd = running ? { ...t, day: feeDay } : nextMonth(t);

  return [
    { key: "payday", label: "Payday", days: daysTo(payday), date: toKey(payday), running: true },
    { key: "reminders", label: "Invoice reminders go out", days: daysTo(reminder), date: toKey(reminder), running: true },
    { key: "late_fees", label: "Late fees applied", days: daysTo(lateFee), date: toKey(lateFee), running },
  ];
}
