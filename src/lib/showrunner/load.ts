import "server-only";

import type { BrandDataContext } from "@/lib/tenancy/context";
import { withBrandDataTransaction } from "@/lib/tenancy/context";
import type { VideoCard } from "@/components/showrunner/VideosInProgress";
import { latestByTarget, type LatestFeedback } from "./feedback";
import type { VideoDetails, VideoRender, VideoStep } from "./video-status";
import { parseWeek, type Week } from "./weekly";

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
};

/** Videos ripley is still making, and ones published in the last day, newest first. */
export async function loadVideoStatus(context: BrandDataContext): Promise<VideoStatusRow[]> {
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
  return withBrandDataTransaction(context, (tx) =>
    tx.showrunnerVideoStatus.findMany({
      where: { brandId: context.brandId, OR: [{ url: null }, { updatedAt: { gte: since } }] },
      orderBy: { updatedAt: "desc" },
      take: 6,
      select: { batch: true, project: true, state: true, stage: true, steps: true, render: true, url: true, title: true, thumbnail: true, details: true, updatedAt: true },
    }),
  );
}

/** loadVideoStatus shaped for the VideosInProgress cards (Showrunner and YouTube pages). */
export async function loadVideoCards(context: BrandDataContext): Promise<VideoCard[]> {
  return (await loadVideoStatus(context)).map((row) => ({
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
  }));
}

/** This Sunday's wrap-up week from ripley, or null before the first push. */
export async function loadWeek(context: BrandDataContext): Promise<Week | null> {
  const row = await withBrandDataTransaction(context, (tx) =>
    tx.showrunnerStudio.findUnique({ where: { brandId: context.brandId }, select: { weekly: true } }),
  );
  return parseWeek(row?.weekly ?? null);
}

/** The newest published video's YouTube id, for the Series banner picture. */
export async function loadLatestPublishedVideoId(context: BrandDataContext): Promise<string | null> {
  const row = await withBrandDataTransaction(context, (tx) =>
    tx.showrunnerVideoStatus.findFirst({
      where: { brandId: context.brandId, url: { not: null } },
      orderBy: { updatedAt: "desc" },
      select: { url: true },
    }),
  );
  return row?.url?.match(/[?&]v=([\w-]{6,20})/)?.[1] ?? null;
}
