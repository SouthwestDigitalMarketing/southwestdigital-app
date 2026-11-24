import { describe, expect, it } from "vitest";
import { initialSources, isKnownSource, parseSourceProgress, sortSources } from "./sources";

describe("scan sources", () => {
  it("starts every source waiting for an actual SOP access check", () => {
    const sources = initialSources();
    expect(sources).toHaveLength(7);
    expect(sources[0]).toMatchObject({ source: "quickbooks", label: "QuickBooks", status: "waiting" });
    expect(sources.slice(1).every((row) => row.status === "waiting")).toBe(true);
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
  it("accepts actual counters and rejects impossible progress", () => {
    const base = { source: "quo-sms", status: "scanning" };
    expect(parseSourceProgress({ ...base, progress: { stage: "Downloading voicemail", reviewed: 2, total: 10, remaining: 9 } })?.progress)
      .toEqual({ stage: "Downloading voicemail", reviewed: 2, total: 10, remaining: 9 });
    for (const counts of [
      { reviewed: -1, total: 10, remaining: 10 },
      { reviewed: 11, total: 10, remaining: 0 },
      { reviewed: 1.5, total: 10, remaining: 9 },
      { reviewed: 1, total: 10, remaining: 11 },
    ]) {
      expect(parseSourceProgress({ ...base, progress: { stage: "Reading", ...counts } })).toBeNull();
    }
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
