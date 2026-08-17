import "server-only";
import { BetaAnalyticsDataClient } from "@google-analytics/data";

export type DailyTrafficRow = {
  date: string;
  sessions: number;
  activeUsers: number;
};

function normalizePrivateKey(value: string) {
  return value.replace(/\\n/g, "\n");
}

let client: BetaAnalyticsDataClient | null = null;

function getClient(): BetaAnalyticsDataClient | null {
  const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL?.trim();
  const key = process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY?.trim();
  if (!email || !key) return null;
  if (!client) {
    client = new BetaAnalyticsDataClient({
      credentials: {
        client_email: email,
        private_key: normalizePrivateKey(key),
      },
    });
  }
  return client;
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
