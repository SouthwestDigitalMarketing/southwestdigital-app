import "server-only";
import { BetaAnalyticsDataClient } from "@google-analytics/data";

export type DailyTrafficRow = {
  date: string;
  sessions: number;
  activeUsers: number;
};

export type MetricValue = number | null;

export type HeadlineMetrics = {
  activeUsers: MetricValue;
  sessions: MetricValue;
  engagementRate: MetricValue;
  newUsers: MetricValue;
  engagedSessions: MetricValue;
  pageViews: MetricValue;
  bounceRate: MetricValue;
  engagementDuration: MetricValue;
};

export type MetricComparison = {
  current: MetricValue;
  previous: MetricValue;
  percentageChange: number | null;
  direction: "increased" | "decreased" | "unchanged" | "unavailable";
};

export type SiteHeadline = {
  current: HeadlineMetrics;
  comparison: Record<keyof HeadlineMetrics, MetricComparison>;
};

export type TableRow = Record<string, string | number | null>;

export type ReportTable = {
  columns: { key: string; label: string; type: "dimension" | "metric" }[];
  rows: TableRow[];
};

export type SiteHealth = {
  headline: SiteHeadline;
  acquisition: ReportTable;
  landingPages: ReportTable;
  geographicTraffic: ReportTable;
  generatedAt: string;
};

function getCredentials(): { client_email: string; private_key: string } | null {
  const b64 = process.env.GOOGLE_SERVICE_ACCOUNT_JSON_BASE64?.trim();
  if (b64) {
    try {
      const json = JSON.parse(Buffer.from(b64, "base64").toString("utf8"));
      if (json.client_email && json.private_key) {
        return { client_email: json.client_email, private_key: json.private_key };
      }
    } catch {
      console.error("[analytics] Failed to parse GOOGLE_SERVICE_ACCOUNT_JSON_BASE64");
    }
  }

  const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL?.trim();
  const key = process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY?.trim();
  if (email && key) {
    return { client_email: email, private_key: key.replace(/\\n/g, "\n") };
  }

  return null;
}

let client: BetaAnalyticsDataClient | null = null;

function getClient(): BetaAnalyticsDataClient | null {
  const credentials = getCredentials();
  if (!credentials) return null;
  if (!client) {
    client = new BetaAnalyticsDataClient({ credentials });
  }
  return client;
}

