import { describe, expect, it } from "vitest";
import { goalColors, goalSegments } from "./goal-colors";

describe("goalColors", () => {
  it.each([
    [0, "var(--chart-series-1)"],
    [24.9, "var(--chart-series-1)"],
    [25, "var(--chart-series-2)"],
    [49.9, "var(--chart-series-2)"],
    [50, "var(--chart-series-3)"],
    [74.9, "var(--chart-series-3)"],
    [75, "var(--chart-series-4)"],
    [99.9, "var(--chart-series-4)"],
    [100, "var(--chart-series-5)"],
  ])("maps %s%% pace to %s", (pct, color) => {
    expect(goalColors(pct).bar).toBe(color);
  });

  it("stacks every achieved pace band while preserving the total value", () => {
    const segments = goalSegments(80, 100);

    expect(segments).toEqual({
      band1: 25,
      band2: 25,
      band3: 25,
      band4: 5,
      band5: 0,
    });
    expect(segments.band1 + segments.band2 + segments.band3 + segments.band4 + segments.band5).toBe(80);
  });

  it("adds over-goal performance as an emerald segment", () => {
    expect(goalSegments(120, 100)).toEqual({
      band1: 25,
      band2: 25,
      band3: 25,
      band4: 25,
      band5: 20,
    });
  });
});
