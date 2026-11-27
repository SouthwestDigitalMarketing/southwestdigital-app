import "server-only";

import type { BrandDataContext } from "@/lib/tenancy/context";
import { withBrandDataTransaction } from "@/lib/tenancy/context";
import type { VideoCard } from "@/components/showrunner/VideosInProgress";
import { latestByTarget, type LatestFeedback } from "./feedback";
import type { VideoDetails, VideoRender, VideoStep } from "./video-status";
import { parseWeek, type Week } from "./weekly";
import { parseReview, type VideoReview } from "./review";

export async function loadFeedback(
  context: BrandDataContext,
  seriesSlug: string,
): Promise<Record<string, LatestFeedback>> {
  const rows = await withBrandDataTransaction(context, (tx) =>
    tx.showrunnerFeedback.findMany({
      where: { brandId: context.brandId, seriesSlug },
      orderBy: { createdAt: "desc" },
      take: 500,
      select: { episodeIndex: true, reaction: true, note: true, createdAt: true },
    }),
  );
  return latestByTarget(rows);
}

export type VideoStatusRow = {
  batch: string;
  project: string | null;
  state: string;
  stage: string | null;
  steps: unknown;
  render: unknown;
  url: string | null;
  title: string | null;
  thumbnail: string | null;
  details: unknown;
  updatedAt: Date;
  finishRequestedAt: Date | null;
  transcript: string | null;
  thumbnailText: string | null;
  thumbnailOptions: unknown;
  thumbnailBusy: boolean;
  thumbnailRequestedAt: Date | null;
};

const VIDEO_STATUS_SELECT = {
  batch: true,
  project: true,
  state: true,
  stage: true,
  steps: true,
  render: true,
  url: true,
  title: true,
  thumbnail: true,
  details: true,
  updatedAt: true,
  finishRequestedAt: true,
  transcript: true,
  thumbnailText: true,
  thumbnailOptions: true,
  thumbnailBusy: true,
  thumbnailRequestedAt: true,
} as const;

/**
 * Videos ripley is still making, then ones published in the last day.
 * Unpublished rows are loaded on their own: ripley upserts the live send first, then every published
 * row, so a mixed take:12 by updatedAt drops the send (Tom, 2026-11-27, batch mwzglzlj-5643aa).
 */
export async function loadVideoStatus(context: BrandDataContext): Promise<VideoStatusRow[]> {
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
  return withBrandDataTransaction(context, async (tx) => {
    const unpublished = await tx.showrunnerVideoStatus.findMany({
      where: { brandId: context.brandId, url: null },
      orderBy: { updatedAt: "desc" },
      take: 50,
      select: VIDEO_STATUS_SELECT,
    });
    const published = await tx.showrunnerVideoStatus.findMany({
      where: { brandId: context.brandId, url: { not: null }, updatedAt: { gte: since } },
      orderBy: { updatedAt: "desc" },
      take: 12,
      select: VIDEO_STATUS_SELECT,
    });
    return [...unpublished, ...published];
  });
}

/** One ShowrunnerVideoStatus row as a VideosInProgress card. */
export function videoCardFromStatus(row: VideoStatusRow): VideoCard {
  return {
    batch: row.batch,
    project: row.project,
    state: row.state,
    stage: row.stage,
    steps: Array.isArray(row.steps) ? (row.steps as VideoStep[]) : null,
    render: row.render && typeof row.render === "object" ? (row.render as VideoRender) : null,
    url: row.url,
    title: row.title,
    thumbnail: row.thumbnail,
    details: row.details && typeof row.details === "object" ? (row.details as VideoDetails) : null,
    finishRequestedAt: row.finishRequestedAt,
    transcript: row.transcript,
    thumbnailText: row.thumbnailText,
    thumbnailOptions: Array.isArray(row.thumbnailOptions) ? (row.thumbnailOptions as string[]) : null,
    thumbnailBusy: row.thumbnailBusy || Boolean(row.thumbnailRequestedAt),
  };
}

/** loadVideoStatus shaped for the VideosInProgress cards (Showrunner and YouTube pages). */
export async function loadVideoCards(context: BrandDataContext): Promise<VideoCard[]> {
  return (await loadVideoStatus(context)).map(videoCardFromStatus);
}

export type EpisodeRow = VideoStatusRow & {
  review: VideoReview | null;
  reviewRequestedAt: Date | null;
  finishRequestedAt: Date | null;
  finishNote: string | null;
};

/** Every episode ripley has reported, newest first, for the Videos tab, with its scorecard (Tom, 2026-11-25). */
export async function loadEpisodes(context: BrandDataContext): Promise<EpisodeRow[]> {
  const rows = await withBrandDataTransaction(context, (tx) =>
    tx.showrunnerVideoStatus.findMany({
      where: { brandId: context.brandId },
      orderBy: { batch: "desc" },
      take: 100,
      select: {
        batch: true, project: true, state: true, stage: true, steps: true, render: true, url: true, title: true,
        thumbnail: true, details: true, updatedAt: true, review: true, reviewRequestedAt: true,
        finishRequestedAt: true, finishNote: true, transcript: true, thumbnailText: true,
        thumbnailOptions: true, thumbnailBusy: true, thumbnailRequestedAt: true,
      },
    }),
  );
  return rows.map((row) => ({ ...row, review: parseReview(row.review) }));
}

/** This Sunday's wrap-up week from ripley, or null before the first push. */
export async function loadWeek(context: BrandDataContext): Promise<Week | null> {
  const row = await withBrandDataTransaction(context, (tx) =>
    tx.showrunnerStudio.findUnique({ where: { brandId: context.brandId }, select: { weekly: true } }),
  );
  return parseWeek(row?.weekly ?? null);
}

