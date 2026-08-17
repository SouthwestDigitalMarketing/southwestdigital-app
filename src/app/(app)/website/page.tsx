import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { resolveBrand } from "@/lib/brands/resolve";
import { MembershipStatus } from "@prisma/client";
import { getSiteHealth, getTrafficTrend, getHourlyTraffic, type SiteHealth } from "@/lib/analytics/ga4";
import { PeriodSelector } from "./PeriodSelector";
import { SiteTrafficGraph, type TrafficComparisonRow } from "./SiteTrafficGraph";

export const dynamic = "force-dynamic";

type PeriodConfig = {
  granularity: "daily" | "hourly";
  label: string;
  subtitleLabel: string;
};

const PERIOD_CONFIG: Record<string, PeriodConfig> = {
  today: { granularity: "hourly", label: "Today so far", subtitleLabel: "today vs. same hours yesterday" },
  yday: { granularity: "hourly", label: "Yesterday", subtitleLabel: "yesterday vs. day before" },
  "48h": { granularity: "hourly", label: "Last 48 hours", subtitleLabel: "last 48 hours vs. prev. 48 hours" },
  "7d": { granularity: "daily", label: "Last 7 days", subtitleLabel: "last 7 days vs. prev. 7 days" },
  "30d": { granularity: "daily", label: "Last 30 days", subtitleLabel: "last 30 days vs. prev. 30 days" },
  "90d": { granularity: "daily", label: "Last 90 days", subtitleLabel: "last 90 days vs. prev. 90 days" },
};

