import type { ReactNode } from "react";
import { prisma } from "@/lib/prisma";
import { requireAppBrand } from "@/lib/brands/staff";
import { ReviewOutcome } from "@prisma/client";
import { getTrafficTrend, getTotalKeyEvents } from "@/lib/analytics/ga4";
import { getChannelMetrics, getAverageWatchDuration } from "@/lib/youtube/analytics";
import { PlayCircle, Clock, Globe, Target, FileText, Eye, Star } from "lucide-react";
import { StatCard } from "./StatCards";
import { DashboardControls } from "./DashboardControls";

export const dynamic = "force-dynamic";

const DASHBOARD_RANGES = [
  { value: "last-7-days", label: "Last 7 days" },
  { value: "last-30-days", label: "Last 30 days" },
  { value: "last-90-days", label: "Last 90 days" },
  { value: "last-12-months", label: "Last 12 months" },
  { value: "this-month", label: "This month" },
  { value: "last-month", label: "Last month" },
  { value: "this-quarter", label: "This quarter" },
  { value: "last-quarter", label: "Last quarter" },
  { value: "year-to-date", label: "Year to date" },
  { value: "last-year", label: "Last year" },
] as const;

type DashboardRange = (typeof DASHBOARD_RANGES)[number]["value"];

type DashboardPeriod = {
  label: string;
  start: Date;
  endExclusive: Date;
};

function goalPct(value: number, goal: number): number {
  return Math.min(100, Math.round((value / goal) * 100));
}

function fmtDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.round(seconds % 60);
  return `${m}:${String(s).padStart(2, "0")}`;
}

function startOfUtcDay(value: Date): Date {
  return new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate()));
}

function addUtcDays(value: Date, days: number): Date {
  const result = new Date(value);
  result.setUTCDate(result.getUTCDate() + days);
  return result;
}

function startOfUtcMonth(value: Date): Date {
  return new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), 1));
}

function startOfUtcQuarter(value: Date): Date {
  const month = value.getUTCMonth() - (value.getUTCMonth() % 3);
  return new Date(Date.UTC(value.getUTCFullYear(), month, 1));
}

function startOfUtcYear(value: Date): Date {
  return new Date(Date.UTC(value.getUTCFullYear(), 0, 1));
}

function period(start: Date, endExclusive: Date, label: string): DashboardPeriod {
  return { start, endExclusive, label };
}

function getDashboardPeriod(range: DashboardRange, now: Date): DashboardPeriod {
  const today = startOfUtcDay(now);
  const tomorrow = addUtcDays(today, 1);
  const currentMonth = startOfUtcMonth(now);
  const currentQuarter = startOfUtcQuarter(now);
  const currentYear = startOfUtcYear(now);

  switch (range) {
    case "last-7-days":
      return period(addUtcDays(today, -6), tomorrow, "Last 7 days");
    case "last-90-days":
      return period(addUtcDays(today, -89), tomorrow, "Last 90 days");
    case "last-12-months":
      return period(addUtcDays(today, -364), tomorrow, "Last 12 months");
    case "this-month":
      return period(currentMonth, tomorrow, "This month");
    case "last-month": {
      const previousMonth = new Date(Date.UTC(currentMonth.getUTCFullYear(), currentMonth.getUTCMonth() - 1, 1));
      return period(previousMonth, currentMonth, "Last month");
    }
    case "this-quarter":
      return period(currentQuarter, tomorrow, "This quarter");
    case "last-quarter": {
      const previousQuarter = new Date(Date.UTC(currentQuarter.getUTCFullYear(), currentQuarter.getUTCMonth() - 3, 1));
      return period(previousQuarter, currentQuarter, "Last quarter");
    }
    case "year-to-date":
      return period(currentYear, tomorrow, "Year to date");
    case "last-year": {
      const previousYear = new Date(Date.UTC(currentYear.getUTCFullYear() - 1, 0, 1));
      return period(previousYear, currentYear, "Last year");
    }
    default:
      return period(addUtcDays(today, -29), tomorrow, "Last 30 days");
  }
}

function rollingPreviousPeriod(current: DashboardPeriod): DashboardPeriod {
  const duration = current.endExclusive.getTime() - current.start.getTime();
  return period(
    new Date(current.start.getTime() - duration),
    current.start,
    "Previous period",
  );
}

