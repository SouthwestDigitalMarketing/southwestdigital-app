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
