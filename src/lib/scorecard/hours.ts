/**
 * Business hours for the Scorecard (docs/scorecard.md § Business hours).
 * Response times count only the seconds that fall inside these hours, in the
 * firm's own time zone, so a text that arrives Friday at 5:30pm and is
 * answered Monday at 8:10am took 10 business minutes.
 *
 * No holidays yet. The window (8am to 5pm) never touches the 2am daylight
 * saving change, so a business day is always 9 hours long; the instants of
 * each day's open and close come from schedule.ts, which handles the offset.
 */
import { firmDateKey, firmInstant } from "@/lib/operations/schedule";

export const BUSINESS_HOURS = {
  timeZone: "America/Chicago",
  /** 1 = Monday ... 5 = Friday. */
  weekdays: [1, 2, 3, 4, 5],
  openHour: 8,
  closeHour: 17,
  label: "Mon–Fri 8am–5pm Central",
} as const;

const DAY_SECONDS = (BUSINESS_HOURS.closeHour - BUSINESS_HOURS.openHour) * 3600;

function addDays(dateKey: string, days: number): string {
  const [y, m, d] = dateKey.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10);
}

/** 0 = Sunday ... 6 = Saturday, of a calendar date key (no time zone involved). */
function weekdayOf(dateKey: string): number {
  const [y, m, d] = dateKey.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
}

function isBusinessDay(dateKey: string): boolean {
  return (BUSINESS_HOURS.weekdays as readonly number[]).includes(weekdayOf(dateKey));
}

/** Seconds of [start, end] inside the business window of one firm-local day. */
function overlapOnDay(dateKey: string, start: number, end: number): number {
  if (!isBusinessDay(dateKey)) return 0;
  const open = firmInstant(dateKey, BUSINESS_HOURS.openHour).getTime();
  const close = firmInstant(dateKey, BUSINESS_HOURS.closeHour).getTime();
  const from = Math.max(start, open);
  const to = Math.min(end, close);
  return to > from ? Math.floor((to - from) / 1000) : 0;
}

/**
 * Business seconds between two instants. 0 when end is not after start.
 * The first and last firm-local days are clipped to the exact times; every
 * whole day in between counts 9 hours if it is a weekday.
 */
export function businessSecondsBetween(start: Date, end: Date): number {
  const a = start.getTime();
  const b = end.getTime();
  if (!Number.isFinite(a) || !Number.isFinite(b) || b <= a) return 0;
  const firstKey = firmDateKey(start);
  const lastKey = firmDateKey(end);
  if (firstKey === lastKey) return overlapOnDay(firstKey, a, b);
  let total = overlapOnDay(firstKey, a, b) + overlapOnDay(lastKey, a, b);
  for (let key = addDays(firstKey, 1); key < lastKey; key = addDays(key, 1)) {
    if (isBusinessDay(key)) total += DAY_SECONDS;
  }
  return total;
}

/** Clock seconds between two instants, never negative. */
export function clockSecondsBetween(start: Date, end: Date): number {
  return Math.max(0, Math.floor((end.getTime() - start.getTime()) / 1000));
}
