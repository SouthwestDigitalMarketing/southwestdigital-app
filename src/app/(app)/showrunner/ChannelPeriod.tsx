import { prisma } from "@/lib/prisma";
import { requireAppBrand } from "@/lib/brands/staff";
import { showChannelBrand, showLinksBrand } from "@/lib/showrunner/channel-brand";
import { ANALYTICS_LAG_DAYS, daysBetween, thisMonth, thisWeek, thisYear } from "@/lib/showrunner/month";
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
import { LinkClicksTable } from "./LinkClicksTable";
import { ReleaseCalendar } from "./ReleaseCalendar";
import { getYouTubeRefreshToken } from "@/lib/youtube/credentials";
import { VideoList } from "./VideoList";
import Link from "next/link";
import { Plus } from "lucide-react";

const PERIODS: { value: Period; label: string }[] = [
  { value: "week", label: "Week" },
  { value: "month", label: "Month" },
  { value: "year", label: "Year" },
];

export function parsePeriod(value: string | string[] | undefined): Period {
  return value === "month" || value === "year" ? value : "week";
}

/**
 * The top of Overview: the New video button (Tom, 2026-11-24), the calendar, then the Week / Month / Year toggle for
 * the channel numbers below (Tom, 2026-11-25: one Overview tab instead of This Week and This Month). Videos being
 * made show in the production bar on every page.
 */
function PeriodTop({ period }: { period: Period }) {
  return (
    <>
      <Link href="/showrunner/new" className="mb-3 flex items-center justify-center gap-2 rounded-xl bg-[#ff0000] px-4 py-3 text-base font-semibold text-white hover:bg-red-700">
        <Plus size={18} aria-hidden="true" /> New video
      </Link>
      <div className="mb-3"><ReleaseCalendar initialNow={new Date().toISOString()} /></div>
      <div role="group" aria-label="Period" className="mb-3 grid grid-cols-3 gap-1 rounded-xl bg-slate-100 p-1">
        {PERIODS.map((option) => (
          <Link
            key={option.value}
            href={option.value === "week" ? "/showrunner" : `/showrunner?period=${option.value}`}
            replace
            scroll={false}
            aria-current={option.value === period ? "true" : undefined}
            className={`rounded-lg py-1.5 text-center text-sm font-semibold ${
              option.value === period ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-800"
            }`}
          >
            {option.label}
          </Link>
        ))}
      </div>
    </>
  );
}

function YouTubeIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
      <path d="M23.5 6.2a3.016 3.016 0 0 0-2.1-2.1C19.5 3.5 12 3.5 12 3.5s-7.5 0-9.4.5A3.017 3.017 0 0 0 .5 6.2C0 8.1 0 12 0 12s0 3.9.5 5.8a3.016 3.016 0 0 0 2.1 2.1c1.9.5 9.4.5 9.4.5s7.5 0 9.4-.5a3.015 3.015 0 0 0 2.1-2.1C24 15.9 24 12 24 12s0-3.9-.5-5.8zM9.5 15.6V8.4L15.8 12l-6.3 3.6z" />
    </svg>
  );
}

/** Daily rows summed into one row per month, dated the 1st. */
function byMonth(rows: StackedDayRow[]): StackedDayRow[] {
  const months = new Map<string, StackedDayRow>();
  for (const row of rows) {
    const key = `${String(row.date).slice(0, 7)}-01`;
    const month = months.get(key) ?? { date: key };
    for (const [field, value] of Object.entries(row)) {
      if (field !== "date") month[field] = Number(month[field] ?? 0) + Number(value);
    }
    months.set(key, month);
  }
  return [...months.values()];
}

function getYouTubeAnalyticsNow() {
  return Date.now();
}

export type Period = "week" | "month" | "year";

/**
 * This Month and This Week (Tom, 2026-11-24): the season calendar strip, then the channel numbers for the
 * period so far. The month counts from the 1st, the week from Sunday (the Sunday wrap-up's week); each resets.
 */
