import { describe, expect, it } from "vitest";
import { clipLength, parseWeek, releaseLabel } from "./weekly";

const week = {
  release: "2026-11-29T17:00:00-06:00",
  window: ["2026-11-22T00:00:00-06:00", "2026-11-29T00:00:00-06:00"],
  title: "The $10K Month: Week of Nov 22",
  question: "Did the proposals turn into clients?",
  talkingPoints: [{ say: "It's Sunday, time for the wrap-up.", fact: null }, { say: "" }, "Four proposals are out."],
  facts: [
    { key: "calls", label: "Phone calls", value: 2, source: "Quo", detail: "6 minutes on the phone" },
    { key: "bad", label: "", value: 3 },
    { key: "nan", label: "Broken", value: Number.NaN },
  ],
  clips: [
    { title: "Why landlords need a separate bank account", videoId: "X4uqPpWHLp0", start: 300, end: 312, why: "shows the work" },
    { title: "Backwards", start: 20, end: 10 },
    { title: "Odd id", videoId: "<script>", start: 0, end: 9 },
  ],
  hookNext: "Will the proposals sign?",
  preparedAt: "2026-11-28T15:00:00+00:00",
};

describe("parseWeek", () => {
  it("keeps what the page shows and drops unreadable rows", () => {
    const parsed = parseWeek(week)!;
    expect(parsed.talkingPoints).toEqual(["It's Sunday, time for the wrap-up.", "Four proposals are out."]);
    expect(parsed.facts.map((f) => f.key)).toEqual(["calls"]);
    expect(parsed.clips.map((c) => [c.title, c.videoId])).toEqual([
      ["Why landlords need a separate bank account", "X4uqPpWHLp0"],
      ["Odd id", null],
    ]);
    expect(parsed.window[1]).toBe("2026-11-29T00:00:00-06:00");
  });

  it("refuses a week without a release time", () => {
    expect(parseWeek({ ...week, release: "soon" })).toBeNull();
    expect(parseWeek(null)).toBeNull();
  });

  it("labels the release in Central time and clip lengths in seconds or minutes", () => {
    expect(releaseLabel(week.release)).toBe("Sun, Nov 29, 5:00 PM");
    expect(clipLength({ title: "a", videoId: null, start: 0, end: 12.4, why: "" })).toBe("12s");
    expect(clipLength({ title: "a", videoId: null, start: 0, end: 75, why: "" })).toBe("1:15");
  });
});
