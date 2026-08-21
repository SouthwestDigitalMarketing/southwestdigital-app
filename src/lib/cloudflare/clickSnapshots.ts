import "server-only";
import { prisma } from "@/lib/prisma";
import {
  fetchClicksForDays,
  getCloudflareCredentials,
  getBrandSourceTagPaths,
  SOURCE_TAG_CHARS,
  type SourceTagClickReport,
} from "./redirectClicks";
export type { SourceTagClickReport };

const CLICK_TRACKING_EPOCH = "2026-08-09";
const BACKFILL_DAYS = 7;
const DAY_MS = 24 * 60 * 60 * 1000;

function utcDay(d: Date): string {
  return d.toISOString().slice(0, 10);
}

// Ensures the last BACKFILL_DAYS days exist in SourceTagClickDaily.
// Fetches any missing days from Cloudflare and stores them.
async function ensureClickSnapshots(brandId: string, brandSlug: string): Promise<void> {
  const candidates: string[] = [];
  for (let i = 1; i <= BACKFILL_DAYS; i++) {
    const day = utcDay(new Date(Date.now() - i * DAY_MS));
    if (day >= CLICK_TRACKING_EPOCH) candidates.push(day);
  }
  if (candidates.length === 0) return;

  const existing = await prisma.sourceTagClickDaily.findMany({
    where: { brandId, date: { in: candidates.map((d) => new Date(d)) } },
    select: { date: true },
    distinct: ["date"],
  });
  const captured = new Set(existing.map((r) => utcDay(r.date)));
  const missing = candidates.filter((d) => !captured.has(d));
  if (missing.length === 0) return;

  const { token, zoneId } = getCloudflareCredentials(brandSlug);
  const paths = getBrandSourceTagPaths(brandSlug);
  const byDay = await fetchClicksForDays(missing, zoneId, token, paths);

  const rows = missing.flatMap((day) => {
    const tagMap = byDay.get(day) ?? new Map<string, number>();
    return SOURCE_TAG_CHARS.map((tag) => ({
      date: new Date(day),
      tag,
      brandId,
      clicks: tagMap.get(tag) ?? 0,
    }));
  });

  await prisma.sourceTagClickDaily.createMany({ data: rows, skipDuplicates: true });
}

export async function getSourceTagClicksCumulative(
  brandId: string,
  brandSlug: string,
): Promise<SourceTagClickReport> {
  const today = utcDay(new Date());

  await ensureClickSnapshots(brandId, brandSlug);

  const { token, zoneId } = getCloudflareCredentials(brandSlug);
  const paths = getBrandSourceTagPaths(brandSlug);

  const [snapshotSums, todayByDay] = await Promise.all([
    prisma.sourceTagClickDaily.groupBy({
      by: ["tag"],
      where: { brandId, date: { gte: new Date(CLICK_TRACKING_EPOCH), lt: new Date(today) } },
      _sum: { clicks: true },
    }),
    fetchClicksForDays([today], zoneId, token, paths),
  ]);

  const totals = new Map<string, number>();
  for (const row of snapshotSums) {
    totals.set(row.tag, row._sum.clicks ?? 0);
  }
  const todayMap = todayByDay.get(today) ?? new Map<string, number>();
  for (const [tag, clicks] of todayMap) {
    totals.set(tag, (totals.get(tag) ?? 0) + clicks);
  }

  const byTag = [...totals.entries()]
    .filter(([, c]) => c > 0)
    .map(([tag, clicks]) => ({ tag, clicks }))
    .sort((a, b) => b.clicks - a.clicks);

  return {
    totalClicks: byTag.reduce((s, e) => s + e.clicks, 0),
    byTag,
    epochDate: CLICK_TRACKING_EPOCH,
    generatedAt: new Date().toISOString(),
  };
}