function getPreviousDashboardPeriod(range: DashboardRange, now: Date, current: DashboardPeriod): DashboardPeriod {
  const today = startOfUtcDay(now);
  const tomorrow = addUtcDays(today, 1);
  const currentMonth = startOfUtcMonth(now);
  const currentQuarter = startOfUtcQuarter(now);
  const currentYear = startOfUtcYear(now);

  switch (range) {
    case "this-month":
      return period(new Date(Date.UTC(currentMonth.getUTCFullYear(), currentMonth.getUTCMonth() - 1, 1)), currentMonth, "Previous period");
    case "last-month": {
      const priorMonth = new Date(Date.UTC(currentMonth.getUTCFullYear(), currentMonth.getUTCMonth() - 2, 1));
      const previousMonth = new Date(Date.UTC(currentMonth.getUTCFullYear(), currentMonth.getUTCMonth() - 1, 1));
      return period(priorMonth, previousMonth, "Previous period");
    }
    case "this-quarter":
      return period(
        new Date(Date.UTC(currentQuarter.getUTCFullYear(), currentQuarter.getUTCMonth() - 3, 1)),
        currentQuarter,
        "Previous period",
      );
    case "last-quarter": {
      const priorQuarter = new Date(Date.UTC(currentQuarter.getUTCFullYear(), currentQuarter.getUTCMonth() - 6, 1));
      const previousQuarter = new Date(Date.UTC(currentQuarter.getUTCFullYear(), currentQuarter.getUTCMonth() - 3, 1));
      return period(priorQuarter, previousQuarter, "Previous period");
    }
    case "year-to-date":
      return period(
        new Date(Date.UTC(currentYear.getUTCFullYear() - 1, 0, 1)),
        new Date(Date.UTC(tomorrow.getUTCFullYear() - 1, tomorrow.getUTCMonth(), tomorrow.getUTCDate())),
        "Previous period",
      );
    case "last-year":
      return period(
        new Date(Date.UTC(currentYear.getUTCFullYear() - 2, 0, 1)),
        new Date(Date.UTC(currentYear.getUTCFullYear() - 1, 0, 1)),
        "Previous period",
      );
    default:
      return rollingPreviousPeriod(current);
  }
}

function dateString(value: Date): string {
  return value.toISOString().slice(0, 10);
}

function percentChange(current: number, previous: number): number | null {
  if (previous === 0) return current === 0 ? 0 : null;
  return Math.round(((current - previous) / previous) * 1000) / 10;
}

async function getOfferStats(brandId: string, selectedPeriod: DashboardPeriod) {
  const offers = await prisma.quote.findMany({
    where: {
      brandId,
      status: { in: ["sent", "accepted", "rejected"] },
      OR: [
        { sentAt: { gte: selectedPeriod.start, lt: selectedPeriod.endExclusive } },
        {
          sentAt: null,
          updatedAt: { gte: selectedPeriod.start, lt: selectedPeriod.endExclusive },
        },
      ],
    },
    select: { status: true },
  });

  return {
    sent: offers.length,
    accepted: offers.filter((offer) => offer.status === "accepted").length,
    rejected: offers.filter((offer) => offer.status === "rejected").length,
    awaiting: offers.filter((offer) => offer.status === "sent").length,
  };
}

async function getReviewStats(brandId: string, selectedPeriod: DashboardPeriod) {
  const requests = await prisma.reviewRequest.findMany({
    where: {
      brandId,
      sentAt: { gte: selectedPeriod.start, lt: selectedPeriod.endExclusive },
    },
    select: { openedAt: true, outcome: true },
  });

  const sent = requests.length;
  const opened = requests.filter((request) => request.openedAt).length;
  const fiveStars = requests.filter((request) => request.outcome === ReviewOutcome.FIVE_STAR).length;

  return {
    sent,
    openRate: sent > 0 ? Math.round((opened / sent) * 100) : 0,
    fiveStarRate: sent > 0 ? Math.round((fiveStars / sent) * 100) : 0,
  };
}

function getDashboardRange(value: string | string[] | undefined): DashboardRange {
  return typeof value === "string" && DASHBOARD_RANGES.some((range) => range.value === value)
    ? (value as DashboardRange)
    : "last-30-days";
}

type PageProps = {
  searchParams: Promise<{ range?: string | string[] }>;
};