function num(v: string | null | undefined): MetricValue {
  if (!v) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function compare(current: MetricValue, previous: MetricValue): MetricComparison {
  if (current === null || previous === null) {
    return { current, previous, percentageChange: null, direction: "unavailable" };
  }
  if (previous === 0 && current === 0) {
    return { current, previous, percentageChange: 0, direction: "unchanged" };
  }
  if (previous === 0) {
    return { current, previous, percentageChange: null, direction: "increased" };
  }
  const pct = ((current - previous) / previous) * 100;
  const direction = pct > 0.5 ? "increased" : pct < -0.5 ? "decreased" : "unchanged";
  return { current, previous, percentageChange: Math.round(pct * 10) / 10, direction };
}

export async function getTrafficTrend(
  propertyId: string,
  startDate: string,
  endDate: string,
): Promise<DailyTrafficRow[]> {
  const ga4 = getClient();
  if (!ga4) throw new Error("GA4 credentials not configured");

  const [response] = await ga4.runReport({
    property: `properties/${propertyId}`,
    dateRanges: [{ startDate, endDate }],
    dimensions: [{ name: "date" }],
    metrics: [{ name: "sessions" }, { name: "activeUsers" }],
    orderBys: [{ dimension: { dimensionName: "date" } }],
    keepEmptyRows: false,
  });

  return (response.rows ?? []).map((row) => {
    const raw = row.dimensionValues?.[0]?.value ?? "";
    const date =
      raw.length === 8
        ? `${raw.slice(0, 4)}-${raw.slice(4, 6)}-${raw.slice(6, 8)}`
        : raw;
    return {
      date,
      sessions: Number(row.metricValues?.[0]?.value ?? 0),
      activeUsers: Number(row.metricValues?.[1]?.value ?? 0),
    };
  });
}

export async function getSiteHealth(
  propertyId: string,
  startDate: string,
  endDate: string,
): Promise<SiteHealth> {
  const ga4 = getClient();
  if (!ga4) throw new Error("GA4 credentials not configured");

  const prop = `properties/${propertyId}`;
  const prevEnd = new Date(new Date(startDate).getTime() - 24 * 60 * 60 * 1000)
    .toISOString()
    .slice(0, 10);
  const prevStart = new Date(
    new Date(startDate).getTime() - (new Date(endDate).getTime() - new Date(startDate).getTime()) - 24 * 60 * 60 * 1000,
  )
    .toISOString()
    .slice(0, 10);

  const headlineMetrics = [
    { name: "activeUsers" },
    { name: "sessions" },
    { name: "engagementRate" },
    { name: "newUsers" },
    { name: "engagedSessions" },
    { name: "screenPageViews" },
    { name: "bounceRate" },
    { name: "userEngagementDuration" },
  ];

  const [headlineCurrent, headlinePrevious, acquisitionRes, landingRes, geoRes] =
    await Promise.all([
      ga4.runReport({
        property: prop,
        dateRanges: [{ startDate, endDate }],
        metrics: headlineMetrics,
        keepEmptyRows: false,
      }),
      ga4.runReport({
        property: prop,
        dateRanges: [{ startDate: prevStart, endDate: prevEnd }],
        metrics: headlineMetrics,
        keepEmptyRows: false,
      }),
      ga4.runReport({
        property: prop,
        dateRanges: [{ startDate, endDate }],
        dimensions: [{ name: "sessionDefaultChannelGrouping" }],
        metrics: [
          { name: "sessions" },
          { name: "activeUsers" },
          { name: "engagementRate" },
          { name: "keyEvents" },
        ],
        orderBys: [{ metric: { metricName: "sessions" }, desc: true }],
        limit: 10,
        keepEmptyRows: false,
      }),
      ga4.runReport({
        property: prop,
        dateRanges: [{ startDate, endDate }],
        dimensions: [{ name: "landingPagePlusQueryString" }],
        metrics: [{ name: "sessions" }, { name: "activeUsers" }, { name: "engagementRate" }],
        orderBys: [{ metric: { metricName: "sessions" }, desc: true }],
        limit: 10,
        keepEmptyRows: false,
      }),
      ga4.runReport({
        property: prop,
        dateRanges: [{ startDate, endDate }],
        dimensions: [{ name: "country" }, { name: "region" }],
        metrics: [{ name: "sessions" }, { name: "activeUsers" }],
        orderBys: [{ metric: { metricName: "sessions" }, desc: true }],
        limit: 10,
        keepEmptyRows: false,
      }),
    ]);

  const mv = (res: typeof headlineCurrent[0], idx: number) =>
    num(res.rows?.[0]?.metricValues?.[idx]?.value);

  const cur: HeadlineMetrics = {
    activeUsers: mv(headlineCurrent[0], 0),
    sessions: mv(headlineCurrent[0], 1),
    engagementRate: mv(headlineCurrent[0], 2),
    newUsers: mv(headlineCurrent[0], 3),
    engagedSessions: mv(headlineCurrent[0], 4),
    pageViews: mv(headlineCurrent[0], 5),
    bounceRate: mv(headlineCurrent[0], 6),
    engagementDuration: mv(headlineCurrent[0], 7),
  };

  const prev: HeadlineMetrics = {
    activeUsers: mv(headlinePrevious[0], 0),
    sessions: mv(headlinePrevious[0], 1),
    engagementRate: mv(headlinePrevious[0], 2),
    newUsers: mv(headlinePrevious[0], 3),
    engagedSessions: mv(headlinePrevious[0], 4),
    pageViews: mv(headlinePrevious[0], 5),
    bounceRate: mv(headlinePrevious[0], 6),
    engagementDuration: mv(headlinePrevious[0], 7),
  };

  const acquisition: ReportTable = {
    columns: [
      { key: "channel", label: "Channel", type: "dimension" },
      { key: "sessions", label: "Sessions", type: "metric" },
      { key: "activeUsers", label: "Users", type: "metric" },
      { key: "engagementRate", label: "Engagement rate", type: "metric" },
      { key: "keyEvents", label: "Key events", type: "metric" },
    ],
    rows: (acquisitionRes[0].rows ?? []).map((row) => ({
      channel: row.dimensionValues?.[0]?.value ?? "",
      sessions: num(row.metricValues?.[0]?.value),
      activeUsers: num(row.metricValues?.[1]?.value),
      engagementRate: num(row.metricValues?.[2]?.value),
      keyEvents: num(row.metricValues?.[3]?.value),
    })),
  };

  const landingPages: ReportTable = {
    columns: [
      { key: "page", label: "Page", type: "dimension" },
      { key: "sessions", label: "Sessions", type: "metric" },
      { key: "activeUsers", label: "Users", type: "metric" },
      { key: "engagementRate", label: "Engagement rate", type: "metric" },
    ],
    rows: (landingRes[0].rows ?? []).map((row) => ({
      page: row.dimensionValues?.[0]?.value ?? "",
      sessions: num(row.metricValues?.[0]?.value),
      activeUsers: num(row.metricValues?.[1]?.value),
      engagementRate: num(row.metricValues?.[2]?.value),
    })),
  };

  const geographicTraffic: ReportTable = {
    columns: [
      { key: "country", label: "Country", type: "dimension" },
      { key: "region", label: "Region", type: "dimension" },
      { key: "sessions", label: "Sessions", type: "metric" },
      { key: "activeUsers", label: "Users", type: "metric" },
    ],
    rows: (geoRes[0].rows ?? []).map((row) => ({
      country: row.dimensionValues?.[0]?.value ?? "",
      region: row.dimensionValues?.[1]?.value ?? "",
      sessions: num(row.metricValues?.[0]?.value),
      activeUsers: num(row.metricValues?.[1]?.value),
    })),
  };

  return {
    headline: {
      current: cur,
      comparison: {
        activeUsers: compare(cur.activeUsers, prev.activeUsers),
        sessions: compare(cur.sessions, prev.sessions),
        engagementRate: compare(cur.engagementRate, prev.engagementRate),
        newUsers: compare(cur.newUsers, prev.newUsers),
        engagedSessions: compare(cur.engagedSessions, prev.engagedSessions),
        pageViews: compare(cur.pageViews, prev.pageViews),
        bounceRate: compare(cur.bounceRate, prev.bounceRate),
        engagementDuration: compare(cur.engagementDuration, prev.engagementDuration),
      },
    },
    acquisition,
    landingPages,
    geographicTraffic,
    generatedAt: new Date().toISOString(),
  };
}
