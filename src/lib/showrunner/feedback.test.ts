import { describe, expect, it } from "vitest";
import { latestByTarget, parseFeedbackInput } from "./feedback";

describe("parseFeedbackInput", () => {
  it("accepts a series reaction with a trimmed note", () => {
    expect(parseFeedbackInput({ seriesSlug: "a", episodeIndex: null, reaction: "like", note: "  more of this " }, 6))
      .toEqual({ seriesSlug: "a", episodeIndex: null, reaction: "like", note: "more of this" });
  });
  it("turns an empty note into null", () => {
    expect(parseFeedbackInput({ seriesSlug: "a", reaction: "drop", note: "   " }, 6)?.note).toBeNull();
  });
  it("accepts an episode index in range and rejects one out of range", () => {
    expect(parseFeedbackInput({ seriesSlug: "a", episodeIndex: 5, reaction: "change" }, 6)?.episodeIndex).toBe(5);
    expect(parseFeedbackInput({ seriesSlug: "a", episodeIndex: 6, reaction: "change" }, 6)).toBeNull();
    expect(parseFeedbackInput({ seriesSlug: "a", episodeIndex: -1, reaction: "change" }, 6)).toBeNull();
  });
  it("rejects a bad reaction, a long note and non-strings", () => {
    expect(parseFeedbackInput({ seriesSlug: "a", reaction: "love" }, 6)).toBeNull();
    expect(parseFeedbackInput({ seriesSlug: "a", reaction: "like", note: "x".repeat(2001) }, 6)).toBeNull();
    expect(parseFeedbackInput({ seriesSlug: 1, reaction: "like" }, 6)).toBeNull();
  });
});

describe("latestByTarget", () => {
  it("keeps the newest reaction for each target", () => {
    const t = (n: number) => new Date(2026, 10, 16, 0, n);
    const out = latestByTarget([
      { episodeIndex: null, reaction: "like", note: null, createdAt: t(1) },
      { episodeIndex: null, reaction: "change", note: "shorter", createdAt: t(3) },
      { episodeIndex: 2, reaction: "drop", note: null, createdAt: t(2) },
    ]);
    expect(out.series).toEqual({ reaction: "change", note: "shorter" });
    expect(out["ep:2"]).toEqual({ reaction: "drop", note: null });
  });
});
