// Plain-word formatting for the Scorecard page. Pure, so it is unit-tested.
import type { MeasureSummary, ScorecardChannel, ScorecardRange } from "@/lib/scorecard/types";

export const SCORECARD_RANGES: { value: ScorecardRange; label: string }[] = [
  { value: "today", label: "Today" },
  { value: "week", label: "This week" },
  { value: "30d", label: "30 days" },
  { value: "90d", label: "90 days" },
];

export function parseRange(raw: string | string[] | undefined): ScorecardRange {
  const value = Array.isArray(raw) ? raw[0] : raw;
  return SCORECARD_RANGES.some((r) => r.value === value) ? (value as ScorecardRange) : "week";
}

/** Reports had no trustworthy publish time before this day (docs/scorecard.md). */
export const REPORTS_TRACKING_STARTS = "2026-11-19";

/** A source not heard from in this long shows amber. */
export const STALE_SYNC_SECONDS = 15 * 60;

const MINUTE = 60;
const HOUR = 3600;
const DAY = 86400;

// One decimal, dropping a trailing ".0" ("1.5", "2").
function oneDecimal(n: number) {
  return String(Math.round(n * 10) / 10);
}

/**
 * What a span of seconds counts. "business" seconds only tick inside business
 * hours (docs/scorecard.md), so they are never turned into days: 63 business
 * hours is about 7 working days, and "2.6 days" would understate it. "clock"
 * seconds count every hour, so 24-hour days are honest there.
 */
export type DurationBasis = "business" | "clock";

/**
 * Seconds as "4 min", "1.5 h", "63 h" (business) or "2 days" (clock, from 48 h).
 * The basis is required so a business span can never be read as 24-hour days.
 */
export function formatDuration(seconds: number, basis: DurationBasis): string {
  const s = Math.max(0, seconds);
  if (s < MINUTE) return "under 1 min";
  if (s < HOUR) {
    const min = Math.round(s / MINUTE);
    return min >= 60 ? "1 h" : `${min} min`;
  }
  if (basis === "business" || s < 48 * HOUR) return `${oneDecimal(s / HOUR)} h`;
  return `${oneDecimal(s / DAY)} days`;
}

/** Clock seconds as calendar days, one decimal, like the report rows: "19 days". */
export function formatCalendarDays(seconds: number): string {
  const days = oneDecimal(Math.max(0, seconds) / DAY);
  return `${days} day${days === "1" ? "" : "s"}`;
}

/**
 * The headline figures for one measure card. Business measures lead with the
 * business-time median and add the clock median for honesty. Reports are
 * timed in calendar days (10 days after month end), so they lead with the
 * clock median and p90 in days, matching the per-report rows on the card.
 */
export function measureFigures(
  summary: Pick<MeasureSummary, "medianSeconds" | "p90Seconds" | "medianClockSeconds" | "p90ClockSeconds">,
  basis: DurationBasis,
): { median: string; p90: string; extra: [string, string][] } | null {
  if (basis === "clock") {
    if (summary.medianClockSeconds === null) return null;
    return {
      median: formatCalendarDays(summary.medianClockSeconds),
      p90: formatCalendarDays(summary.p90ClockSeconds ?? 0),
      extra: [],
    };
  }
  if (summary.medianSeconds === null) return null;
  return {
    median: formatDuration(summary.medianSeconds, "business"),
    p90: formatDuration(summary.p90Seconds ?? 0, "business"),
    extra: [
      [
        "Median on the clock",
        summary.medianClockSeconds === null ? "—" : formatDuration(summary.medianClockSeconds, "clock"),
      ],
    ],
  };
}

/** "just now", "4 min ago", "2 h ago", "3 days ago". */
export function formatAgo(iso: string, now: Date): string {
  const seconds = (now.getTime() - new Date(iso).getTime()) / 1000;
  if (!Number.isFinite(seconds)) return "never";
  if (seconds < MINUTE) return "just now";
  if (seconds < HOUR) return `${Math.floor(seconds / MINUTE)} min ago`;
  if (seconds < DAY) return `${Math.floor(seconds / HOUR)} h ago`;
  const days = Math.floor(seconds / DAY);
  return `${days} day${days === 1 ? "" : "s"} ago`;
}

export function isStale(iso: string, now: Date): boolean {
  const seconds = (now.getTime() - new Date(iso).getTime()) / 1000;
  return !Number.isFinite(seconds) || seconds > STALE_SYNC_SECONDS;
}

/** 0.873 -> "87%"; null -> "—". */
export function formatShare(share: number | null): string {
  if (share === null || !Number.isFinite(share)) return "—";
  return `${Math.round(share * 100)}%`;
}

/** The target in words: "within 1 business hour", "within 10 days of month end". */
export function targetWords(channel: ScorecardChannel, targetSeconds: number): string {
  if (channel === "report") {
    const days = Math.round(targetSeconds / DAY);
    return `within ${days} day${days === 1 ? "" : "s"} of month end`;
  }
  if (targetSeconds % HOUR === 0) {
    const hours = targetSeconds / HOUR;
    return `within ${hours} business hour${hours === 1 ? "" : "s"}`;
  }
  return `within ${formatDuration(targetSeconds, "business")} of business time`;
}

/** "2026-11-19" -> "Nov 19, 2026". */
export function formatDate(dateKey: string): string {
  return new Date(`${dateKey}T12:00:00Z`).toLocaleDateString("en-US", {
    timeZone: "UTC",
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

/** "2026-11" -> "Oct 2026" style month label for report rows. */
export function formatMonth(monthKey: string): string {
  return new Date(`${monthKey.slice(0, 7)}-15T12:00:00Z`).toLocaleDateString("en-US", {
    timeZone: "UTC",
    month: "short",
    year: "numeric",
  });
}

export const CHANNEL_LABEL: Record<ScorecardChannel, string> = {
  text: "Text",
  call: "Call",
  email: "Email",
  report: "Report",
};
