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

// Get access token
const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
  method: "POST",
  headers: { "Content-Type": "application/x-www-form-urlencoded" },
  body: new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    refresh_token: refreshToken,
    grant_type: "refresh_token",
  }),
});
const { access_token } = await tokenRes.json();
console.log("Token OK:", !!access_token);

// Get channel ID from BrandTheme (hardcoded from DB for test)
// First let's find it by calling the channel list
const channelRes = await fetch(
  "https://www.googleapis.com/youtube/v3/channels?part=id,snippet&mine=true",
  { headers: { Authorization: `Bearer ${access_token}` } },
);
const channelData = await channelRes.json();
console.log("Channel:", JSON.stringify(channelData?.items?.[0]?.id), channelData?.items?.[0]?.snippet?.title);

const channelId = channelData?.items?.[0]?.id;
if (!channelId) { console.error("No channel ID"); process.exit(1); }

const now = Date.now();
const endDate = new Date(now).toISOString().slice(0, 10);
const startDate = new Date(now - 29 * 86400000).toISOString().slice(0, 10);
console.log("Date range:", startDate, "→", endDate);

// Test getDailyViews
const dailyParams = new URLSearchParams({
  ids: `channel==${channelId}`,
  startDate,
  endDate,
  metrics: "views",
  dimensions: "day",
  sort: "day",
});
const dailyRes = await fetch(
  `https://youtubeanalytics.googleapis.com/v2/reports?${dailyParams}`,
  { headers: { Authorization: `Bearer ${access_token}` } },
);
const dailyData = await dailyRes.json();
console.log("\n--- getDailyViews raw response ---");
console.log("Status:", dailyRes.status, "| rows:", dailyData.rows?.length ?? 0);
if (dailyData.rows?.length) {
  console.log("First row:", JSON.stringify(dailyData.rows[0]));
  console.log("Last row:", JSON.stringify(dailyData.rows[dailyData.rows.length - 1]));
}

// Test per-video filter call (first top video)
const topParams = new URLSearchParams({
  ids: `channel==${channelId}`,
  startDate,
  endDate,
  dimensions: "video",
  metrics: "views,estimatedMinutesWatched,averageViewPercentage",
  sort: "-views",
  maxResults: "1",
});
const topRes = await fetch(`https://youtubeanalytics.googleapis.com/v2/reports?${topParams}`, {
  headers: { Authorization: `Bearer ${access_token}` },
});
const topData = await topRes.json();
const topVideoId = topData.rows?.[0]?.[0];
console.log("\n--- Top video ID ---");
console.log(topVideoId);

if (topVideoId) {
  const perVideoParams = new URLSearchParams({
    ids: `channel==${channelId}`,
    startDate,
    endDate,
    dimensions: "day",
    metrics: "views",
    sort: "day",
    filters: `video==${topVideoId}`,
  });
  const perVideoRes = await fetch(`https://youtubeanalytics.googleapis.com/v2/reports?${perVideoParams}`, {
    headers: { Authorization: `Bearer ${access_token}` },
  });
  const perVideoData = await perVideoRes.json();
  console.log("\n--- Per-video filter call ---");
  console.log("Status:", perVideoRes.status, "| rows:", perVideoData.rows?.length ?? 0);
  if (perVideoData.rows?.length) {
    console.log("First row:", JSON.stringify(perVideoData.rows[0]));
  } else {
    console.log("Full response:", JSON.stringify(perVideoData, null, 2));
  }
}
