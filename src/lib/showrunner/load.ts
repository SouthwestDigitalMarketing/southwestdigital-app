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
