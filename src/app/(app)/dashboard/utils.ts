/** True when the channel earned any views or watch time in the period. */
export function hasYouTubeActivity(totalViews: number, avgWatchSeconds: number): boolean {
  return totalViews > 0 || avgWatchSeconds > 0;
}
