/**
 * Calendar months in Central time for Showrunner (Tom, 2026-11-24): the This Month page counts from the 1st and
 * resets each month; Reports lists one entry per month.
 */
const ZONE = "America/Chicago";
const DAY = 86_400_000;
/** YouTube Analytics settles a day's numbers about 3 days later. */
export const ANALYTICS_LAG_DAYS = 3;
/** The first month with tracked link clicks (CLICK_TRACKING_EPOCH, 2026-08-09). */
export const FIRST_REPORT_MONTH = "2026-08";

export function centralDate(now: Date): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: ZONE, year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
}

export function monthLabel(month: string): string {
  return new Date(`${month}-15T12:00:00Z`).toLocaleDateString("en-US", { timeZone: "UTC", month: "long", year: "numeric" });
}

/** This month so far: its first day, today, and the last day YouTube has settled numbers for (null in the first days). */
export function thisMonth(now: Date) {
  const today = centralDate(now);
  const month = today.slice(0, 7);
  const start = `${month}-01`;
  const settled = new Date(Date.parse(`${today}T12:00:00Z`) - ANALYTICS_LAG_DAYS * DAY).toISOString().slice(0, 10);
  return { month, label: monthLabel(month), start, today, analyticsEnd: settled >= start ? settled : null };
}

export function daysBetween(start: string, end: string): string[] {
  const out: string[] = [];
  for (let t = Date.parse(`${start}T12:00:00Z`); t <= Date.parse(`${end}T12:00:00Z`); t += DAY) {
    out.push(new Date(t).toISOString().slice(0, 10));
  }
  return out;
}

/** Every month from the first report month through this one, newest first, as "YYYY-MM". */
export function reportMonths(now: Date, first = FIRST_REPORT_MONTH): string[] {
  const out: string[] = [];
  let [y, m] = thisMonth(now).month.split("-").map(Number);
  for (;;) {
    const month = `${y}-${String(m).padStart(2, "0")}`;
    if (month < first) break;
    out.push(month);
    m -= 1;
    if (m === 0) { m = 12; y -= 1; }
  }
  return out;
}

export function isReportMonth(value: string, now: Date): boolean {
  return /^\d{4}-(0[1-9]|1[0-2])$/.test(value) && reportMonths(now).includes(value);
}
