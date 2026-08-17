import "server-only";

export type DailyViewRow = { date: string; views: number };

type TokenResponse = { access_token: string; expires_in: number };

let cachedToken: { value: string; expiresAt: number } | null = null;

async function getAccessToken(refreshToken: string): Promise<string> {
  if (cachedToken && Date.now() < cachedToken.expiresAt) {
    return cachedToken.value;
  }

  const clientId = process.env.YOUTUBE_OAUTH_CLIENT_ID?.trim();
  const clientSecret = process.env.YOUTUBE_OAUTH_CLIENT_SECRET?.trim();

  if (!clientId || !clientSecret) {
    throw new Error("YouTube OAuth credentials not configured (YOUTUBE_OAUTH_CLIENT_ID, YOUTUBE_OAUTH_CLIENT_SECRET)");
  }

  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    }),
  });

  if (!res.ok) throw new Error(`YouTube token refresh failed: ${await res.text()}`);

  const data = (await res.json()) as TokenResponse;
  cachedToken = {
    value: data.access_token,
    expiresAt: Date.now() + (data.expires_in - 60) * 1000,
  };
  return data.access_token;
}

export async function getDailyViews(
  channelId: string,
  refreshToken: string,
  startDate: string,
  endDate: string,
): Promise<DailyViewRow[]> {
  const accessToken = await getAccessToken(refreshToken);

  const params = new URLSearchParams({
    ids: `channel==${channelId}`,
    startDate,
    endDate,
    metrics: "views",
    dimensions: "day",
    sort: "day",
  });

  const res = await fetch(
    `https://youtubeanalytics.googleapis.com/v2/reports?${params}`,
    { headers: { Authorization: `Bearer ${accessToken}` } },
  );

  if (!res.ok) throw new Error(`YouTube Analytics API error: ${await res.text()}`);

  const json = (await res.json()) as { rows?: [string, number][] };
  return (json.rows ?? []).map(([date, views]) => ({ date, views }));
}
