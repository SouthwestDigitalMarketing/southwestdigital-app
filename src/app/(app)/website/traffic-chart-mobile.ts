// Phone layout helpers for SiteTrafficGraph. Desktop never calls these.

export type TrafficBucket = {
  date: string; // first day (or hour) in the bucket
  endDate: string; // last day in the bucket; same as date for unbucketed rows
  days: number; // number of source rows in the bucket
  current: number;
  previous: number;
};

type SourceRow = { date: string; current: number; previous: number };

// More daily rows than this and a phone shows weekly bars instead (90d -> 13 bars).
export const MOBILE_MAX_DAILY_BARS = 31;

export function toBuckets(rows: SourceRow[]): TrafficBucket[] {
  return rows.map((r) => ({ date: r.date, endDate: r.date, days: 1, current: r.current, previous: r.previous }));
}

// Groups daily rows into 7-day buckets counted back from the newest day, so the
// last bar is always a full week ending today and only the oldest can be short.
export function toWeeklyBuckets(rows: SourceRow[]): TrafficBucket[] {
  const buckets: TrafficBucket[] = [];
  for (let end = rows.length; end > 0; end -= 7) {
    const slice = rows.slice(Math.max(0, end - 7), end);
    buckets.unshift({
      date: slice[0].date,
      endDate: slice[slice.length - 1].date,
      days: slice.length,
      current: slice.reduce((s, r) => s + r.current, 0),
      previous: slice.reduce((s, r) => s + r.previous, 0),
    });
  }
  return buckets;
}

function parseDay(value: string) {
  return new Date(`${value}T00:00:00`);
}

// Which x-axis labels a phone shows: about five, flat, never overlapping.
export function mobileTickVisible(
  bucket: Pick<TrafficBucket, "date">,
  index: number,
  total: number,
  mode: "daily" | "weekly" | "hourly",
): boolean {
  if (mode === "weekly") {
    const step = Math.max(1, Math.ceil(total / 5));
    return (total - 1 - index) % step === 0; // anchored on the newest week
  }
  if (mode === "hourly") {
    const step = total > 24 ? 12 : 6;
    return new Date(bucket.date).getHours() % step === 0;
  }
  if (total <= 8) return true;
  return parseDay(bucket.date).getDay() === 1; // Mondays
}

export function fmtMobileTick(
  bucket: Pick<TrafficBucket, "date">,
  index: number,
  total: number,
  mode: "daily" | "weekly" | "hourly",
): string {
  if (mode === "hourly") {
    const d = new Date(bucket.date);
    const h = d.getHours();
    if (h === 0 && total > 24) return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
    return d.toLocaleTimeString("en-US", { hour: "numeric", hour12: true }).replace(":00", "").replace(" ", "").toLowerCase();
  }
  const d = parseDay(bucket.date);
  // 7-day view labels every bar: month only on the first bar and on the 1st.
  if (mode === "daily" && total <= 8 && index > 0 && d.getDate() !== 1) return String(d.getDate());
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}
