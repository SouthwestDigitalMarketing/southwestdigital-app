// Made-up Scorecard data for local preview only. Not real client numbers;
// the page never imports this in production (queries.ts does the real work).
import type { DailyPoint, MeasureSummary, ScorecardData, ScorecardRange } from "@/lib/scorecard/types";

const END = Date.UTC(2026, 10, 20); // 2026-11-20

// Small deterministic generator so the preview looks the same every run.
function noise(seed: number) {
  const x = Math.sin(seed * 12.9898) * 43758.5453;
  return x - Math.floor(x);
}

function dateKey(daysBack: number) {
  return new Date(END - daysBack * 86400000).toISOString().slice(0, 10);
}

function series(seed: number, baseSeconds: number, maxCount: number): DailyPoint[] {
  return Array.from({ length: 90 }, (_, i) => {
    const back = 89 - i;
    const weekday = new Date(END - back * 86400000).getUTCDay();
    const weekend = weekday === 0 || weekday === 6;
    const count = weekend ? 0 : Math.floor(noise(seed + i) * (maxCount + 1));
    if (count === 0) return { date: dateKey(back), count: 0, medianSeconds: null, p90Seconds: null };
    const median = Math.round(baseSeconds * (0.4 + noise(seed * 7 + i) * 1.4));
    return { date: dateKey(back), count, medianSeconds: median, p90Seconds: Math.round(median * (1.8 + noise(i) * 1.5)) };
  });
}

function measure(
  count: number,
  answered: number,
  medianSeconds: number | null,
  targetSeconds: number,
  withinTargetShare: number | null,
): MeasureSummary {
  return {
    count,
    answered,
    medianSeconds,
    p90Seconds: medianSeconds === null ? null : Math.round(medianSeconds * 3.2),
    medianClockSeconds: medianSeconds === null ? null : Math.round(medianSeconds * 1.6),
    p90ClockSeconds: medianSeconds === null ? null : Math.round(medianSeconds * 6),
    withinTargetShare: count === 0 ? null : withinTargetShare,
    targetSeconds,
  };
}

export function scorecardFixture(range: ScorecardRange, now: Date): ScorecardData {
  const minutesAgo = (m: number) => new Date(now.getTime() - m * 60000).toISOString();
  const calls = series(3, 2400, 3);
  return {
    range,
    from: range === "today" ? "2026-11-20" : range === "week" ? "2026-11-16" : range === "30d" ? "2026-10-22" : "2026-08-23",
    to: "2026-11-20",
    generatedAt: now.toISOString(),
    texts: measure(42, 40, 780, 3600, 0.86),
    calls: {
      incoming: 18,
      answeredLive: 11,
      missed: 7,
      voicemails: 4,
      answeredShare: 11 / 18,
      callback: measure(7, 6, 1980, 3600, 0.71),
    },
    emails: measure(23, 21, 6300, 4 * 3600, 0.74),
    // Reports: tracking only just started, so almost nothing to show.
    reports: {
      ...measure(1, 1, 4 * 86400, 10 * 86400, 1),
      days: [{ client: "Sample Client LLC", month: "2026-10", days: 19 }],
    },
    duties: {
      due: 12,
      doneOnTime: 9,
      doneLate: 2,
      notDone: 1,
      onTimeShare: 9 / 12,
      trackingStarts: "2026-11-19",
    },
    series: {
      texts: series(1, 900, 6),
      emails: series(2, 7200, 4),
      callbacks: calls,
      callsAnsweredShare: calls.map((p, i) => {
        const incoming = p.count === 0 ? 0 : p.count + 1;
        return { date: p.date, incoming, share: incoming === 0 ? null : Math.round(noise(i + 40) * incoming) / incoming };
      }),
    },
    waiting: [
      { channel: "text", contactName: "Sample Client LLC", startedAt: minutesAgo(22), businessSecondsWaiting: 22 * 60 },
      { channel: "email", contactName: "Example Rentals", startedAt: minutesAgo(200), businessSecondsWaiting: 200 * 60 },
      { channel: "call", contactName: null, startedAt: minutesAgo(1500), businessSecondsWaiting: 6 * 3600 },
    ],
    syncs: [
      { source: "quo", lastRunAt: minutesAgo(3), coveredTo: minutesAgo(3), ok: true, note: null },
      { source: "zoho", lastRunAt: minutesAgo(41), coveredTo: minutesAgo(41), ok: true, note: null },
      { source: "reports", lastRunAt: minutesAgo(8), coveredTo: null, ok: false, note: "Sample error note" },
    ],
    businessHours: { label: "Monday to Friday, 8 am to 5 pm Central" },
  };
}
