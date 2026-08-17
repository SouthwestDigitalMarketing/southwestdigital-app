import { NextResponse } from "next/server";
import { BetaAnalyticsDataClient } from "@google-analytics/data";

export const dynamic = "force-dynamic";

function getClient() {
  const b64 = process.env.GOOGLE_SERVICE_ACCOUNT_JSON_BASE64?.trim();
  if (b64) {
    try {
      const json = JSON.parse(Buffer.from(b64, "base64").toString("utf8"));
      if (json.client_email && json.private_key) {
        return new BetaAnalyticsDataClient({ credentials: json });
      }
    } catch {}
  }
  const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL?.trim();
  const key = process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY?.trim();
  if (email && key) {
    return new BetaAnalyticsDataClient({ credentials: { client_email: email, private_key: key.replace(/\\n/g, "\n") } });
  }
  return null;
}

export async function GET() {
  const ga4 = getClient();
  if (!ga4) return NextResponse.json({ error: "No credentials" }, { status: 500 });

  const propertyId = "479310215";
  const [response] = await ga4.runReport({
    property: `properties/${propertyId}`,
    dateRanges: [{ startDate: "30daysAgo", endDate: "today" }],
    dimensions: [{ name: "hostName" }],
    metrics: [{ name: "sessions" }],
    orderBys: [{ metric: { metricName: "sessions" }, desc: true }],
    limit: 20,
  });

  const rows = (response.rows ?? []).map((r) => ({
    hostName: r.dimensionValues?.[0]?.value,
    sessions: r.metricValues?.[0]?.value,
  }));

  return NextResponse.json(rows);
}
