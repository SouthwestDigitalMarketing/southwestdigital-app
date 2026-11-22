import type { HeadlineMetrics, MetricComparison, ReportTable, SiteHealth } from "@/lib/analytics/ga4";
import type { TrafficComparisonRow } from "./SiteTrafficGraph";

const additive: (keyof HeadlineMetrics)[] = ["activeUsers", "sessions", "newUsers", "engagedSessions", "pageViews", "engagementDuration"];
const rates: (keyof HeadlineMetrics)[] = ["engagementRate", "bounceRate"];

function sum(values: (number | null)[]): number | null {
  return values.every((value) => value === null) ? null : values.reduce<number>((total, value) => total + (value ?? 0), 0);
}

function weighted(values: { rate: number | null; sessions: number | null }[]): number | null {
  const available = values.filter((row): row is { rate: number; sessions: number } => row.rate !== null && row.sessions !== null);
  const sessions = available.reduce((total, row) => total + row.sessions, 0);
  return sessions > 0 ? available.reduce((total, row) => total + row.rate * row.sessions, 0) / sessions : null;
}

function combineMetrics(metrics: HeadlineMetrics[]): HeadlineMetrics {
  const result = {} as HeadlineMetrics;
  for (const key of additive) result[key] = sum(metrics.map((row) => row[key]));
  for (const key of rates) result[key] = weighted(metrics.map((row) => ({ rate: row[key], sessions: row.sessions })));
  return result;
}

function compare(current: number | null, previous: number | null): MetricComparison {
  if (current === null || previous === null) return { current, previous, percentageChange: null, direction: "unavailable" };
  if (previous === 0) return { current, previous, percentageChange: current === 0 ? 0 : null, direction: current === 0 ? "unchanged" : "increased" };
  const percentageChange = Math.round(((current - previous) / previous) * 1000) / 10;
  return { current, previous, percentageChange, direction: percentageChange > 0.5 ? "increased" : percentageChange < -0.5 ? "decreased" : "unchanged" };
}

function combineTable(tables: ReportTable[]): ReportTable {
  const columns = tables[0].columns;
  const dimensionKeys = columns.filter((column) => column.type === "dimension").map((column) => column.key);
  const metricKeys = columns.filter((column) => column.type === "metric").map((column) => column.key);
  const rows = new Map<string, Record<string, string | number | null>>();
  for (const table of tables) for (const row of table.rows) {
    const key = JSON.stringify(dimensionKeys.map((dimension) => row[dimension]));
    const existing = rows.get(key) ?? Object.fromEntries(dimensionKeys.map((dimension) => [dimension, row[dimension]]));
    const previousSessions = Number(existing.sessions ?? 0);
    const rowSessions = Number(row.sessions ?? 0);
    for (const metric of metricKeys) {
      const value = row[metric];
      if (metric === "engagementRate") {
        const oldRate = Number(existing[metric] ?? 0);
        const newRate = Number(value ?? 0);
        existing[metric] = previousSessions + rowSessions > 0 ? (oldRate * previousSessions + newRate * rowSessions) / (previousSessions + rowSessions) : null;
      } else existing[metric] = Number(existing[metric] ?? 0) + Number(value ?? 0);
    }
    rows.set(key, existing);
  }
  return { columns, rows: [...rows.values()].sort((a, b) => Number(b.sessions ?? 0) - Number(a.sessions ?? 0)).slice(0, 10) };
}

export function combineSiteHealth(reports: [SiteHealth, SiteHealth]): SiteHealth {
  const current = combineMetrics(reports.map((report) => report.headline.current));
  const previous = combineMetrics(reports.map((report) => Object.fromEntries(
    Object.entries(report.headline.comparison).map(([key, value]) => [key, value.previous]),
  ) as HeadlineMetrics));
  const comparison = {} as SiteHealth["headline"]["comparison"];
  for (const key of [...additive, ...rates]) comparison[key] = compare(current[key], previous[key]);
  return {
    headline: { current, comparison },
    acquisition: combineTable(reports.map((report) => report.acquisition)),
    landingPages: combineTable(reports.map((report) => report.landingPages)),
    geographicTraffic: combineTable(reports.map((report) => report.geographicTraffic)),
    generatedAt: reports[0].generatedAt > reports[1].generatedAt ? reports[0].generatedAt : reports[1].generatedAt,
  };
}

export function combineTrafficTrends(trends: [TrafficComparisonRow[], TrafficComparisonRow[]]): TrafficComparisonRow[] {
  const rows = new Map<string, TrafficComparisonRow>();
  for (const trend of trends) for (const row of trend) {
    const existing = rows.get(row.date) ?? { date: row.date, current: 0, previous: 0 };
    existing.current += row.current;
    existing.previous += row.previous;
    rows.set(row.date, existing);
  }
  return [...rows.values()].sort((a, b) => a.date.localeCompare(b.date));
}