export default async function WebsitePage({
  searchParams,
}: {
  searchParams: Promise<{ period?: string }>;
}) {
  const { period: rawPeriod } = await searchParams;
  const period = rawPeriod && rawPeriod in PERIOD_CONFIG ? rawPeriod : "30d";
  const config = PERIOD_CONFIG[period];

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
    select: { ga4PropertyId: true, ga4HostName: true, primaryColor: true },
  });

  if (!theme?.ga4PropertyId) {
    return (
      <div className="p-8">
        <h1 className="text-2xl font-semibold text-slate-900">Website</h1>
        <p className="mt-4 text-sm text-slate-400">GA4 property not configured for this brand.</p>
      </div>
    );
  }

  const propertyId = theme.ga4PropertyId;
  const hostname = theme.ga4HostName;
  const barColor = theme.primaryColor ?? "#17324d";

  const now = Date.now();

  const todayStr = new Date(now).toISOString().slice(0, 10);
  const yesterdayStr = new Date(now - 86400000).toISOString().slice(0, 10);
  const twoDaysAgoStr = new Date(now - 2 * 86400000).toISOString().slice(0, 10);
  const threeDaysAgoStr = new Date(now - 3 * 86400000).toISOString().slice(0, 10);

  // Compute startDate / endDate for this period (also used by getSiteHealth)
  let startDate: string;
  let endDate: string;

  if (period === "today") {
    startDate = endDate = todayStr;
  } else if (period === "yday") {
    startDate = endDate = yesterdayStr;
  } else if (period === "48h") {
    startDate = yesterdayStr;
    endDate = todayStr;
  } else {
    const days = { "7d": 7, "30d": 30, "90d": 90 }[period] ?? 30;
    endDate = todayStr;
    startDate = new Date(now - (days - 1) * 86400000).toISOString().slice(0, 10);
  }

  let health: SiteHealth | null = null;
  let trendRows: TrafficComparisonRow[] = [];
  let error: string | null = null;

  try {
    if (config.granularity === "hourly") {
      // Yesterday: compare to day before yesterday
      // 48h: yesterday+today vs 3daysago+2daysago
      const [prevTrendStart, prevTrendEnd] =
        period === "today" || period === "yday"
          ? [yesterdayStr, yesterdayStr]
          : [threeDaysAgoStr, twoDaysAgoStr];

      const [healthResult, curTrend, prevTrend] = await Promise.all([
        getSiteHealth(propertyId, startDate, endDate, hostname),
        getHourlyTraffic(propertyId, startDate, endDate, hostname),
        getHourlyTraffic(propertyId, prevTrendStart, prevTrendEnd, hostname),
      ]);
      health = healthResult;

      const curMap = new Map(curTrend.map((r) => [r.datetime, r.activeUsers]));
      const prevMap = new Map(prevTrend.map((r) => [r.datetime, r.activeUsers]));

      if (period === "today") {
        trendRows = Array.from({ length: 24 }, (_, h) => {
          const hh = String(h).padStart(2, "0");
          return {
            date: `${todayStr}T${hh}:00:00`,
            current: curMap.get(`${todayStr}T${hh}:00:00`) ?? 0,
            previous: prevMap.get(`${yesterdayStr}T${hh}:00:00`) ?? 0,
          };
        });
      } else if (period === "yday") {
        trendRows = Array.from({ length: 24 }, (_, h) => {
          const hh = String(h).padStart(2, "0");
          return {
            date: `${yesterdayStr}T${hh}:00:00`,
            current: curMap.get(`${yesterdayStr}T${hh}:00:00`) ?? 0,
            previous: prevMap.get(`${twoDaysAgoStr}T${hh}:00:00`) ?? 0,
          };
        });
      } else {
        // 48h: yesterday hours then today hours, each compared to 2 days prior
        const curDays = [yesterdayStr, todayStr];
        const prevDays = [threeDaysAgoStr, twoDaysAgoStr];
        trendRows = curDays.flatMap((curDay, di) =>
          Array.from({ length: 24 }, (_, h) => {
            const hh = String(h).padStart(2, "0");
            return {
              date: `${curDay}T${hh}:00:00`,
              current: curMap.get(`${curDay}T${hh}:00:00`) ?? 0,
              previous: prevMap.get(`${prevDays[di]}T${hh}:00:00`) ?? 0,
            };
          }),
        );
      }
    } else {
      // Daily granularity
      const days = { "7d": 7, "30d": 30, "90d": 90 }[period] ?? 30;
      const prevEndStr = new Date(now - days * 86400000).toISOString().slice(0, 10);
      const prevStartStr = new Date(now - (2 * days - 1) * 86400000).toISOString().slice(0, 10);

      const [healthResult, curTrend, prevTrend] = await Promise.all([
        getSiteHealth(propertyId, startDate, endDate, hostname),
        getTrafficTrend(propertyId, startDate, endDate, hostname),
        getTrafficTrend(propertyId, prevStartStr, prevEndStr, hostname),
      ]);
      health = healthResult;

      const curMap = new Map(curTrend.map((r) => [r.date, r.activeUsers]));
      const prevMap = new Map(prevTrend.map((r) => [r.date, r.activeUsers]));
      const curDates = Array.from({ length: days }, (_, i) =>
        new Date(now - (days - 1 - i) * 86400000).toISOString().slice(0, 10),
      );
      const prevDates = Array.from({ length: days }, (_, i) =>
        new Date(now - (2 * days - 1 - i) * 86400000).toISOString().slice(0, 10),
      );
      trendRows = curDates.map((date, i) => ({
        date,
        current: curMap.get(date) ?? 0,
        previous: prevMap.get(prevDates[i]) ?? 0,
      }));
    }
  } catch (err) {
    console.error("[website] GA4 error:", JSON.stringify(err, Object.getOwnPropertyNames(err instanceof Error ? err : {})));
    error = err instanceof Error ? err.message : String(err);
  }

  if (error || !health) {
    return (
      <div className="p-8">
        <h1 className="text-2xl font-semibold text-slate-900">Website</h1>
        <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          {error ?? "Analytics unavailable."}
        </div>
      </div>
    );
  }

  const { headline, acquisition, landingPages, geographicTraffic } = health;
  const c = headline.current;
  const cmp = headline.comparison;

  return (
    <div className="p-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Website</h1>
          <p className="mt-1 text-sm text-slate-500">
            bookkeepingconroe.com — {config.subtitleLabel}
          </p>
        </div>
        <PeriodSelector current={period} />
      </div>

      <SiteTrafficGraph
        rows={trendRows}
        barColor={barColor}
        label={config.label}
        granularity={config.granularity}
      />

      {/* Headline metrics */}
      <div className="mt-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <MetricCard label="Active users" value={fmtInt(c.activeUsers)} comparison={cmp.activeUsers} />
        <MetricCard label="Sessions" value={fmtInt(c.sessions)} comparison={cmp.sessions} />
        <MetricCard label="Engagement rate" value={fmtRate(c.engagementRate)} comparison={cmp.engagementRate} />
        <MetricCard label="Bounce rate" value={fmtRate(c.bounceRate)} comparison={cmp.bounceRate} />
        <MetricCard label="New users" value={fmtInt(c.newUsers)} comparison={cmp.newUsers} />
        <MetricCard label="Engaged sessions" value={fmtInt(c.engagedSessions)} comparison={cmp.engagedSessions} />
        <MetricCard label="Engagement time" value={c.engagementDuration !== null ? `${Math.round(c.engagementDuration)}s` : "—"} comparison={cmp.engagementDuration} />
        <MetricCard label="Page views" value={fmtInt(c.pageViews)} comparison={cmp.pageViews} />
      </div>

      {/* Acquisition + Landing pages */}
      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Acquisition</p>
          <h2 className="mt-1 text-lg font-semibold text-slate-900">How visitors arrived</h2>
          <ReportTable report={acquisition} />
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Entry points</p>
          <h2 className="mt-1 text-lg font-semibold text-slate-900">Top landing pages</h2>
          <ReportTable report={landingPages} />
        </div>
      </div>

      {/* Geography */}
      <div className="mt-6 rounded-xl border border-slate-200 bg-white p-5">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Geography</p>
        <h2 className="mt-1 text-lg font-semibold text-slate-900">Where visitors are located</h2>
        <ReportTable report={geographicTraffic} />
      </div>

      <p className="mt-5 text-xs text-slate-400">
        Generated {new Date(health.generatedAt).toLocaleString("en-US", { timeZone: "America/Chicago" })}. GA4 data may be delayed or sampled.
      </p>
    </div>
  );
}

