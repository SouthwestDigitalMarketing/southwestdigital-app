import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { resolveBrand } from "@/lib/brands/resolve";
import { MembershipStatus } from "@prisma/client";
import {
  getChannelMetrics,
  getDailyViews,
  getDailyViewsForVideos,
  getTopVideos,
  type ChannelMetrics,
  type TopVideoRow,
  type DailyViewByVideoRow,
} from "@/lib/youtube/analytics";
import { YouTubeTrendChart, type VideoSegment, type StackedDayRow } from "./YouTubeTrendChart";
import { TOP_N, VIDEO_COLORS, OTHER_COLOR } from "./constants";
import { YouTubeGoalCard } from "./YouTubeGoalCard";
import { getSourceTagClicksCumulative, type SourceTagClickReport } from "@/lib/cloudflare/clickSnapshots";
import { getSourceTagVideos, type SourceTagVideo } from "@/lib/youtube/sourceTagVideos";
import { DomainPurpose } from "@prisma/client";

function YouTubeIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
      <path d="M23.5 6.2a3.016 3.016 0 0 0-2.1-2.1C19.5 3.5 12 3.5 12 3.5s-7.5 0-9.4.5A3.017 3.017 0 0 0 .5 6.2C0 8.1 0 12 0 12s0 3.9.5 5.8a3.016 3.016 0 0 0 2.1 2.1c1.9.5 9.4.5 9.4.5s7.5 0 9.4-.5a3.015 3.015 0 0 0 2.1-2.1C24 15.9 24 12 24 12s0-3.9-.5-5.8zM9.5 15.6V8.4L15.8 12l-6.3 3.6z" />
    </svg>
  );
}

export const dynamic = "force-dynamic";

