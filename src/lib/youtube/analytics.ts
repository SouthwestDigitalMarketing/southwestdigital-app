import "server-only";

export type DailyViewRow = { date: string; views: number };

export type ChannelMetrics = {
  views: number;
  estimatedMinutesWatched: number;
  averageViewPercentage: number;
};

export type TopVideoRow = {
  videoId: string;
  title: string;
  thumbnailUrl: string;
  views: number;
  estimatedMinutesWatched: number;
  averageViewPercentage: number;
};

type TokenResponse = { access_token: string; expires_in: number };

let cachedToken: { refreshToken: string; value: string; expiresAt: number } | null = null;

export async function getAccessToken(refreshToken: string): Promise<string> {
  if (cachedToken?.refreshToken === refreshToken && Date.now() < cachedToken.expiresAt) {
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

  if (!res.ok) {
    const body = await res.text();
    let reason = body;
    try {
      const parsed = JSON.parse(body) as { error?: string; error_description?: string };
      reason = parsed.error_description || parsed.error || body;
      if (parsed.error === "invalid_grant") {
        throw new Error(
          "YouTube refresh token expired or revoked. Run node scripts/get-youtube-token.mjs and update YOUTUBE_REFRESH_TOKEN_<SLUG>.",
        );
      }
    } catch (error) {
      if (error instanceof Error && error.message.startsWith("YouTube refresh token")) throw error;
    }
    throw new Error(`YouTube token refresh failed: ${reason}`);
  }

  const data = (await res.json()) as TokenResponse;
  cachedToken = {
    refreshToken,
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
  // API returns dates as YYYYMMDD — normalise to YYYY-MM-DD
  return (json.rows ?? []).map(([date, views]) => ({
    date: date.replace(/^(\d{4})(\d{2})(\d{2})$/, "$1-$2-$3"),
    views,
  }));
}

export async function getChannelMetrics(
  channelId: string,
  refreshToken: string,
  startDate: string,
  endDate: string,
): Promise<ChannelMetrics> {
  const accessToken = await getAccessToken(refreshToken);

  const params = new URLSearchParams({
    ids: `channel==${channelId}`,
    startDate,
    endDate,
    metrics: "views,estimatedMinutesWatched,averageViewPercentage",
  });

  const res = await fetch(
    `https://youtubeanalytics.googleapis.com/v2/reports?${params}`,
    { headers: { Authorization: `Bearer ${accessToken}` } },
  );

  if (!res.ok) throw new Error(`YouTube Analytics API error: ${await res.text()}`);

  const json = (await res.json()) as { rows?: [number, number, number][] };
  const row = json.rows?.[0];
  return {
    views: row?.[0] ?? 0,
    estimatedMinutesWatched: row?.[1] ?? 0,
    averageViewPercentage: row?.[2] ?? 0,
  };
}

export async function getTopVideos(
  channelId: string,
  refreshToken: string,
  startDate: string,
  endDate: string,
  limit = 10,
): Promise<TopVideoRow[]> {
  const accessToken = await getAccessToken(refreshToken);

  const params = new URLSearchParams({
    ids: `channel==${channelId}`,
    startDate,
    endDate,
    dimensions: "video",
    metrics: "views,estimatedMinutesWatched,averageViewPercentage",
    sort: "-views",
    maxResults: String(limit),
  });

  const res = await fetch(
    `https://youtubeanalytics.googleapis.com/v2/reports?${params}`,
    { headers: { Authorization: `Bearer ${accessToken}` } },
  );

  if (!res.ok) throw new Error(`YouTube Analytics API error: ${await res.text()}`);

  const json = (await res.json()) as { rows?: [string, number, number, number][] };
  const rows = json.rows ?? [];
  if (rows.length === 0) return [];

  // Fetch video titles from YouTube Data API v3 (same OAuth token)
  const videoIds = rows.map((r) => r[0]).join(",");
  let titleMap = new Map<string, string>();
  try {
    const titlesRes = await fetch(
      `https://www.googleapis.com/youtube/v3/videos?part=snippet&id=${encodeURIComponent(videoIds)}`,
      { headers: { Authorization: `Bearer ${accessToken}` } },
    );
    if (titlesRes.ok) {
      type YTItem = { id: string; snippet: { title: string } };
      const data = (await titlesRes.json()) as { items?: YTItem[] };
      titleMap = new Map((data.items ?? []).map((v) => [v.id, v.snippet.title]));
    }
  } catch {
    // Fall through — video IDs used as fallback titles
  }

  return rows.map(([videoId, views, estimatedMinutesWatched, averageViewPercentage]) => ({
    videoId,
    title: titleMap.get(videoId) ?? videoId,
    thumbnailUrl: `https://i.ytimg.com/vi/${videoId}/mqdefault.jpg`,
    views,
    estimatedMinutesWatched,
    averageViewPercentage,
  }));
}

export type DailyViewByVideoRow = { date: string; videoId: string; views: number };

export async function getAverageWatchDuration(
  channelId: string,
  refreshToken: string,
  startDate: string,
  endDate: string,
): Promise<number> {
  const accessToken = await getAccessToken(refreshToken);

  const params = new URLSearchParams({
    ids: `channel==${channelId}`,
    startDate,
    endDate,
    metrics: "averageViewDuration",
  });

  const res = await fetch(
    `https://youtubeanalytics.googleapis.com/v2/reports?${params}`,
    { headers: { Authorization: `Bearer ${accessToken}` } },
  );

  if (!res.ok) throw new Error(`YouTube Analytics API error: ${await res.text()}`);

  const json = (await res.json()) as { rows?: [number][] };
  return json.rows?.[0]?.[0] ?? 0;
}

export async function getDailyViewsForVideos(
  channelId: string,
  refreshToken: string,
  startDate: string,
  endDate: string,
  videoIds: string[],
): Promise<DailyViewByVideoRow[]> {
  if (videoIds.length === 0) return [];
  const accessToken = await getAccessToken(refreshToken);

  const results = await Promise.all(
    videoIds.map(async (videoId) => {
      const params = new URLSearchParams({
        ids: `channel==${channelId}`,
        startDate,
        endDate,
        dimensions: "day",
        metrics: "views",
        sort: "day",
        filters: `video==${videoId}`,
      });
      const res = await fetch(
        `https://youtubeanalytics.googleapis.com/v2/reports?${params}`,
        { headers: { Authorization: `Bearer ${accessToken}` } },
      );
      const rawText = await res.text();
      if (!res.ok) {
        console.error(`[youtube] getDailyViewsForVideos error for ${videoId}: status=${res.status}`, rawText);
        return [] as DailyViewByVideoRow[];
      }
      const json = JSON.parse(rawText) as { rows?: [string, number][] };
      const rows = json.rows ?? [];
      if (rows.length === 0) {
        console.warn(`[youtube] per-video ${videoId}: 0 rows — response:`, rawText.slice(0, 300));
      }
      return rows.map(([date, views]) => ({
        date: date.replace(/^(\d{4})(\d{2})(\d{2})$/, "$1-$2-$3"),
        videoId,
        views,
      }));
    }),
  );

  return results.flat();
}
