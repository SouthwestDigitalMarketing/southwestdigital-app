import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/tenancy/context", () => ({
  withBrandDataTransaction: async () => {
    throw new Error("not used");
  },
}));

import { videoCardFromStatus, type VideoStatusRow } from "./load";

function row(over: Partial<VideoStatusRow> = {}): VideoStatusRow {
  return {
    batch: "mwzglzlj-5643aa",
    project: "TREB 261127 New Video",
    state: "episode",
    stage: null,
    steps: null,
    render: null,
    url: "https://www.youtube.com/watch?v=QymGZFEDcg4",
    title: "Behind on Books",
    thumbnail: null,
    details: null,
    updatedAt: new Date("2026-11-28T18:30:00Z"),
    finishRequestedAt: null,
    transcript: null,
    thumbnailText: null,
    thumbnailOptions: null,
    thumbnailBusy: false,
    thumbnailRequestedAt: null,
    transcriptCues: null,
    teaser: null,
    teaserBusy: false,
    teaserRequestedAt: null,
    visibility: "private",
    visibilityBusy: false,
    visibilityRequestedAt: null,
    titleScreen: null,
    titleScreenKind: "daily",
    titleScreenDay: 452,
    titleScreenApprovedAt: new Date("2026-11-28T18:30:00Z"),
    titleScreenBusy: false,
    titleScreenRecutRequestedAt: null,
    ...over,
  };
}

describe("videoCardFromStatus title screen", () => {
  it("is busy while a recut is requested", () => {
    expect(videoCardFromStatus(row({ titleScreenRecutRequestedAt: new Date() })).titleScreenBusy).toBe(true);
  });

  it("is busy while ripley is recutting", () => {
    expect(videoCardFromStatus(row({ titleScreenBusy: true })).titleScreenBusy).toBe(true);
  });

  it("is not busy after the recut finishes", () => {
    expect(videoCardFromStatus(row()).titleScreenBusy).toBe(false);
  });
});
