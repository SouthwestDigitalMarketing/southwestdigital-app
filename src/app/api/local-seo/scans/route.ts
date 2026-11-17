import { NextResponse } from "next/server";
import { requireStaffBrandOrThrow } from "@/lib/brands/staff";
import { prisma } from "@/lib/prisma";
import { createGrid, estimateScanCost, parseGridSettings, SCAN_HARD_CAP_USD } from "@/lib/localSeo/grid";
import { startLocalSeoScan } from "@/lib/localSeo/provider";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function GET() {
  try {
    const { brand } = await requireStaffBrandOrThrow();
    const [settings, scans] = await Promise.all([
      prisma.localSeoConfig.findUnique({ where: { brandId: brand.id } }),
      prisma.localSeoScan.findMany({
        where: { brandId: brand.id },
        orderBy: { startedAt: "desc" },
        take: 12,
        include: { cells: { orderBy: [{ keyword: "asc" }, { row: "asc" }, { column: "asc" }] } },
      }),
    ]);
    return NextResponse.json({ settings, scans });
  } catch {
    return NextResponse.json({ error: "Staff access required." }, { status: 403 });
  }
}

export async function POST(request: Request) {
  let brand;
  try { ({ brand } = await requireStaffBrandOrThrow()); }
  catch { return NextResponse.json({ error: "Staff access required." }, { status: 403 }); }
  const settings = parseGridSettings(await request.json().catch(() => null));
  if (!settings) return NextResponse.json({ error: "The scan settings are invalid." }, { status: 400 });
  const estimate = estimateScanCost(settings, "live");
  if (estimate.totalUsd > SCAN_HARD_CAP_USD) {
    return NextResponse.json({ error: `Estimated cost $${estimate.totalUsd.toFixed(2)} exceeds the $${SCAN_HARD_CAP_USD.toFixed(2)} hard cap.` }, { status: 400 });
  }
  if (!process.env.DATAFORSEO_LOGIN || !process.env.DATAFORSEO_PASSWORD) {
    return NextResponse.json({ error: "DataForSEO credentials are not configured yet." }, { status: 503 });
  }
  await prisma.localSeoConfig.upsert({
    where: { brandId: brand.id },
    create: { brandId: brand.id, ...settings },
    update: settings,
  });
  try {
    const scan = await startLocalSeoScan({
      brandId: brand.id,
      source: "manual",
      settings,
      points: createGrid(settings.gridSize, settings.spacingMiles),
      estimatedCostUsd: estimate.totalUsd,
      method: "live",
    });
    return NextResponse.json({ scanId: scan.id, status: "complete", estimatedCostUsd: estimate.totalUsd });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "The scan failed." }, { status: 502 });
  }
}
