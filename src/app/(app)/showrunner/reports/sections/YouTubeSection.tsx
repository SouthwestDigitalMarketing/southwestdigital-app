import { getChannelMetrics, getTopVideos } from "@/lib/youtube/analytics";
import { monthRange } from "@/lib/showrunner/month";
import { VideoList } from "../../VideoList";
import { Missing, Stat, reportChannel } from "./shared";

/** The month on YouTube: views against the monthly goal, watch hours, average view percentage, top videos. */
export async function YouTubeSection({ month }: { month: string }) {
  const range = monthRange(month, new Date());
  const { theme, channelId, refreshToken } = await reportChannel();
  if (!channelId || !refreshToken) return <Missing>YouTube is not connected, so there are no channel numbers.</Missing>;
  if (!range.analyticsEnd) return <Missing>YouTube has no settled days for this month yet (it reports about 3 days late).</Missing>;
  const goal = theme?.monthlyViewsGoal ?? 10000;
  const watchGoal = theme?.youtubeWatchPercentageGoal ?? 30;
  const got = await Promise.all([
    getChannelMetrics(channelId, refreshToken, range.start, range.analyticsEnd),
    getTopVideos(channelId, refreshToken, range.start, range.analyticsEnd),
  ]).then(([metrics, top]) => ({ metrics, top, error: null }), (error: unknown) => ({ metrics: null, top: [], error }));
  if (!got.metrics) {
    return <Missing>YouTube did not answer: {got.error instanceof Error ? got.error.message : String(got.error)}</Missing>;
  }
  const { metrics, top } = got;
  return (
    <div>
      <div className="grid grid-cols-3 gap-2">
        <Stat label="Views" value={metrics.views.toLocaleString("en-US")} note={`${Math.round((metrics.views / goal) * 100)}% of ${goal.toLocaleString("en-US")}`} />
        <Stat label="Watch hours" value={Math.round(metrics.estimatedMinutesWatched / 60).toLocaleString("en-US")} />
        <Stat label="Avg view" value={`${metrics.averageViewPercentage.toFixed(1)}%`} note={`goal ${watchGoal}%`} />
      </div>
      {range.current ? <p className="mt-2 text-xs text-slate-500">So far: through {new Date(`${range.analyticsEnd}T12:00:00Z`).toLocaleDateString("en-US", { timeZone: "UTC", month: "short", day: "numeric" })}.</p> : null}
      <p className="mt-4 text-xs font-semibold uppercase tracking-wide text-slate-500">Top videos</p>
      <VideoList videos={top.slice(0, 3)} empty="No views this month." />
    </div>
  );
}
