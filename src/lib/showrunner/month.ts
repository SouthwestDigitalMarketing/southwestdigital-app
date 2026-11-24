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

/** This week so far, Sunday through today (the Sunday wrap-up's week), same shape as thisMonth. */
export function thisWeek(now: Date) {
  const today = centralDate(now);
  const weekday = new Date(`${today}T12:00:00Z`).getUTCDay(); // 0 = Sunday
  const start = new Date(Date.parse(`${today}T12:00:00Z`) - weekday * DAY).toISOString().slice(0, 10);
  const settled = new Date(Date.parse(`${today}T12:00:00Z`) - ANALYTICS_LAG_DAYS * DAY).toISOString().slice(0, 10);
  const label = `Week of ${new Date(`${start}T12:00:00Z`).toLocaleDateString("en-US", { timeZone: "UTC", month: "short", day: "numeric" })}`;
  return { month: today.slice(0, 7), label, start, today, analyticsEnd: settled >= start ? settled : null };
}

/** Midnight at the start of a Central calendar day, as an instant (handles daylight saving). */
export function centralMidnight(date: string): Date {
  for (const offset of ["-06:00", "-05:00"]) {
    const t = new Date(`${date}T00:00:00${offset}`);
    if (centralDate(t) === date && centralDate(new Date(t.getTime() - 1)) !== date) return t;
  }
  return new Date(`${date}T06:00:00Z`);
}

/** One report month: its days, the instants bounding it, and how much of it YouTube has settled. */
export function monthRange(month: string, now: Date) {
  const [y, m] = month.split("-").map(Number);
  const start = `${month}-01`;
  const last = new Date(Date.UTC(y, m, 0)).toISOString().slice(0, 10);
  const nextStart = new Date(Date.UTC(y, m, 1)).toISOString().slice(0, 10);
  const today = centralDate(now);
  const current = today.slice(0, 7) === month;
  const settled = new Date(Date.parse(`${today}T12:00:00Z`) - ANALYTICS_LAG_DAYS * DAY).toISOString().slice(0, 10);
  const analyticsEnd = settled < start ? null : settled < last ? settled : last;
  return { month, label: monthLabel(month), start, last, current, analyticsEnd,
    from: centralMidnight(start), to: current ? now : centralMidnight(nextStart) };
}
