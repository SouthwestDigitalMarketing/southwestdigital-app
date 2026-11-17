import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { DEFAULT_KEYWORDS, createGrid, estimateScanCost, parseGridSettings, SCAN_HARD_CAP_USD } from "@/lib/localSeo/grid";
import { collectReadyLocalSeoTasks, startLocalSeoScan } from "@/lib/localSeo/provider";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

function mondayKey(date: Date) {
  const monday = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  monday.setUTCDate(monday.getUTCDate() - ((monday.getUTCDay() + 6) % 7));
  return monday.toISOString().slice(0, 10);
}

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }
  if (!process.env.DATAFORSEO_LOGIN || !process.env.DATAFORSEO_PASSWORD) {
    return NextResponse.json({ error: "DataForSEO credentials are not configured." }, { status: 503 });
  }
  try {
    const collected = await collectReadyLocalSeoTasks();
    const now = new Date();
    if (now.getUTCDay() !== 1) return NextResponse.json({ collected, scheduled: false });

    const brand = await prisma.brand.findUnique({ where: { slug: "bookkeeping-conroe" } });
    if (!brand || brand.deletedAt || brand.status !== "ACTIVE") {
      return NextResponse.json({ collected, scheduled: false, reason: "Bookkeeping Conroe brand is unavailable." });
    }
    const scheduleKey = `weekly:${brand.id}:${mondayKey(now)}`;
    if (await prisma.localSeoScan.findUnique({ where: { scheduleKey }, select: { id: true } })) {
      return NextResponse.json({ collected, scheduled: false, reason: "This week’s scan already exists." });
    }
    if (await prisma.localSeoScan.findFirst({ where: { brandId: brand.id, status: "queued" }, select: { id: true } })) {
      return NextResponse.json({ collected, scheduled: false, reason: "A scan is still queued." });
    }
    const saved = await prisma.localSeoConfig.findUnique({ where: { brandId: brand.id } });
    const settings = parseGridSettings(saved ?? { gridSize: 7, spacingMiles: 1, keywords: DEFAULT_KEYWORDS });
    if (!settings) return NextResponse.json({ collected, scheduled: false, reason: "Saved grid settings are invalid." }, { status: 400 });
    const estimate = estimateScanCost(settings, "standard");
    console.info("Local SEO weekly scan cost estimate", { scheduleKey, serpCount: estimate.serpCount, estimatedCostUsd: estimate.totalUsd });
    if (estimate.totalUsd > SCAN_HARD_CAP_USD) {
      return NextResponse.json({ collected, scheduled: false, reason: "Estimated cost exceeds the hard cap." }, { status: 400 });
    }
    const scan = await startLocalSeoScan({
      brandId: brand.id,
      source: "weekly",
      scheduleKey,
      settings,
      points: createGrid(settings.gridSize, settings.spacingMiles),
      estimatedCostUsd: estimate.totalUsd,
      method: "standard",
    });
    return NextResponse.json({ collected, scheduled: true, scanId: scan.id, estimatedCostUsd: estimate.totalUsd });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Local SEO cron failed." }, { status: 502 });
  }
}