export default async function YouTubePage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const headersList = await headers();
  const resolved = await resolveBrand(headersList.get("x-hostname"), session.user.id);
  if (!resolved?.membership || resolved.membership.status !== MembershipStatus.ACTIVE) {
    redirect("/dashboard");
  }

  const { brand } = resolved;

  const [theme, redirectDomainRecord] = await Promise.all([
    prisma.brandTheme.findUnique({
      where: { brandId: brand.id },
      select: {
        youtubeChannelId: true,
        monthlyViewsGoal: true,
        monthlyClicksGoal: true,
        youtubeWatchPercentageGoal: true,
        primaryColor: true,
      },
    }),
    prisma.brandDomain.findFirst({
      where: { brandId: brand.id, purpose: DomainPurpose.WEBSITE, isPrimary: true },
      select: { hostname: true },
    }),
  ]);

  if (!theme?.youtubeChannelId) {
    return (
      <div className="p-8">
        <h1 className="text-2xl font-semibold text-slate-900">YouTube</h1>
        <p className="mt-4 text-sm text-slate-400">YouTube channel not configured for this brand.</p>
      </div>
    );
  }

  const slugEnvKey = `YOUTUBE_REFRESH_TOKEN_${brand.slug.toUpperCase().replace(/-/g, "_")}`;
  const refreshToken = process.env[slugEnvKey]?.trim();

  if (!refreshToken) {
    return (
      <div className="p-8">
        <h1 className="text-2xl font-semibold text-slate-900">YouTube</h1>
        <p className="mt-4 text-sm text-slate-400">YouTube credentials not configured.</p>
      </div>
    );
  }

  const channelId = theme.youtubeChannelId;
  const viewsGoal = theme.monthlyViewsGoal ?? 10000;
  const watchPctGoal = theme.youtubeWatchPercentageGoal ?? 30;
  const clicksGoal = theme.monthlyClicksGoal ?? null;
  const redirectDomain = redirectDomainRecord?.hostname ?? null;

  const now = Date.now();
  // YouTube Analytics has a ~3-day reporting lag; clip endDate so trailing days aren't empty
  const endDate = new Date(now - 3 * 86400000).toISOString().slice(0, 10);
  const startDate = new Date(now - 32 * 86400000).toISOString().slice(0, 10);
  const rangeLabel = `${new Date(startDate + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" })} – ${new Date(endDate + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" })}`;

  let metrics: ChannelMetrics | null = null;
  let dailyByVideo: DailyViewByVideoRow[] = [];
  let topVideos: TopVideoRow[] = [];
  let error: string | null = null;

  try {
    // First: headline metrics + top videos in parallel
    [metrics, topVideos] = await Promise.all([
      getChannelMetrics(channelId, refreshToken, startDate, endDate),
      getTopVideos(channelId, refreshToken, startDate, endDate),
    ]);
    // Second: per-video daily data (needs top video IDs)
    const topVideoIds = topVideos.slice(0, TOP_N).map((v) => v.videoId);
    dailyByVideo = await getDailyViewsForVideos(channelId, refreshToken, startDate, endDate, topVideoIds);
    // Fallback: if all per-video calls failed, use channel-level daily totals
    if (dailyByVideo.length === 0 && topVideoIds.length > 0) {
      console.warn("[youtube] per-video daily data empty, falling back to channel totals");
      const channelDaily = await getDailyViews(channelId, refreshToken, startDate, endDate);
      dailyByVideo = channelDaily.map(({ date, views }) => ({ date, videoId: "__total", views }));
    }
  } catch (err) {
    console.error("[youtube] API error:", err);
    error = err instanceof Error ? err.message : String(err);
  }

  // Click tracking — independent of YouTube Analytics; failures don't block the page
  let clickReport: SourceTagClickReport | null = null;
  let sourceTagMap: Map<string, SourceTagVideo> = new Map();
  if (redirectDomain) {
    try {
      [clickReport, sourceTagMap] = await Promise.all([
        getSourceTagClicksCumulative(brand.id, brand.slug),
        getSourceTagVideos(channelId, refreshToken, redirectDomain, brand.slug),
      ]);
    } catch (err) {
      console.error("[youtube] click tracking error:", err);
    }
  }

  if (error || !metrics) {
    return (
      <div className="p-8">
        <h1 className="text-2xl font-semibold text-slate-900">YouTube</h1>
        <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          {error ?? "Analytics unavailable."}
        </div>
      </div>
    );
  }

  const viewsPct = viewsGoal > 0 ? (metrics.views / viewsGoal) * 100 : 0;
  const watchPct = watchPctGoal > 0 ? (metrics.averageViewPercentage / watchPctGoal) * 100 : 0;

  // Build stacked chart data — top N videos, everything else as "other"
  const allDates = Array.from({ length: 30 }, (_, i) =>
    new Date(now - (32 - i) * 86400000).toISOString().slice(0, 10),
  );
  const topVideoIds = topVideos.slice(0, TOP_N).map((v) => v.videoId);
  const isFallbackMode = dailyByVideo.length > 0 && dailyByVideo[0].videoId === "__total";
  const dateMap = new Map<string, Record<string, number>>();
  for (const date of allDates) dateMap.set(date, {});
  let hasOther = false;
  for (const { date, videoId, views } of dailyByVideo) {
    if (!dateMap.has(date)) dateMap.set(date, {});
    const day = dateMap.get(date)!;
    if (isFallbackMode || topVideoIds.includes(videoId)) {
      day[videoId] = (day[videoId] ?? 0) + views;
    } else {
      day["other"] = (day["other"] ?? 0) + views;
      hasOther = true;
    }
  }
  const stackedRows: StackedDayRow[] = allDates.map((date) => ({ date, ...(dateMap.get(date) ?? {}) }));
  const segments: VideoSegment[] = isFallbackMode
    ? [{ videoId: "__total", title: "Total Views", color: VIDEO_COLORS[0] }]
    : [
        ...topVideoIds.map((id, i) => ({
          videoId: id,
          title: topVideos.find((v) => v.videoId === id)?.title ?? id,
          color: VIDEO_COLORS[i] ?? "#94a3b8",
        })),
        ...(hasOther ? [{ videoId: "other", title: "Other videos", color: OTHER_COLOR }] : []),
      ];

  return (
    <div className="p-8">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">YouTube</h1>
        <p className="mt-1 text-sm text-slate-500">
          {rangeLabel} · Analytics data typically lags 2–3 days
        </p>
      </div>

      {/* Goal cards */}
      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <YouTubeGoalCard
          brandId={brand.id}
          label="Views"
          value={metrics.views.toLocaleString("en-US")}
          goal={viewsGoal}
          goalLabel={`of ${viewsGoal.toLocaleString("en-US")} goal`}
          pct={viewsPct}
          field="monthlyViewsGoal"
        />
        <YouTubeGoalCard
          brandId={brand.id}
          label="Avg View Percentage"
          value={`${metrics.averageViewPercentage.toFixed(1)}%`}
          goal={watchPctGoal}
          goalLabel={`goal: ${watchPctGoal}%`}
          pct={watchPct}
          field="youtubeWatchPercentageGoal"
          description="Reported by YouTube Analytics as a view-weighted average. Each individual play contributes once — so a video with 750 views at 37% carries 750× more weight than a video with 1 view at 68%. Formula: (sum of % watched × views, across all videos) ÷ total views."
        />
      </div>

      {/* Daily trend */}
      <div className="mt-6 rounded-xl border border-slate-200 bg-white p-6">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Daily Views</p>
        <p className="mt-1 text-lg font-semibold text-slate-900">
          {metrics.views.toLocaleString("en-US")} total views
        </p>
        <div className="mt-4">
          <YouTubeTrendChart stackedRows={stackedRows} segments={segments} />
        </div>
        <div className="mt-1 flex items-center justify-end gap-4">
          <p className="text-xs text-slate-400">* The last 3 days are excluded — YouTube Analytics typically takes 2–3 days to finalize new views.</p>
          <a
            href={`https://studio.youtube.com/channel/${channelId}/analytics`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex shrink-0 items-center gap-1 text-xs text-slate-500 underline hover:text-slate-700"
          >
            <YouTubeIcon className="h-3.5 w-3.5 text-red-500" />
            YouTube Studio
          </a>
        </div>
      </div>

      {/* Top videos */}
      <div className="mt-6 rounded-xl border border-slate-200 bg-white p-5">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Top Videos</p>
        <h2 className="mt-1 text-lg font-semibold text-slate-900">Most viewed this period</h2>
        <TopVideosTable videos={topVideos} />
      </div>

      {/* Community link clicks */}
      {clickReport && (
        <div className="mt-6 rounded-xl border border-slate-200 bg-white p-5">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Community Link Clicks</p>
              <p className="mt-1 text-lg font-semibold text-slate-900">
                {clickReport.totalClicks.toLocaleString("en-US")} total clicks
              </p>
              <p className="text-xs text-slate-400">
                All time since {new Date(clickReport.epochDate + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
              </p>
            </div>
            {clicksGoal && (
              <div className="text-right">
                <p className="text-xs text-slate-400">Monthly goal</p>
                <p className="text-sm font-semibold text-slate-700">{clicksGoal.toLocaleString("en-US")}</p>
              </div>
            )}
          </div>
          <LinkClicksTable report={clickReport} sourceTagMap={sourceTagMap} redirectDomain={redirectDomain!} />
          <p className="mt-3 text-right text-xs text-slate-400">
            Cloudflare Analytics · clicks on {redirectDomain} short links
          </p>
        </div>
      )}
    </div>
  );
}


function fmtWatchTime(minutes: number): string {
  if (minutes < 60) return `${Math.round(minutes)}m`;
  const h = Math.floor(minutes / 60);
  const m = Math.round(minutes % 60);
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

function LinkClicksTable({
  report,
  sourceTagMap,
  redirectDomain,
}: {
  report: SourceTagClickReport;
  sourceTagMap: Map<string, SourceTagVideo>;
  redirectDomain: string;
}) {
  if (report.byTag.length === 0) {
    return <p className="mt-3 text-sm text-slate-400">No link clicks recorded yet.</p>;
  }
  return (
    <div className="mt-4 overflow-x-auto">
      <table className="min-w-full divide-y divide-slate-200 text-left text-sm">
        <thead>
          <tr>
            <th className="px-3 py-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Video</th>
            <th className="whitespace-nowrap px-3 py-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Link</th>
            <th className="whitespace-nowrap px-3 py-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Clicks</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {report.byTag.map(({ tag, clicks }: { tag: string; clicks: number }) => {
            const video = sourceTagMap.get(tag);
            return (
              <tr key={tag}>
                <td className="px-3 py-2">
                  {video ? (
                    <div className="flex items-center gap-3">
                      <img
                        src={video.thumbnailUrl}
                        alt={video.title}
                        width={96}
                        height={54}
                        className="shrink-0 rounded object-cover"
                      />
                      <span className="text-slate-700">{video.title}</span>
                    </div>
                  ) : (
                    <span className="text-slate-400 italic">No active video — link may be from a deleted or unlisted video</span>
                  )}
                </td>
                <td className="whitespace-nowrap px-3 py-2 font-mono text-xs text-slate-500">
                  {redirectDomain}/{tag}
                </td>
                <td className="whitespace-nowrap px-3 py-2 font-semibold text-slate-700">
                  {clicks.toLocaleString("en-US")}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function TopVideosTable({ videos }: { videos: TopVideoRow[] }) {
  if (videos.length === 0) {
    return <p className="mt-3 text-sm text-slate-400">No video data for this period.</p>;
  }
  return (
    <div className="mt-4 overflow-x-auto">
      <table className="min-w-full divide-y divide-slate-200 text-left text-sm">
        <thead>
          <tr>
            <th className="px-3 py-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Title</th>
            <th className="whitespace-nowrap px-3 py-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Views</th>
            <th className="whitespace-nowrap px-3 py-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Avg View %</th>
            <th className="whitespace-nowrap px-3 py-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Watch Time</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {videos.map((v) => (
            <tr key={v.videoId}>
              <td className="px-3 py-2">
                <div className="flex items-center gap-3">
                  <img
                    src={v.thumbnailUrl}
                    alt={v.title}
                    width={96}
                    height={54}
                    className="shrink-0 rounded object-cover"
                  />
                  <span className="text-slate-700">{v.title}</span>
                </div>
              </td>
              <td className="whitespace-nowrap px-3 py-2 text-slate-700">
                {v.views.toLocaleString("en-US")}
              </td>
              <td className="whitespace-nowrap px-3 py-2 text-slate-700">
                {v.averageViewPercentage.toFixed(1)}%
              </td>
              <td className="whitespace-nowrap px-3 py-2 text-slate-700">
                {fmtWatchTime(v.estimatedMinutesWatched)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