export async function ChannelPeriod({ period }: { period: Period }) {
  const { brand: active } = await requireAppBrand();
  const brand = await showChannelBrand(active);
  const links = await showLinksBrand(active);

  const [theme, redirectDomainRecord] = await Promise.all([
    prisma.brandTheme.findUnique({
      where: { brandId: brand.id },
      select: {
        youtubeChannelId: true,
        monthlyViewsGoal: true,
        monthlyClicksGoal: true,
        youtubeWatchPercentageGoal: true,
        lightColor: true,
      },
    }),
    prisma.brandDomain.findFirst({
      where: { brandId: links.id, purpose: DomainPurpose.WEBSITE, isPrimary: true },
      select: { hostname: true },
    }),
  ]);

  if (!theme?.youtubeChannelId) {
    return (
      <div className="px-4 py-5 sm:p-8">
        <h1 className="sr-only">{`Overview: this ${period}`}</h1>
        <PeriodTop period={period} />
        <h2 className="text-lg font-semibold text-slate-900">Channel analytics</h2>
        <p className="mt-2 text-sm text-slate-400">YouTube channel not configured for this brand. <a className="font-semibold underline" href="/api/youtube/connect">Connect YouTube</a>.</p>
      </div>
    );
  }

  const refreshToken = await getYouTubeRefreshToken(brand.id, brand.slug);

  if (!refreshToken) {
    return (
      <div className="px-4 py-5 sm:p-8">
        <h1 className="sr-only">{`Overview: this ${period}`}</h1>
        <PeriodTop period={period} />
        <h2 className="text-lg font-semibold text-slate-900">Channel analytics</h2>
        <p className="mt-2 text-sm text-slate-600">Channel data is unavailable because the saved YouTube connection could not be read here. <a className="font-semibold underline" href="/api/youtube/connect">Connect YouTube</a>.</p>
      </div>
    );
  }

  const channelId = theme.youtubeChannelId;
  const monthlyViewsGoal = theme.monthlyViewsGoal ?? 10000;
  // The monthly views goal, scaled to the week or the year; it is set (and edited) on Month.
  const viewsGoal = period === "week" ? Math.round((monthlyViewsGoal * 7) / 30) : period === "year" ? monthlyViewsGoal * 12 : monthlyViewsGoal;
  const watchPctGoal = theme.youtubeWatchPercentageGoal ?? 30;
  const clicksGoal = theme.monthlyClicksGoal ?? null;
  const redirectDomain = redirectDomainRecord?.hostname ?? null;

  // This month only, from the 1st (Central); it resets each month (Tom, 2026-11-24). YouTube Analytics lags
  // ~3 days, so the first days of a month have nothing settled yet.
  const now = new Date(getYouTubeAnalyticsNow());
  const month = period === "week" ? thisWeek(now) : period === "year" ? thisYear(now) : thisMonth(now);
  const startDate = month.start;
  const endDate = month.analyticsEnd ?? month.start;

  let metrics: ChannelMetrics | null = null;
  let dailyByVideo: DailyViewByVideoRow[] = [];
  let topVideos: TopVideoRow[] = [];
  let error: string | null = null;

  if (!month.analyticsEnd) metrics = { views: 0, estimatedMinutesWatched: 0, averageViewPercentage: 0 };
  else try {
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
    const message = err instanceof Error ? err.message : String(err);
    console.warn("[youtube] API skipped:", message);
    error = message;
  }

  // Click tracking — independent of YouTube Analytics; failures don't block the page
  let clickReport: SourceTagClickReport | null = null;
  let sourceTagMap: Map<string, SourceTagVideo> = new Map();
  if (redirectDomain) {
    try {
      [clickReport, sourceTagMap] = await Promise.all([
        getSourceTagClicksCumulative(links.id, links.slug, month.start),
        getSourceTagVideos(channelId, refreshToken, redirectDomain, links.slug),
      ]);
    } catch (err) {
      console.error("[youtube] click tracking error:", err);
    }
  }

  if (error || !metrics) {
    return (
      <div className="px-4 py-5 sm:p-8">
        <h1 className="sr-only">{`Overview: this ${period}`}</h1>
        <PeriodTop period={period} />
        <h2 className="text-lg font-semibold text-slate-900">Channel analytics</h2>
        <div className="mt-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          {/refresh token (expired|revoked)/i.test(error ?? "") ? (
            <>YouTube authorization has expired. <a className="font-semibold underline" href="/api/youtube/connect">Reconnect YouTube</a> to restore analytics.</>
          ) : error ?? "Analytics unavailable."}
        </div>
      </div>
    );
  }

  const viewsPct = viewsGoal > 0 ? (metrics.views / viewsGoal) * 100 : 0;
  const watchPct = watchPctGoal > 0 ? (metrics.averageViewPercentage / watchPctGoal) * 100 : 0;

  // Build stacked chart data — top N videos, everything else as "other"
  const allDates = month.analyticsEnd ? daysBetween(startDate, endDate) : [];
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
  const dailyRows: StackedDayRow[] = allDates.map((date) => ({ date, ...(dateMap.get(date) ?? {}) }));
  // The year is one bar per month; ~330 daily bars cannot be read on a phone.
  const stackedRows: StackedDayRow[] = period === "year" ? byMonth(dailyRows) : dailyRows;
  const segments: VideoSegment[] = isFallbackMode
    ? [{ videoId: "__total", title: "Total Views", color: VIDEO_COLORS[0] }]
    : [
        ...topVideoIds.map((id, i) => ({
          videoId: id,
          title: topVideos.find((v) => v.videoId === id)?.title ?? id,
          color: VIDEO_COLORS[i] ?? OTHER_COLOR,
        })),
        ...(hasOther ? [{ videoId: "other", title: "Other videos", color: OTHER_COLOR }] : []),
      ];

  return (
    <div className="px-4 py-5 sm:p-8">
      <h1 className="sr-only">{`Overview: this ${period}`}</h1>
      <PeriodTop period={period} />

      {/* Goal cards */}
      <div className="grid gap-3 lg:grid-cols-2">
        <YouTubeGoalCard
          brandId={brand.id}
          label="Views"
          value={metrics.views.toLocaleString("en-US")}
          goal={viewsGoal}
          goalLabel={`of ${viewsGoal.toLocaleString("en-US")} ${period === "week" ? "weekly " : period === "year" ? "yearly " : ""}goal`}
          pct={viewsPct}
          field="monthlyViewsGoal"
          editable={period === "month"}
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
      {!month.analyticsEnd ? (
        <p className="mt-2 text-xs text-slate-500">
          YouTube reports each day about {ANALYTICS_LAG_DAYS} days late, so views for this {period} start showing on{" "}
          {new Date(Date.parse(`${month.start}T12:00:00Z`) + ANALYTICS_LAG_DAYS * 86400000).toLocaleDateString("en-US", { timeZone: "UTC", weekday: "long", month: "short", day: "numeric" })}.
        </p>
      ) : null}

      {/* Daily trend */}
      <div className="mt-3 rounded-xl border border-slate-200 bg-white p-6">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{period === "year" ? "Monthly Views" : "Daily Views"}</p>
        <p className="mt-1 text-lg font-semibold text-slate-900">
          {metrics.views.toLocaleString("en-US")} total views
        </p>
        <div className="mt-4">
          <YouTubeTrendChart stackedRows={stackedRows} segments={segments} monthly={period === "year"} />
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
      <div className="mt-3 rounded-xl border border-slate-200 bg-white p-5">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Top Videos</p>
        <h2 className="mt-1 text-lg font-semibold text-slate-900">Most viewed this period</h2>
        <VideoList videos={topVideos} empty="No video data for this period." />
      </div>

      {/* Community link clicks */}
      {clickReport && (
        <div className="mt-3 rounded-xl border border-slate-200 bg-white p-5">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Community Link Clicks</p>
              <p className="mt-1 text-lg font-semibold text-slate-900">
                {clickReport.totalClicks.toLocaleString("en-US")} total clicks
              </p>
              <p className="text-xs text-slate-400">
                Since {new Date(clickReport.epochDate + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" })}
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
