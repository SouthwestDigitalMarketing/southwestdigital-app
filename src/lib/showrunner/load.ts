import "server-only";

import type { BrandDataContext } from "@/lib/tenancy/context";
import { withBrandDataTransaction } from "@/lib/tenancy/context";
import { latestByTarget, type LatestFeedback } from "./feedback";

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
      select: { batch: true, project: true, state: true, stage: true, steps: true, render: true, url: true, updatedAt: true },
    }),
  );
}
