import Link from "next/link";
import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import { requireAppBrand } from "@/lib/brands/staff";
import { getTopVideos } from "@/lib/youtube/analytics";
import { getYouTubeRefreshToken } from "@/lib/youtube/credentials";
import { getChannelUploads } from "@/lib/youtube/uploads";
import type { VideoListItem } from "../VideoList";
import { AllVideosBrowser } from "./AllVideosBrowser";
import { VIEW_COOKIE } from "./view";

export const dynamic = "force-dynamic";

function published(iso: string) {
  if (!iso) return undefined;
  const date = new Date(iso).toLocaleDateString("en-US", { timeZone: "America/Chicago", month: "short", day: "numeric", year: "numeric" });
  return `Published ${date}`;
}

async function loadVideos(brandId: string, slug: string): Promise<{ videos: VideoListItem[] } | { error: string }> {
  const theme = await prisma.brandTheme.findUnique({ where: { brandId }, select: { youtubeChannelId: true } });
  if (!theme?.youtubeChannelId) return { error: "YouTube channel not configured for this brand." };
  const refreshToken = await getYouTubeRefreshToken(brandId, slug);
  if (!refreshToken) return { error: "The saved YouTube connection could not be read here." };
  const channelId = theme.youtubeChannelId;

  try {
    const uploads = await getChannelUploads(channelId, refreshToken);
    const oldest = uploads.at(-1)?.publishedAt.slice(0, 10) || "2010-01-01";
    const today = new Date().toISOString().slice(0, 10);
    // Lifetime numbers; analytics lag 2–3 days, so the newest uploads may still read 0.
    const stats = new Map(
      (await getTopVideos(channelId, refreshToken, oldest, today, 200)).map((row) => [row.videoId, row]),
    );
    return {
      videos: uploads.map((upload) => {
        const row = stats.get(upload.videoId);
        return {
          videoId: upload.videoId,
          title: upload.title,
          thumbnailUrl: upload.thumbnailUrl,
          detail: published(upload.publishedAt),
          views: row?.views ?? 0,
          averageViewPercentage: row?.averageViewPercentage ?? 0,
          estimatedMinutesWatched: row?.estimatedMinutesWatched ?? 0,
        };
      }),
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.warn("[youtube/videos] API skipped:", message);
    return { error: message };
  }
}

export default async function AllVideosPage() {
  const { brand } = await requireAppBrand();
  const result = await loadVideos(brand.id, brand.slug);
  const view = (await cookies()).get(VIEW_COOKIE)?.value === "condensed" ? "condensed" : "detailed";

  return (
    <div className="p-4 sm:p-8">
      <Link href="/youtube" className="text-sm text-slate-600 underline">Back to YouTube</Link>
      <h1 className="mt-4 text-2xl font-semibold text-slate-900">All videos</h1>
      <p className="mt-1 text-sm text-slate-500">Numbers are all time; the last 2–3 days may not be counted yet.</p>
      {"error" in result ? (
        <div className="mt-4 rounded-xl border border-slate-200 bg-white px-5 py-4 text-sm text-amber-900">
          {result.error} <a className="font-semibold underline" href="/api/youtube/connect">Connect YouTube</a>.
        </div>
      ) : (
        <AllVideosBrowser videos={result.videos} initialView={view} />
      )}
    </div>
  );
}
