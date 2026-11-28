import { requireStaffBrand } from "@/lib/brands/staff";
import { prisma } from "@/lib/prisma";
import { DEFAULT_GRID, DEFAULT_KEYWORDS, type GridSettings } from "@/lib/localSeo/grid";
import type { Competitor, Scan } from "./stats";

export type { Cell, Competitor, Scan } from "./stats";
export { scanStats } from "./stats";

export type LocalSeoData = { settings: GridSettings; scans: Scan[]; storageMissing: boolean };

const defaults: GridSettings = { ...DEFAULT_GRID, keywords: DEFAULT_KEYWORDS };

function isMissingLocalSeoStorage(error: unknown) {
  return Boolean(error && typeof error === "object" && "code" in error && (error.code === "P2021" || error.code === "P2022"));
}

/** Settings and the 12 most recent scans for the staff member's brand; every Local SEO tab reads this. */
export async function loadLocalSeoData(): Promise<LocalSeoData> {
  const { brand } = await requireStaffBrand();
  try {
    const [config, scans] = await Promise.all([
      prisma.localSeoConfig.findUnique({ where: { brandId: brand.id } }),
      prisma.localSeoScan.findMany({ where: { brandId: brand.id }, orderBy: { startedAt: "desc" }, take: 12, include: { cells: true } }),
    ]);
    const settings = config && Array.isArray(config.keywords)
      ? { gridSize: config.gridSize, spacingMiles: config.spacingMiles, keywords: config.keywords.filter((keyword): keyword is string => typeof keyword === "string") }
      : defaults;
    return {
      settings,
      storageMissing: false,
      scans: scans.map((scan) => ({
        ...scan,
        startedAt: scan.startedAt.toISOString(),
        keywords: Array.isArray(scan.keywords) ? scan.keywords.filter((keyword): keyword is string => typeof keyword === "string") : [],
        cells: scan.cells.map((cell) => ({
          ...cell,
          competitors: Array.isArray(cell.competitors) ? cell.competitors as unknown as Competitor[] : [],
        })),
      })),
    };
  } catch (error) {
    if (!isMissingLocalSeoStorage(error)) throw error;
    return { settings: defaults, scans: [], storageMissing: true };
  }
}

export const STORAGE_MISSING_NOTE = "The Local SEO tables are not in the database yet. The migration is ready; apply it after review.";
