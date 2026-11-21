export const OFFICE = { latitude: 30.354404, longitude: -95.58152 } as const;
export const DEFAULT_KEYWORDS = [
  "bookkeeper",
  "bookkeeper near me",
  "bookkeeping Conroe",
  "bookkeeping services",
  "QuickBooks bookkeeper",
  "small business bookkeeping",
  "payroll",
  "tax preparation",
  "CPA near me",
];
export const STANDARD_PRICE_PER_SERP = 0.0006;
export const LIVE_PRICE_PER_SERP = 0.002;
export const SCAN_HARD_CAP_USD = 2;
// Chris Palmer reads a geo grid over ~20 miles and tracks how far the top-3 "proximity" reaches
// (All Thing concepts/seo-strategy-chris-palmer.md). Wider spacing lets a 9x9 grid reach our towns.
export const SPACING_OPTIONS = [0.5, 1, 2, 3, 4, 5] as const;
export const DEFAULT_GRID = { gridSize: 9, spacingMiles: 4 } as const;

export type GridSettings = { gridSize: number; spacingMiles: number; keywords: string[] };
export type GridPoint = { row: number; column: number; latitude: number; longitude: number };

export function parseGridSettings(input: unknown): GridSettings | null {
  if (!input || typeof input !== "object") return null;
  const value = input as Record<string, unknown>;
  const gridSize = Number(value.gridSize);
  const spacingMiles = Number(value.spacingMiles);
  if (!Number.isInteger(gridSize) || gridSize < 3 || gridSize > 9 || gridSize % 2 === 0) return null;
  if (!(SPACING_OPTIONS as readonly number[]).includes(spacingMiles)) return null;
  if (!Array.isArray(value.keywords)) return null;
  const keywords = [...new Set(value.keywords
    .filter((keyword): keyword is string => typeof keyword === "string")
    .map((keyword) => keyword.trim().replace(/\s+/g, " "))
    .filter((keyword) => keyword.length >= 2 && keyword.length <= 100))];
  if (keywords.length < 1 || keywords.length > 12) return null;
  return { gridSize, spacingMiles, keywords };
}

export function createGrid(gridSize: number, spacingMiles: number): GridPoint[] {
  if (!Number.isInteger(gridSize) || gridSize < 1 || gridSize % 2 === 0 || spacingMiles <= 0) {
    throw new Error("Grid size must be a positive odd number and spacing must be positive.");
  }
  const latitudeStep = spacingMiles / 69;
  const longitudeStep = spacingMiles / (69 * Math.cos((OFFICE.latitude * Math.PI) / 180));
  const center = Math.floor(gridSize / 2);
  return Array.from({ length: gridSize * gridSize }, (_, index) => {
    const row = Math.floor(index / gridSize);
    const column = index % gridSize;
    return {
      row,
      column,
      latitude: Number((OFFICE.latitude + (center - row) * latitudeStep).toFixed(7)),
      longitude: Number((OFFICE.longitude + (column - center) * longitudeStep).toFixed(7)),
    };
  });
}

export function estimateScanCost(settings: GridSettings, method: "standard" | "live") {
  const pointCount = settings.gridSize * settings.gridSize;
  const serpCount = pointCount * settings.keywords.length;
  const unitPrice = method === "live" ? LIVE_PRICE_PER_SERP : STANDARD_PRICE_PER_SERP;
  return { serpCount, unitPrice, totalUsd: Number((serpCount * unitPrice).toFixed(4)) };
}

export type MapItem = {
  type?: string;
  rank_group?: number;
  rank_absolute?: number;
  title?: string | null;
  phone?: string | null;
  url?: string | null;
  domain?: string | null;
  address?: string | null;
};

const normalizePhone = (value: string | null | undefined) => (value ?? "").replace(/\D/g, "");
const normalizeName = (value: string | null | undefined) => (value ?? "").toLocaleLowerCase().replace(/[^a-z0-9]/g, "");
const normalizeHost = (value: string | null | undefined) => {
  if (!value) return "";
  try { return new URL(value.startsWith("http") ? value : `https://${value}`).hostname.replace(/^www\./, "").toLowerCase(); }
  catch { return value.replace(/^www\./, "").toLowerCase(); }
};

export function parseMapResults(items: MapItem[] | null | undefined) {
  const listings = (items ?? []).filter((item) => item.type === "maps_search")
    .map((item, index) => ({
      name: item.title?.trim() || "Unknown listing",
      rank: item.rank_group ?? item.rank_absolute ?? index + 1,
      phone: item.phone ?? null,
      url: item.url ?? item.domain ?? null,
      address: item.address ?? null,
    }))
    .sort((a, b) => a.rank - b.rank);
  const businessName = normalizeName("Bookkeeping Conroe");
  const businessPhone = normalizePhone("9362834346");
  const businessHost = normalizeHost("https://www.bookkeepingconroe.com");
  const ownIndex = listings.findIndex((item) =>
    normalizeName(item.name) === businessName ||
    normalizePhone(item.phone) === businessPhone ||
    normalizeHost(item.url) === businessHost,
  );
  const competitors = listings.filter((_, index) => index !== ownIndex).slice(0, 5)
    .map(({ name, rank, address }) => ({ name, rank, address }));
  return { rank: ownIndex < 0 ? null : listings[ownIndex].rank, competitors };
}
