import { requireStaffBrand } from "@/lib/brands/staff";
import { prisma } from "@/lib/prisma";
import { DEFAULT_KEYWORDS, type GridSettings } from "@/lib/localSeo/grid";
import { LocalSeoDashboard } from "./LocalSeoDashboard";

export const dynamic = "force-dynamic";

const defaults: GridSettings = { gridSize: 7, spacingMiles: 1, keywords: DEFAULT_KEYWORDS };

function isMissingLocalSeoStorage(error: unknown) {
  return Boolean(error && typeof error === "object" && "code" in error && (error.code === "P2021" || error.code === "P2022"));
}

export default async function LocalSeoPage() {
  const { brand } = await requireStaffBrand();
  let initialSettings = defaults;
  let initialScans: Array<{
    id: string; source: string; status: string; gridSize: number; spacingMiles: number;
    keywords: string[]; estimatedCostUsd: number; actualCostUsd: number; startedAt: string;
    cells: Array<{ id: string; keyword: string; row: number; column: number; latitude: number; longitude: number; status: string; rank: number | null; competitors: Array<{ name: string; rank: number; address?: string | null }> }>;
  }> = [];
  let storageMissing = false;
  try {
    const [config, scans] = await Promise.all([
      prisma.localSeoConfig.findUnique({ where: { brandId: brand.id } }),
      prisma.localSeoScan.findMany({ where: { brandId: brand.id }, orderBy: { startedAt: "desc" }, take: 12, include: { cells: true } }),
    ]);
    initialSettings = config && Array.isArray(config.keywords)
      ? { gridSize: config.gridSize, spacingMiles: config.spacingMiles, keywords: config.keywords.filter((keyword): keyword is string => typeof keyword === "string") }
      : defaults;
    initialScans = scans.map((scan) => ({
      ...scan,
      startedAt: scan.startedAt.toISOString(),
      keywords: Array.isArray(scan.keywords) ? scan.keywords.filter((keyword): keyword is string => typeof keyword === "string") : [],
      cells: scan.cells.map((cell) => ({
        ...cell,
        competitors: Array.isArray(cell.competitors) ? cell.competitors as unknown as Array<{ name: string; rank: number; address?: string | null }> : [],
      })),
    }));
  } catch (error) {
    if (!isMissingLocalSeoStorage(error)) throw error;
    storageMissing = true;
  }
  return <LocalSeoDashboard initialSettings={initialSettings} initialScans={initialScans} storageMissing={storageMissing} />;
}