function fmtInt(v: number | null) {
  if (v === null) return "—";
  return new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(v);
}

function fmtRate(v: number | null) {
  if (v === null) return "—";
  return `${(v * 100).toFixed(1)}%`;
}

type Comparison = { percentageChange: number | null; direction: string };

function MetricCard({ label, value, comparison }: { label: string; value: string; comparison?: Comparison }) {
  const color =
    comparison?.direction === "increased"
      ? "text-emerald-700"
      : comparison?.direction === "decreased"
        ? "text-amber-700"
        : "text-slate-400";

  const changeText = !comparison || comparison.direction === "unavailable"
    ? null
    : comparison.direction === "unchanged"
      ? "No change vs. prev. period"
      : comparison.percentageChange === null
        ? `${comparison.direction} from zero`
        : `${Math.abs(comparison.percentageChange).toFixed(1)}% ${comparison.direction} vs. prev. period`;

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-2 text-3xl font-semibold text-slate-900">{value}</p>
      {changeText && <p className={`mt-1 text-xs font-medium ${color}`}>{changeText}</p>}
    </div>
  );
}

type ReportTableProps = {
  report: { columns: { key: string; label: string; type: string }[]; rows: Record<string, string | number | null>[] };
};

function ReportTable({ report }: ReportTableProps) {
  if (report.rows.length === 0) {
    return <p className="mt-3 text-sm text-slate-400">No data for this period.</p>;
  }
  return (
    <div className="mt-4 overflow-x-auto">
      <table className="min-w-full divide-y divide-slate-200 text-left text-sm">
        <thead>
          <tr>
            {report.columns.map((col) => (
              <th key={col.key} className="whitespace-nowrap px-3 py-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
                {col.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {report.rows.map((row, i) => (
            <tr key={i}>
              {report.columns.map((col) => {
                const val = row[col.key];
                let display: string;
                if (col.key === "engagementRate") {
                  display = typeof val === "number" ? `${(val * 100).toFixed(1)}%` : "—";
                } else if (col.type === "metric") {
                  display = typeof val === "number" ? new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(val) : "—";
                } else {
                  display = val !== null && val !== undefined ? String(val) : "—";
                }
                return (
                  <td key={col.key} className={`px-3 py-2 text-slate-700 ${col.type === "dimension" ? "max-w-xs break-words" : "whitespace-nowrap"}`}>
                    {display}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
