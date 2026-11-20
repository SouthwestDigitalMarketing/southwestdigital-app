import { describe, expect, it } from "vitest";
import { median, p90, percentile, summarize } from "./stats";

describe("median", () => {
  it("is null when empty, the middle when odd, the rounded mean of the middle two when even", () => {
    expect(median([])).toBeNull();
    expect(median([5, 1, 3])).toBe(3);
    expect(median([4, 1, 3, 2])).toBe(3); // (2 + 3) / 2 = 2.5, rounded
    expect(median([10, 20])).toBe(15);
  });
  it("does not reorder the input", () => {
    const values = [3, 1, 2];
    median(values);
    expect(values).toEqual([3, 1, 2]);
  });
});

describe("percentile (nearest rank)", () => {
  it("picks sorted[ceil(p * n) - 1]", () => {
    const ten = [10, 9, 8, 7, 6, 5, 4, 3, 2, 1];
    expect(p90(ten)).toBe(9);
    expect(percentile(ten, 0.5)).toBe(5);
    expect(percentile(ten, 1)).toBe(10);
    expect(percentile(ten, 0)).toBe(1);
    expect(p90([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11])).toBe(10); // ceil(9.9) = 10th
    expect(p90([42])).toBe(42);
    expect(p90([])).toBeNull();
  });
});

describe("summarize", () => {
  it("is empty-safe", () => {
    expect(summarize([], 3600)).toEqual({
      count: 0,
      answered: 0,
      medianSeconds: null,
      p90Seconds: null,
      medianClockSeconds: null,
      p90ClockSeconds: null,
      withinTargetShare: null,
      targetSeconds: 3600,
    });
  });

  it("measures answered spans and counts misses against the target", () => {
    const summary = summarize(
      [
        { businessSeconds: 600, clockSeconds: 600 },
        { businessSeconds: 1800, clockSeconds: 50_000 },
        { businessSeconds: 7200, clockSeconds: 7200 },
        { businessSeconds: null, clockSeconds: null },
      ],
      3600,
    );
    expect(summary.count).toBe(4);
    expect(summary.answered).toBe(3);
    expect(summary.medianSeconds).toBe(1800);
    expect(summary.p90Seconds).toBe(7200);
    expect(summary.medianClockSeconds).toBe(7200);
    expect(summary.p90ClockSeconds).toBe(50_000);
    expect(summary.withinTargetShare).toBe(2 / 4);
  });

  it("leaves open events still inside the target out of the share", () => {
    const summary = summarize(
      [
        { businessSeconds: 600, clockSeconds: 600 },
        { businessSeconds: null, clockSeconds: null, waitingSeconds: 100 },
        { businessSeconds: null, clockSeconds: null, waitingSeconds: 4000 },
      ],
      3600,
    );
    expect(summary.count).toBe(3);
    expect(summary.withinTargetShare).toBe(1 / 2);
    expect(summarize([{ businessSeconds: null, clockSeconds: null, waitingSeconds: 1 }], 3600).withinTargetShare).toBeNull();
  });

  it("can check the target on clock time", () => {
    const spans = [
      { businessSeconds: 100, clockSeconds: 900_000 },
      { businessSeconds: 100, clockSeconds: 800_000 },
    ];
    expect(summarize(spans, 864_000, "clock").withinTargetShare).toBe(1 / 2);
    expect(summarize(spans, 864_000).withinTargetShare).toBe(1);
  });
});
