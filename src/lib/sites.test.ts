import { describe, expect, it } from "vitest";
import { MUSIC_SITES, publicHost, publicHref } from "./sites";

describe("public site labels", () => {
  it("turns a brand URL into the bare domain Tom taps", () => {
    expect(publicHost("https://www.bookkeepingconroe.com/")).toBe("bookkeepingconroe.com");
    expect(publicHref("https://www.bookkeepingconroe.com/")).toBe("https://www.bookkeepingconroe.com");
  });

  it("accepts a hostname from GA4", () => {
    expect(publicHost("realestatebookkeeper.com")).toBe("realestatebookkeeper.com");
    expect(publicHref("realestatebookkeeper.com")).toBe("https://realestatebookkeeper.com");
  });

  it("lists the extra sites Tom wants to see", () => {
    expect(MUSIC_SITES.map((site) => site.host)).toEqual([
      "easyweddingband.com",
      "thomasgrantmacdonald.com",
    ]);
  });

  it("connects the wedding band site to its GA4 property", () => {
    expect(MUSIC_SITES.find((site) => site.host === "easyweddingband.com")?.ga4PropertyId).toBe("566101201");
  });
});
