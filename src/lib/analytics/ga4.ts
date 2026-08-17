import "server-only";
import { BetaAnalyticsDataClient } from "@google-analytics/data";

export type DailyTrafficRow = {
  date: string;
  sessions: number;
  activeUsers: number;
};

function getCredentials(): { client_email: string; private_key: string } | null {
  // Preferred: base64-encoded full service account JSON
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

  // Fallback: separate email + key env vars
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