export default async function DashboardPage({ searchParams }: PageProps) {
  const { brand } = await requireAppBrand();
  const params = await searchParams;
  const range = getDashboardRange(params.range);
  const windowEnd = new Date();
  const selectedPeriod = getDashboardPeriod(range, windowEnd);
  const previous = getPreviousDashboardPeriod(range, windowEnd, selectedPeriod);

  const theme = await prisma.brandTheme.findUnique({
    where: { brandId: brand.id },
    select: {
      ga4PropertyId: true,
      ga4HostName: true,
      primaryColor: true,
      youtubeChannelId: true,
      youtubeHandle: true,
      monthlyViewsGoal: true,
      monthlyClicksGoal: true,
      avgWatchDurationGoal: true,
      monthlyKeyEventsGoal: true,
    },
  });

  const windowEndStr = dateString(addUtcDays(selectedPeriod.endExclusive, -1));
  const windowStartStr = dateString(selectedPeriod.start);
  const periodDays = Math.round(
    (selectedPeriod.endExclusive.getTime() - selectedPeriod.start.getTime()) / (24 * 60 * 60 * 1000),
  );

  const monthlyViewsGoal = theme?.monthlyViewsGoal ?? 10000;
  const monthlyClicksGoal = theme?.monthlyClicksGoal ?? 1000;
  const avgWatchDurationGoal = theme?.avgWatchDurationGoal ?? 240;
  const monthlyKeyEventsGoal = theme?.monthlyKeyEventsGoal ?? 50;
  const brandPrimaryColor = "var(--chart-primary)";
  const periodGoalMultiplier = periodDays / 30;
  const viewsGoal = Math.round(monthlyViewsGoal * periodGoalMultiplier);
  const visitorsGoal = Math.round(monthlyClicksGoal * periodGoalMultiplier);
  const keyEventsGoal = Math.round(monthlyKeyEventsGoal * periodGoalMultiplier);

  // YouTube: total views + avg watch duration (parallel)
  let totalYtViews = 0;
  let avgWatchDuration = 0;
  let previousYtViews = 0;
  let previousAvgWatchDuration = 0;
  const ytChannelId = theme?.youtubeChannelId;
  const slugEnvKey = `YOUTUBE_REFRESH_TOKEN_${brand.slug.toUpperCase().replace(/-/g, "_")}`;
  const ytRefreshToken = process.env[slugEnvKey]?.trim();
  if (ytChannelId && ytRefreshToken) {
    try {
      const [metrics, duration, previousMetrics, previousDuration] = await Promise.all([
        getChannelMetrics(ytChannelId, ytRefreshToken, windowStartStr, windowEndStr),
        getAverageWatchDuration(ytChannelId, ytRefreshToken, windowStartStr, windowEndStr),
        getChannelMetrics(
          ytChannelId,
          ytRefreshToken,
          dateString(previous.start),
          dateString(addUtcDays(previous.endExclusive, -1)),
        ),
        getAverageWatchDuration(
          ytChannelId,
          ytRefreshToken,
          dateString(previous.start),
          dateString(addUtcDays(previous.endExclusive, -1)),
        ),
      ]);
      totalYtViews = metrics.views;
      avgWatchDuration = duration;
      previousYtViews = previousMetrics.views;
      previousAvgWatchDuration = previousDuration;
    } catch (err) {
      console.error("[dashboard] YouTube error:", err);
    }
  }

  // GA4: total active users + key events (parallel)
  let totalWebsiteVisitors = 0;
  let keyEventCount = 0;
  let previousWebsiteVisitors = 0;
  let previousKeyEventCount = 0;
  const ga4PropertyId = theme?.ga4PropertyId;
  const ga4HostName = theme?.ga4HostName;
  if (ga4PropertyId) {
    try {
      const [trafficRows, keyEvents, previousTrafficRows, previousKeyEvents] = await Promise.all([
        getTrafficTrend(ga4PropertyId, windowStartStr, windowEndStr, ga4HostName),
        getTotalKeyEvents(ga4PropertyId, windowStartStr, windowEndStr, ga4HostName),
        getTrafficTrend(
          ga4PropertyId,
          dateString(previous.start),
          dateString(addUtcDays(previous.endExclusive, -1)),
          ga4HostName,
        ),
        getTotalKeyEvents(
          ga4PropertyId,
          dateString(previous.start),
          dateString(addUtcDays(previous.endExclusive, -1)),
          ga4HostName,
        ),
      ]);
      totalWebsiteVisitors = trafficRows.reduce((s, r) => s + r.activeUsers, 0);
      keyEventCount = keyEvents;
      previousWebsiteVisitors = previousTrafficRows.reduce((sum, row) => sum + row.activeUsers, 0);
      previousKeyEventCount = previousKeyEvents;
    } catch (err) {
      console.error("[dashboard] GA4 error:", err);
    }
  }

  const ytHandle = theme?.youtubeHandle;
  const ytPath = ytHandle ? (ytHandle.startsWith("@") ? ytHandle : `@${ytHandle}`) : undefined;
  const ytAttribution = ytPath
    ? { label: `youtube.com/${ytPath}`, href: `https://youtube.com/${ytPath}` }
    : undefined;

  const websiteAttribution = ga4HostName
    ? { label: ga4HostName, href: `https://${ga4HostName}` }
    : undefined;

  const [offerStats, reviewStats] = await Promise.all([
    Promise.all([getOfferStats(brand.id, selectedPeriod), getOfferStats(brand.id, previous)]),
    Promise.all([
      getReviewStats(brand.id, selectedPeriod),
      getReviewStats(brand.id, previous),
    ]),
  ]);
  const currentOffers = offerStats[0];
  const previousOffers = offerStats[1];
  const currentReviews = reviewStats[0];
  const previousReviews = reviewStats[1];

  return (
    <div className="p-8">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">Dashboard</h1>
        <DashboardControls
          options={[...DASHBOARD_RANGES]}
          selectedRange={range}
        />
      </div>

      <DashboardSection title="Website">
        {ga4PropertyId ? (
          <>
            <StatCard label="Active visitors" value={totalWebsiteVisitors.toLocaleString("en-US")} goal={{ pct: goalPct(totalWebsiteVisitors, visitorsGoal), subtitle: `of ${visitorsGoal.toLocaleString("en-US")} visitors goal for this period` }} goalColor={brandPrimaryColor} comparison={percentChange(totalWebsiteVisitors, previousWebsiteVisitors)} icon={<Globe size={14} />} attribution={websiteAttribution} />
            <StatCard label="Key events" value={keyEventCount.toLocaleString("en-US")} goal={{ pct: goalPct(keyEventCount, keyEventsGoal), subtitle: `of ${keyEventsGoal.toLocaleString("en-US")} goal for this period` }} goalColor={brandPrimaryColor} comparison={percentChange(keyEventCount, previousKeyEventCount)} icon={<Target size={14} />} attribution={websiteAttribution} />
          </>
        ) : <NotConfiguredCard title="Website" />}
      </DashboardSection>

      <DashboardSection title="YouTube">
        {ytChannelId ? (
          <>
            <StatCard label="Channel views" value={totalYtViews.toLocaleString("en-US")} goal={{ pct: goalPct(totalYtViews, viewsGoal), subtitle: `of ${viewsGoal.toLocaleString("en-US")} goal for this period` }} goalColor={brandPrimaryColor} comparison={percentChange(totalYtViews, previousYtViews)} icon={<PlayCircle size={14} />} attribution={ytAttribution} />
            <StatCard label="Avg watch time" value={fmtDuration(avgWatchDuration)} goal={{ pct: goalPct(avgWatchDuration, avgWatchDurationGoal), subtitle: `of ${fmtDuration(avgWatchDurationGoal)} goal` }} goalColor={brandPrimaryColor} comparison={percentChange(avgWatchDuration, previousAvgWatchDuration)} icon={<Clock size={14} />} attribution={ytAttribution} />
          </>
        ) : <NotConfiguredCard title="YouTube" />}
      </DashboardSection>

      <DashboardSection title="Reviews">
        <StatCard label="Review requests sent" value={currentReviews.sent.toLocaleString("en-US")} comparison={percentChange(currentReviews.sent, previousReviews.sent)} icon={<FileText size={14} />} />
        <StatCard label="Open rate" value={`${currentReviews.openRate}%`} comparison={percentChange(currentReviews.openRate, previousReviews.openRate)} icon={<Eye size={14} />} />
        <StatCard label="5-star rate" value={`${currentReviews.fiveStarRate}%`} comparison={percentChange(currentReviews.fiveStarRate, previousReviews.fiveStarRate)} icon={<Star size={14} />} />
      </DashboardSection>

      <DashboardSection title="Offers">
        <StatCard label="Sent" value={currentOffers.sent.toLocaleString("en-US")} comparison={percentChange(currentOffers.sent, previousOffers.sent)} icon={<FileText size={14} />} />
        <StatCard label="Accepted" value={currentOffers.accepted.toLocaleString("en-US")} comparison={percentChange(currentOffers.accepted, previousOffers.accepted)} icon={<FileText size={14} />} />
        <StatCard label="Rejected" value={currentOffers.rejected.toLocaleString("en-US")} comparison={percentChange(currentOffers.rejected, previousOffers.rejected)} icon={<FileText size={14} />} />
        <StatCard label="Awaiting reply" value={currentOffers.awaiting.toLocaleString("en-US")} comparison={percentChange(currentOffers.awaiting, previousOffers.awaiting)} icon={<FileText size={14} />} />
      </DashboardSection>
    </div>
  );
}

function DashboardSection({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <section className="mt-10 flex items-stretch gap-3">
      <div className="relative w-14 shrink-0">
        <h2
          className="absolute left-1/2 top-1/2 whitespace-nowrap rounded-md bg-slate-50 px-2 py-1 text-xs font-semibold uppercase tracking-wide text-slate-500"
          style={{ transform: "translate(-50%, -50%) rotate(-60deg)" }}
        >
          {title}
        </h2>
      </div>
      <div className="grid min-w-0 flex-1 grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">{children}</div>
    </section>
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
