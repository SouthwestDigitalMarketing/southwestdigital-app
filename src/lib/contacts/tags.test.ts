import { describe, expect, it } from "vitest";
import { parsePage, parseTagKeys, slugifyTagKey } from "./tags";

describe("slugifyTagKey", () => {
  it("normalizes labels into keys", () => {
    expect(slugifyTagKey("Business Owner")).toBe("business-owner");
    expect(slugifyTagKey("  CPA / Accountant ")).toBe("cpa-accountant");
  });

  it("falls back when the label has no usable characters", () => {
    expect(slugifyTagKey("!!!")).toBe("tag");
  });
});

describe("parseTagKeys", () => {
  it("dedupes comma-separated and array values", () => {
    expect(parseTagKeys("bookkeeper,bookkeeper, accountant")).toEqual([
      "bookkeeper",
      "accountant",
    ]);
    expect(parseTagKeys(["bookkeeper", "accountant", "bookkeeper"])).toEqual([
      "bookkeeper",
      "accountant",
    ]);
  });
});

describe("parsePage", () => {
  it("defaults invalid pages to 1", () => {
    expect(parsePage(undefined)).toBe(1);
    expect(parsePage("0")).toBe(1);
    expect(parsePage("2.9")).toBe(2);
  });
});
