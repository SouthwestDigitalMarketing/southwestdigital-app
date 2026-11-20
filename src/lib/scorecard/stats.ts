/**
 * Scorecard statistics (docs/scorecard.md § Statistics): median and 90th
 * percentile of answered response times, never an average alone.
 */
import type { MeasureSummary } from "./types";

/**
 * Median of the values: the middle one, or the mean of the two middle ones
 * (rounded to the second) when the count is even. Null when empty.
 */
export function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((x, y) => x - y);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1 ? sorted[mid] : Math.round((sorted[mid - 1] + sorted[mid]) / 2);
}

/**
 * Nearest-rank percentile (p in 0..1): the smallest value with at least p of
 * the values at or below it, i.e. sorted[ceil(p * n) - 1]. Always one of the
 * values, so it can be pointed at. Null when empty.
 */
export function percentile(values: number[], p: number): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((x, y) => x - y);
  const rank = Math.min(sorted.length, Math.max(1, Math.ceil(p * sorted.length)));
  return sorted[rank - 1];
}

export const p90 = (values: number[]) => percentile(values, 0.9);

/** One event that needed an answer. Both spans are null while unanswered. */
export type Span = {
  businessSeconds: number | null;
  clockSeconds: number | null;
  /**
   * Unanswered only: how long it has waited so far, in the target's units.
   * An open event still inside its target is not yet a miss, so it is left
   * out of withinTargetShare. Leave undefined to count it as a miss.
   */
  waitingSeconds?: number;
};

/**
 * Summary of one measure. The target is checked against business seconds,
 * or clock seconds with `targetOn: "clock"` (reports: 10 calendar days).
 */
export function summarize(
  spans: Span[],
  targetSeconds: number,
  targetOn: "business" | "clock" = "business",
): MeasureSummary {
  const answered = spans.filter((s) => s.businessSeconds !== null || s.clockSeconds !== null);
  const business = answered.flatMap((s) => (s.businessSeconds === null ? [] : [s.businessSeconds]));
  const clock = answered.flatMap((s) => (s.clockSeconds === null ? [] : [s.clockSeconds]));
  const measured = (s: Span) => (targetOn === "clock" ? s.clockSeconds : s.businessSeconds);
  const within = answered.filter((s) => {
    const value = measured(s);
    return value !== null && value <= targetSeconds;
  }).length;
  const stillInTime = spans.filter(
    (s) => !answered.includes(s) && s.waitingSeconds !== undefined && s.waitingSeconds < targetSeconds,
  ).length;
  const judged = spans.length - stillInTime;
  return {
    count: spans.length,
    answered: answered.length,
    medianSeconds: median(business),
    p90Seconds: p90(business),
    medianClockSeconds: median(clock),
    p90ClockSeconds: p90(clock),
    withinTargetShare: spans.length === 0 ? null : judged === 0 ? null : within / judged,
    targetSeconds,
  };
}
