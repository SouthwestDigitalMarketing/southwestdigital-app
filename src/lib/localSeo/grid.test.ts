import { describe, expect, it } from "vitest";
import fixture from "./__fixtures__/maps-serp.json";
import { createGrid, estimateScanCost, parseGridSettings, parseMapResults } from "./grid";

describe("local SEO grid", () => {
  it("centers the grid and converts mile spacing to latitude and longitude", () => {
    const points = createGrid(3, 1);
    expect(points).toHaveLength(9);
    expect(points[4]).toEqual({ row: 1, column: 1, latitude: 30.354404, longitude: -95.58152 });
    expect(points[0].latitude).toBeGreaterThan(points[6].latitude);
    expect(points[2].longitude).toBeGreaterThan(points[0].longitude);
  });

  it("accepts only supported grid sizes, spacing and keyword counts", () => {
    expect(parseGridSettings({ gridSize: 7, spacingMiles: 0.5, keywords: [" bookkeeping  Conroe ", "bookkeeping Conroe"] }))
      .toEqual({ gridSize: 7, spacingMiles: 0.5, keywords: ["bookkeeping Conroe"] });
    expect(parseGridSettings({ gridSize: 8, spacingMiles: 1, keywords: ["a keyword"] })).toBeNull();
    expect(parseGridSettings({ gridSize: 7, spacingMiles: 3, keywords: ["a keyword"] })).toBeNull();
  });

  it("estimates weekly and live request costs before running", () => {
    const settings = { gridSize: 7, spacingMiles: 1, keywords: Array.from({ length: 8 }, (_, i) => `keyword ${i}`) };
    expect(estimateScanCost(settings, "standard")).toEqual({ serpCount: 392, unitPrice: 0.0006, totalUsd: 0.2352 });
    expect(estimateScanCost(settings, "live").totalUsd).toBe(0.784);
  });

  it("matches the business by phone or website and lists other map results as competitors", () => {
    const result = parseMapResults(fixture.tasks[0].result[0].items);
    expect(result.rank).toBe(2);
    expect(result.competitors).toEqual([
      { name: "Local CPA Group", rank: 1, address: "1 Main St, Conroe, TX" },
      { name: "North County Books", rank: 3, address: "2 Main St, Conroe, TX" },
    ]);
  });

  it("returns not found when the business does not appear", () => {
    expect(parseMapResults([{ type: "maps_search", rank_group: 1, title: "Other company" }]).rank).toBeNull();
  });
});
