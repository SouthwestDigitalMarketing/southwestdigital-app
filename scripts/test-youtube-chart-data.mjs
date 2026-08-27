import { readFileSync } from "fs";

const env = Object.fromEntries(
  readFileSync(".env.local", "utf8")
    .split("\n")
    .filter((l) => l.includes("="))
    .map((l) => {
      const i = l.indexOf("=");
      return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^"|"$/g, "")];
    }),
);

const clientId = env.YOUTUBE_OAUTH_CLIENT_ID;
const clientSecret = env.YOUTUBE_OAUTH_CLIENT_SECRET;
const refreshToken = env.YOUTUBE_REFRESH_TOKEN_BC;
const channelId = "UCJvU8wmKfTw7mWFNo4TUzdg";

const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
  method: "POST",
  headers: { "Content-Type": "application/x-www-form-urlencoded" },
  body: new URLSearchParams({ client_id: clientId, client_secret: clientSecret, refresh_token: refreshToken, grant_type: "refresh_token" }),
});
const { access_token } = await tokenRes.json();

const now = Date.now();
const endDate = new Date(now).toISOString().slice(0, 10);
const startDate = new Date(now - 29 * 86400000).toISOString().slice(0, 10);
const TOP_N = 5;

// Simulate getTopVideos
const topParams = new URLSearchParams({
  ids: `channel==${channelId}`, startDate, endDate,
  dimensions: "video", metrics: "views,estimatedMinutesWatched,averageViewPercentage",
  sort: "-views", maxResults: String(TOP_N),
});
const topRes = await fetch(`https://youtubeanalytics.googleapis.com/v2/reports?${topParams}`, { headers: { Authorization: `Bearer ${access_token}` } });
const topData = await topRes.json();
const topVideoIds = (topData.rows ?? []).slice(0, TOP_N).map(r => r[0]);
console.log("Top video IDs:", topVideoIds);

// Simulate getDailyViewsForVideos
let dailyByVideo = [];
for (const videoId of topVideoIds) {
  const params = new URLSearchParams({
    ids: `channel==${channelId}`, startDate, endDate,
    dimensions: "day", metrics: "views", sort: "day",
    filters: `video==${videoId}`,
  });
  const res = await fetch(`https://youtubeanalytics.googleapis.com/v2/reports?${params}`, { headers: { Authorization: `Bearer ${access_token}` } });
  const json = await res.json();
  const rows = (json.rows ?? []).map(([date, views]) => ({
    date: date.replace(/^(\d{4})(\d{2})(\d{2})$/, "$1-$2-$3"),
    videoId,
    views,
  }));
  console.log(`  video ${videoId}: ${rows.length} rows, sample: ${JSON.stringify(rows[0])}`);
  dailyByVideo.push(...rows);
}
console.log("dailyByVideo total rows:", dailyByVideo.length);

// Fallback if empty
if (dailyByVideo.length === 0) {
  console.log("FALLBACK triggered");
  const dailyRes = await fetch(
    `https://youtubeanalytics.googleapis.com/v2/reports?${new URLSearchParams({ ids: `channel==${channelId}`, startDate, endDate, metrics: "views", dimensions: "day", sort: "day" })}`,
    { headers: { Authorization: `Bearer ${access_token}` } }
  );
  const json = await dailyRes.json();
  dailyByVideo = (json.rows ?? []).map(([date, views]) => ({
    date: date.replace(/^(\d{4})(\d{2})(\d{2})$/, "$1-$2-$3"),
    videoId: "__total",
    views,
  }));
  console.log("Fallback dailyByVideo rows:", dailyByVideo.length);
}

// Build chart data (mirrors page.tsx exactly)
const allDates = Array.from({ length: 30 }, (_, i) =>
  new Date(now - (29 - i) * 86400000).toISOString().slice(0, 10),
);
const isFallbackMode = dailyByVideo.length > 0 && dailyByVideo[0].videoId === "__total";
const dateMap = new Map();
for (const date of allDates) dateMap.set(date, {});
let hasOther = false;
for (const { date, videoId, views } of dailyByVideo) {
  if (!dateMap.has(date)) dateMap.set(date, {});
  const day = dateMap.get(date);
  if (isFallbackMode || topVideoIds.includes(videoId)) {
    day[videoId] = (day[videoId] ?? 0) + views;
  } else {
    day["other"] = (day["other"] ?? 0) + views;
    hasOther = true;
  }
}
const stackedRows = allDates.map((date) => ({ date, ...dateMap.get(date) }));

console.log("\nisFallbackMode:", isFallbackMode);
console.log("hasOther:", hasOther);
console.log("stackedRows[0]:", JSON.stringify(stackedRows[0]));
console.log("stackedRows[5]:", JSON.stringify(stackedRows[5]));
console.log("stackedRows[29]:", JSON.stringify(stackedRows[29]));

// Check if any rows have data
const rowsWithData = stackedRows.filter(r => Object.keys(r).length > 1);
console.log("rows with view data:", rowsWithData.length, "of", stackedRows.length);
