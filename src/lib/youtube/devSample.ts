import type { SourceTagClickReport } from "@/lib/cloudflare/redirectClicks";
import type { ChannelMetrics, DailyViewByVideoRow, DailyViewRow, TopVideoRow } from "./analytics";
import type { SourceTagVideo } from "./sourceTagVideos";

/**
 * Sample YouTube and link-click numbers for local development (Tom, 2026-11-24). A local copy cannot read
 * the production YouTube connection (it is encrypted with production secrets Vercel will not hand out), so
 * pages that show channel numbers were blank on the dev server. With SWAPP_DEV_SAMPLE_YOUTUBE=1 under
 * `next dev`, the YouTube and click readers return these made-up numbers instead and the page says so.
 * Never on in production: NODE_ENV must be "development".
 */
export const SAMPLE_REFRESH_TOKEN = "dev-sample-youtube";

export function youtubeSampleMode(env: Record<string, string | undefined> = process.env): boolean {
  return env.NODE_ENV === "development" && env.SWAPP_DEV_SAMPLE_YOUTUBE === "1";
}

// Real titles and IDs from the channel, so thumbnails load; every number is invented.
const VIDEOS = [
  { videoId: "M4rCoX4CAoM", title: "The BEST Receive Payments Tutorial for QuickBooks Online", weight: 9 },
  { videoId: "BH6Z0mxElQI", title: "Should You Start a Bookkeeping Business in 2026", weight: 7 },
  { videoId: "_z073VxXOWQ", title: "Watch Me Get Bookkeeping Leads by Calling Local Businesses", weight: 5 },
  { videoId: "0LwjeVZpges", title: "What Starting a Bookkeeping Business Really Costs You", weight: 4 },
  { videoId: "KgD4Sda48UQ", title: "Get Bookkeeping Leads With This Free Offer", weight: 3 },
  { videoId: "Smsa6i-RL5U", title: "Should You Get An Office For Your Bookkeeping Business?", weight: 2 },
];
const TOTAL_WEIGHT = VIDEOS.reduce((n, v) => n + v.weight, 0);
const thumb = (id: string) => `https://i.ytimg.com/vi/${id}/mqdefault.jpg`;

function days(startDate: string, endDate: string): string[] {
  const out: string[] = [];
  for (let t = Date.parse(startDate + "T00:00:00Z"); t <= Date.parse(endDate + "T00:00:00Z"); t += 86_400_000) {
    out.push(new Date(t).toISOString().slice(0, 10));
  }
  return out;
}

/** Same date, same number: a weekly wave around ~280 views a day, steady across reloads. */
function dayViews(date: string): number {
  const n = Date.parse(date + "T00:00:00Z") / 86_400_000;
  return Math.round(280 + 90 * Math.sin(n / 3.5) + 40 * Math.sin(n * 1.7));
}

export function sampleDailyViews(startDate: string, endDate: string): DailyViewRow[] {
  return days(startDate, endDate).map((date) => ({ date, views: dayViews(date) }));
}

export function sampleChannelMetrics(startDate: string, endDate: string): ChannelMetrics {
  const views = sampleDailyViews(startDate, endDate).reduce((n, d) => n + d.views, 0);
  return { views, estimatedMinutesWatched: Math.round(views * 2.9), averageViewPercentage: 34.6 };
}

export function sampleTopVideos(startDate: string, endDate: string): TopVideoRow[] {
  const total = sampleChannelMetrics(startDate, endDate).views;
  return VIDEOS.map((v, i) => {
    const views = Math.round((total * v.weight) / TOTAL_WEIGHT);
    return { videoId: v.videoId, title: v.title, thumbnailUrl: thumb(v.videoId), views,
      estimatedMinutesWatched: Math.round(views * (3.4 - i * 0.3)), averageViewPercentage: 41 - i * 3.5 };
  });
}

export function sampleDailyViewsForVideos(startDate: string, endDate: string, videoIds: string[]): DailyViewByVideoRow[] {
  return days(startDate, endDate).flatMap((date) => videoIds.map((videoId) => {
    const weight = VIDEOS.find((v) => v.videoId === videoId)?.weight ?? 1;
    return { date, videoId, views: Math.round((dayViews(date) * weight) / TOTAL_WEIGHT) };
  }));
}

const TAGS = ["a", "b", "c", "d"];

export function sampleSourceTagVideos(): Map<string, SourceTagVideo> {
  return new Map(TAGS.map((tag, i) => [tag, { title: VIDEOS[i].title, videoId: VIDEOS[i].videoId, thumbnailUrl: thumb(VIDEOS[i].videoId) }]));
}

export function sampleClickReport(now = new Date(), since = "2026-08-09"): SourceTagClickReport {
  // Fewer clicks for a shorter span, so a month reads smaller than all time.
  const share = Math.min(1, Math.max(0.05, (now.getTime() - Date.parse(since + "T00:00:00Z")) / (107 * 86_400_000)));
  const byTag = TAGS.map((tag, i) => ({ tag, clicks: Math.max(1, Math.round([96, 61, 38, 19][i] * share)) }));
  return { totalClicks: byTag.reduce((n, t) => n + t.clicks, 0), byTag, epochDate: since, generatedAt: now.toISOString() };
}
