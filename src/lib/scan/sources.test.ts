import { describe, expect, it } from "vitest";
import { initialSources, isKnownSource, parseSourceProgress, sortSources } from "./sources";

describe("scan sources", () => {
  it("starts login items needing Tom and everything else waiting", () => {
    const sources = initialSources();
    expect(sources.slice(0, 2).map((row) => row.status)).toEqual(["needs-you", "needs-you"]);
    expect(sources.slice(2).every((row) => row.status === "waiting")).toBe(true);
    expect(sources[0].loginUrl).toBe("https://app.qbo.intuit.com");
  });
  it("validates progress posts", () => {
    expect(parseSourceProgress({ source: "quo-sms", status: "done", detail: "3 new" })).toMatchObject({
      source: "quo-sms",
      status: "done",
    });
    expect(parseSourceProgress({ source: "nope", status: "done" })).toBeNull();
    expect(parseSourceProgress({ source: "zoho", status: "bogus" })).toBeNull();
    expect(parseSourceProgress({ source: "zoho", status: "needs-you", loginUrl: "http://x" })).toBeNull();
    expect(isKnownSource("ga4")).toBe(true);
    expect(isKnownSource("qb")).toBe(false);
  });
  it("sorts needs-you first and done last", () => {
    const sorted = sortSources([
      { source: "a", label: "a", status: "done" },
      { source: "b", label: "b", status: "waiting" },
      { source: "c", label: "c", status: "needs-you" },
      { source: "d", label: "d", status: "scanning" },
    ]);
    expect(sorted.map((row) => row.source)).toEqual(["c", "d", "b", "a"]);
  });
});
