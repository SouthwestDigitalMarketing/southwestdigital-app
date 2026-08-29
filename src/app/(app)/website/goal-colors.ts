export function goalColors(pct: number) {
  if (pct >= 100) return { bar: "#10b981", text: "text-emerald-600" };
  if (pct >= 75) return { bar: "#84cc16", text: "text-lime-600" };
  if (pct >= 50) return { bar: "#f59e0b", text: "text-amber-600" };
  if (pct >= 25) return { bar: "#f97316", text: "text-orange-600" };
  return { bar: "#f43f5e", text: "text-rose-600" };
}

export type GoalBand = "rose" | "orange" | "amber" | "lime" | "emerald";

export function goalSegments(value: number, target: number): Record<GoalBand, number> {
  const safeValue = Math.max(0, value);
  if (target <= 0) {
    return { rose: safeValue, orange: 0, amber: 0, lime: 0, emerald: 0 };
  }

  const quarter = target / 4;
  const segment = (start: number) => Math.min(Math.max(safeValue - start, 0), quarter);

  return {
    rose: segment(0),
    orange: segment(quarter),
    amber: segment(quarter * 2),
    lime: segment(quarter * 3),
    emerald: Math.max(safeValue - target, 0),
  };
}
