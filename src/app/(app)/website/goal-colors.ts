export function goalColors(pct: number) {
  if (pct >= 100) return { bar: "var(--chart-series-5)" };
  if (pct >= 75) return { bar: "var(--chart-series-4)" };
  if (pct >= 50) return { bar: "var(--chart-series-3)" };
  if (pct >= 25) return { bar: "var(--chart-series-2)" };
  return { bar: "var(--chart-series-1)" };
}

export type GoalBand = "band1" | "band2" | "band3" | "band4" | "band5";

export function goalSegments(value: number, target: number): Record<GoalBand, number> {
  const safeValue = Math.max(0, value);
  if (target <= 0) {
    return { band1: safeValue, band2: 0, band3: 0, band4: 0, band5: 0 };
  }

  const quarter = target / 4;
  const segment = (start: number) => Math.min(Math.max(safeValue - start, 0), quarter);

  return {
    band1: segment(0),
    band2: segment(quarter),
    band3: segment(quarter * 2),
    band4: segment(quarter * 3),
    band5: Math.max(safeValue - target, 0),
  };
}
