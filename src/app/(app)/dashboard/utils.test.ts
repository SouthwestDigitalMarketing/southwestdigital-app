import { describe, expect, it } from "vitest";
import { hasYouTubeActivity } from "./utils";

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
