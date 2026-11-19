/** True when the channel earned any views or watch time in the period. */
export function hasYouTubeActivity(totalViews: number, avgWatchSeconds: number): boolean {
  return totalViews > 0 || avgWatchSeconds > 0;
}

export type MrrSummary = {
  total: number;
  count: number;
  average: number;
};

/** Total, count, and average over per-client monthly amounts. */
export function summarizeMrr(amounts: number[]): MrrSummary {
  const count = amounts.length;
  const total = amounts.reduce((sum, value) => sum + value, 0);
  return { total, count, average: count > 0 ? total / count : 0 };
}

/**
 * Dashboard funnel step (1-5) for an open deal. A deal with no lead step goes
 * by its pipeline stage: lead -> 1, talking -> 2, proposed -> 3 (before
 * 2026-11-18 every step-less deal outside talking showed as step 3,
 * "Present to decision maker").
 */
export function funnelStepFor(step: string | null, stageKey: string): number {
  switch (step) {
    case "reach":
      return 1;
    case "qb":
    case "book":
      return 2;
    case "payment":
    case "session":
      return 4;
    case "agreement":
      return 5;
    case null:
      return stageKey === "lead" ? 1 : stageKey === "talking" ? 2 : 3;
    default:
      return 3;
  }
}
