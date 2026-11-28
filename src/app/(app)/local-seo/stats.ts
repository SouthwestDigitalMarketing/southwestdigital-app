// Plain scan types and math, safe for client components (data.ts is server-only).

export type Competitor = { name: string; rank: number; address?: string | null };
export type Cell = { id?: string; keyword: string; row: number; column: number; latitude: number; longitude: number; status: string; rank: number | null; competitors: Competitor[] };
export type Scan = { id: string; source: string; status: string; gridSize: number; spacingMiles: number; keywords: string[]; estimatedCostUsd: number; actualCostUsd: number; startedAt: string; error?: string | null; cells: Cell[] };

/** Top-3 share and average rank for one phrase in one scan (complete points only). */
export function scanStats(scan: Scan | undefined, keyword: string) {
  const cells = (scan?.cells ?? []).filter((cell) => cell.keyword === keyword);
  const complete = cells.filter((cell) => cell.status === "complete");
  const ranked = complete.filter((cell) => cell.rank !== null);
  const topThree = ranked.filter((cell) => (cell.rank ?? 99) <= 3).length;
  return {
    cells,
    complete: complete.length,
    topThree,
    topThreeShare: complete.length ? topThree / complete.length : null,
    averageRank: ranked.length ? ranked.reduce((sum, cell) => sum + (cell.rank ?? 0), 0) / ranked.length : null,
  };
}

/** A scan with at least one finished point; failed or queued scans are skipped when showing results. */
export function hasResults(scan: Scan) {
  return scan.cells.some((cell) => cell.status === "complete");
}
