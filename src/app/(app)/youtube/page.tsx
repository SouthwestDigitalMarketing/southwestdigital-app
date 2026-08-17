import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { resolveBrand } from "@/lib/brands/resolve";
import { MembershipStatus } from "@prisma/client";
import {
  getChannelMetrics,
  getDailyViewsByVideo,
  getTopVideos,
  type ChannelMetrics,
  type TopVideoRow,
  type DailyViewByVideoRow,
} from "@/lib/youtube/analytics";
import { YouTubeTrendChart, type VideoSegment, type StackedDayRow, TOP_N, VIDEO_COLORS, OTHER_COLOR } from "./YouTubeTrendChart";

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

  const theme = await prisma.brandTheme.findUnique({
    where: { brandId: brand.id },
    select: {
      youtubeChannelId: true,
      monthlyViewsGoal: true,
      youtubeWatchPercentageGoal: true,
      primaryColor: true,
    },
  });

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

  const now = Date.now();
  const endDate = new Date(now).toISOString().slice(0, 10);
  const startDate = new Date(now - 29 * 86400000).toISOString().slice(0, 10);
  const rangeLabel = `${new Date(startDate + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" })} – ${new Date(endDate + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" })}`;

  let metrics: ChannelMetrics | null = null;
  let dailyByVideo: DailyViewByVideoRow[] = [];
  let topVideos: TopVideoRow[] = [];
  let error: string | null = null;

  try {
    [metrics, dailyByVideo, topVideos] = await Promise.all([
      getChannelMetrics(channelId, refreshToken, startDate, endDate),
      getDailyViewsByVideo(channelId, refreshToken, startDate, endDate),
      getTopVideos(channelId, refreshToken, startDate, endDate),
    ]);
  } catch (err) {
    console.error("[youtube] API error:", err);
    error = err instanceof Error ? err.message : String(err);
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
    new Date(now - (29 - i) * 86400000).toISOString().slice(0, 10),
  );
  const topVideoIds = topVideos.slice(0, TOP_N).map((v) => v.videoId);
  const dateMap = new Map<string, Record<string, number>>();
  for (const date of allDates) dateMap.set(date, {});
  let hasOther = false;
  for (const { date, videoId, views } of dailyByVideo) {
    if (!dateMap.has(date)) dateMap.set(date, {});
    const day = dateMap.get(date)!;
    if (topVideoIds.includes(videoId)) {
      day[videoId] = (day[videoId] ?? 0) + views;
    } else {
      day["other"] = (day["other"] ?? 0) + views;
      hasOther = true;
    }
  }
  const stackedRows: StackedDayRow[] = allDates.map((date) => ({ date, ...(dateMap.get(date) ?? {}) }));
  const segments: VideoSegment[] = [
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
        <p className="mt-1 text-sm text-slate-500">{rangeLabel} — rolling 30 days</p>
      </div>

      {/* Goal cards */}
      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <GoalCard
          label="Views"
          value={metrics.views.toLocaleString("en-US")}
          goalLabel={`of ${viewsGoal.toLocaleString("en-US")} goal`}
          pct={viewsPct}
        />
        <GoalCard
          label="Avg View Percentage"
          value={`${metrics.averageViewPercentage.toFixed(1)}%`}
          goalLabel={`goal: ${watchPctGoal}%`}
          pct={watchPct}
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
      </div>

      {/* Top videos */}
      <div className="mt-6 rounded-xl border border-slate-200 bg-white p-5">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Top Videos</p>
        <h2 className="mt-1 text-lg font-semibold text-slate-900">Most viewed this period</h2>
        <TopVideosTable videos={topVideos} />
      </div>
    </div>
  );
}

function goalColors(pct: number) {
  if (pct >= 100) return { bar: "#10b981", text: "text-emerald-600" };
  if (pct >= 70) return { bar: "#f59e0b", text: "text-amber-600" };
  return { bar: "#f43f5e", text: "text-rose-600" };
}

function GoalCard({
  label,
  value,
  goalLabel,
  pct,
}: {
  label: string;
  value: string;
  goalLabel: string;
  pct: number;
}) {
  const capped = Math.min(100, pct);
  const met = pct >= 100;
  const { bar, text } = goalColors(pct);

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-6">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</p>
      <div className="mt-3 flex items-end justify-between gap-4">
        <p className="text-4xl font-semibold tabular-nums text-slate-900">{value}</p>
        <p className={`mb-1 text-xl font-bold tabular-nums ${text}`}>{Math.round(pct)}%</p>
      </div>
      <p className="mt-1 text-sm text-slate-400">{goalLabel}</p>
      <div className="mt-4 h-3 w-full overflow-hidden rounded-full bg-slate-100">
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{ width: `${capped}%`, backgroundColor: bar }}
        />
      </div>
      {met && (
        <p className={`mt-2 text-xs font-semibold ${text}`}>Goal met!</p>
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
