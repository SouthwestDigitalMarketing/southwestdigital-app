import { describe, expect, it } from "vitest";
import { funnelStepFor, hasYouTubeActivity, summarizeMrr } from "./utils";

describe("hasYouTubeActivity", () => {
  it("is false when there are no views and no watch time", () => {
    expect(hasYouTubeActivity(0, 0)).toBe(false);
  });

  it("is true when there are views", () => {
    expect(hasYouTubeActivity(12, 0)).toBe(true);
  });

  it("is true when there is watch time", () => {
    expect(hasYouTubeActivity(0, 45)).toBe(true);
  });
});

describe("summarizeMrr", () => {
  it("is zeroed when no clients carry MRR", () => {
    expect(summarizeMrr([])).toEqual({ total: 0, count: 0, average: 0 });
  });

  it("totals, counts, and averages the client amounts", () => {
    expect(summarizeMrr([450, 300, 150])).toEqual({ total: 900, count: 3, average: 300 });
  });
});

describe("funnelStepFor", () => {
  it("puts a deal with no step at its stage's step", () => {
    expect(funnelStepFor(null, "lead")).toBe(1);
    expect(funnelStepFor(null, "talking")).toBe(2);
    expect(funnelStepFor(null, "proposed")).toBe(3);
  });

  it("maps lead steps", () => {
    expect(funnelStepFor("reach", "lead")).toBe(1);
    expect(funnelStepFor("book", "talking")).toBe(2);
    expect(funnelStepFor("quote", "proposed")).toBe(3);
    expect(funnelStepFor("payment", "proposed")).toBe(4);
    expect(funnelStepFor("agreement", "proposed")).toBe(5);
  });
});
