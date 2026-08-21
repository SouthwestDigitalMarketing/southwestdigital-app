import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { resolveBrand } from "@/lib/brands/resolve";
import { MembershipStatus } from "@prisma/client";
import { getTrafficTrend, getTotalKeyEvents } from "@/lib/analytics/ga4";
import { getChannelMetrics, getAverageWatchDuration } from "@/lib/youtube/analytics";
import { PlayCircle, Clock, Globe, Target } from "lucide-react";
import { StatCard } from "./StatCards";

export const dynamic = "force-dynamic";

function goalPct(value: number, goal: number): number {
  return Math.min(100, Math.round((value / goal) * 100));
}

function fmtDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.round(seconds % 60);
  return `${m}:${String(s).padStart(2, "0")}`;
}

export default async function DashboardPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const headersList = await headers();
  const resolved = await resolveBrand(headersList.get("x-hostname"), session.user.id);
  if (!resolved?.membership || resolved.membership.status !== MembershipStatus.ACTIVE) {
    redirect("/login");
  }

  const { brand } = resolved;

  const theme = await prisma.brandTheme.findUnique({
    where: { brandId: brand.id },
    select: {
      ga4PropertyId: true,
      ga4HostName: true,
      youtubeChannelId: true,
      youtubeHandle: true,
      monthlyViewsGoal: true,
      monthlyClicksGoal: true,
      avgWatchDurationGoal: true,
      monthlyKeyEventsGoal: true,
    },
  });

  const windowEnd = new Date();
  const windowEndStr = windowEnd.toISOString().slice(0, 10);
  const windowStartStr = new Date(windowEnd.getTime() - 29 * 24 * 60 * 60 * 1000)
    .toISOString()
    .slice(0, 10);

  const monthlyViewsGoal = theme?.monthlyViewsGoal ?? 10000;
  const monthlyClicksGoal = theme?.monthlyClicksGoal ?? 1000;
  const avgWatchDurationGoal = theme?.avgWatchDurationGoal ?? 240;
  const monthlyKeyEventsGoal = theme?.monthlyKeyEventsGoal ?? 50;

  // YouTube: total views + avg watch duration (parallel)
  let totalYtViews = 0;
  let avgWatchDuration = 0;
  const ytChannelId = theme?.youtubeChannelId;
  const slugEnvKey = `YOUTUBE_REFRESH_TOKEN_${brand.slug.toUpperCase().replace(/-/g, "_")}`;
  const ytRefreshToken = process.env[slugEnvKey]?.trim();
  if (ytChannelId && ytRefreshToken) {
    try {
      const [metrics, duration] = await Promise.all([
        getChannelMetrics(ytChannelId, ytRefreshToken, windowStartStr, windowEndStr),
        getAverageWatchDuration(ytChannelId, ytRefreshToken, windowStartStr, windowEndStr),
      ]);
      totalYtViews = metrics.views;
      avgWatchDuration = duration;
    } catch (err) {
      console.error("[dashboard] YouTube error:", err);
    }
  }

  // GA4: total active users + key events (parallel)
  let totalWebsiteVisitors = 0;
  let keyEventCount = 0;
  const ga4PropertyId = theme?.ga4PropertyId;
  const ga4HostName = theme?.ga4HostName;
  if (ga4PropertyId) {
    try {
      const [trafficRows, keyEvents] = await Promise.all([
        getTrafficTrend(ga4PropertyId, windowStartStr, windowEndStr, ga4HostName),
        getTotalKeyEvents(ga4PropertyId, windowStartStr, windowEndStr, ga4HostName),
      ]);
      totalWebsiteVisitors = trafficRows.reduce((s, r) => s + r.activeUsers, 0);
      keyEventCount = keyEvents;
    } catch (err) {
      console.error("[dashboard] GA4 error:", err);
    }
  }

  const ytHandle = theme?.youtubeHandle;
  const ytAttribution = ytHandle
    ? { label: ytHandle, href: `https://youtube.com/${ytHandle}` }
    : undefined;

  const websiteAttribution = ga4HostName
    ? { label: ga4HostName, href: `https://${ga4HostName}` }
    : undefined;

  return (
    <div className="p-8">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">Dashboard</h1>
        <p className="mt-1 text-sm text-slate-500">Last 30 days</p>
      </div>

      <div className="mt-6 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
        {ytChannelId ? (
          <StatCard
            label="YouTube views"
            value={totalYtViews.toLocaleString("en-US")}
            goal={{
              pct: goalPct(totalYtViews, monthlyViewsGoal),
              subtitle: `of ${monthlyViewsGoal.toLocaleString("en-US")} monthly goal`,
            }}
            icon={<PlayCircle size={14} />}
            attribution={ytAttribution}
            detailsHref="/youtube"
          />
        ) : (
          <NotConfiguredCard title="YouTube views" />
        )}

        {ytChannelId ? (
          <StatCard
            label="Avg watch time"
            value={fmtDuration(avgWatchDuration)}
            goal={{
              pct: goalPct(avgWatchDuration, avgWatchDurationGoal),
              subtitle: `of ${fmtDuration(avgWatchDurationGoal)} goal`,
            }}
            icon={<Clock size={14} />}
            attribution={ytAttribution}
            detailsHref="/youtube"
          />
        ) : (
          <NotConfiguredCard title="Avg watch time" />
        )}

        {ga4PropertyId ? (
          <StatCard
            label="Website traffic"
            value={totalWebsiteVisitors.toLocaleString("en-US")}
            goal={{
              pct: goalPct(totalWebsiteVisitors, monthlyClicksGoal),
              subtitle: `of ${monthlyClicksGoal.toLocaleString("en-US")} visitors goal`,
            }}
            icon={<Globe size={14} />}
            attribution={websiteAttribution}
            detailsHref="/website"
          />
        ) : (
          <NotConfiguredCard title="Website traffic" />
        )}

        {ga4PropertyId ? (
          <StatCard
            label="Key events"
            value={keyEventCount.toLocaleString("en-US")}
            goal={{
              pct: goalPct(keyEventCount, monthlyKeyEventsGoal),
              subtitle: `of ${monthlyKeyEventsGoal.toLocaleString("en-US")} monthly goal`,
            }}
            icon={<Target size={14} />}
            attribution={websiteAttribution}
            detailsHref="/website"
          />
        ) : (
          <NotConfiguredCard title="Key events" />
        )}
      </div>
    </div>
  );
}

function NotConfiguredCard({ title }: { title: string }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-6">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{title}</p>
      <p className="mt-3 text-sm text-slate-400">Not configured</p>
    </div>
  );
}
