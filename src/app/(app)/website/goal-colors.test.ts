import { describe, expect, it } from "vitest";
import { goalColors, goalSegments } from "./goal-colors";

describe("goalColors", () => {
  it.each([
    [0, "#f43f5e"],
    [24.9, "#f43f5e"],
    [25, "#f97316"],
    [49.9, "#f97316"],
    [50, "#f59e0b"],
    [74.9, "#f59e0b"],
    [75, "#84cc16"],
    [99.9, "#84cc16"],
    [100, "#10b981"],
  ])("maps %s%% pace to %s", (pct, color) => {
    expect(goalColors(pct).bar).toBe(color);
  });

  it("stacks every achieved pace band while preserving the total value", () => {
    const segments = goalSegments(80, 100);

    expect(segments).toEqual({
      rose: 25,
      orange: 25,
      amber: 25,
      lime: 5,
      emerald: 0,
    });
    expect(segments.rose + segments.orange + segments.amber + segments.lime + segments.emerald).toBe(80);
  });

  it("adds over-goal performance as an emerald segment", () => {
    expect(goalSegments(120, 100)).toEqual({
      rose: 25,
      orange: 25,
      amber: 25,
      lime: 25,
      emerald: 20,
    });
  });
});
