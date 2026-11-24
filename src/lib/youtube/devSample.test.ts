import { describe, expect, it } from "vitest";
import {
  sampleChannelMetrics,
  sampleClickReport,
  sampleDailyViews,
  sampleDailyViewsForVideos,
  sampleTopVideos,
  youtubeSampleMode,
} from "./devSample";

describe("dev sample YouTube numbers", () => {
  it("are only ever on under next dev with the switch set", () => {
    expect(youtubeSampleMode({ NODE_ENV: "development", SWAPP_DEV_SAMPLE_YOUTUBE: "1" })).toBe(true);
    expect(youtubeSampleMode({ NODE_ENV: "production", SWAPP_DEV_SAMPLE_YOUTUBE: "1" })).toBe(false);
    expect(youtubeSampleMode({ NODE_ENV: "development" })).toBe(false);
  });

  it("add up and stay the same across reloads", () => {
    const daily = sampleDailyViews("2026-10-23", "2026-11-21");
    expect(daily).toHaveLength(30);
    expect(daily).toEqual(sampleDailyViews("2026-10-23", "2026-11-21"));
    const metrics = sampleChannelMetrics("2026-10-23", "2026-11-21");
    expect(metrics.views).toBe(daily.reduce((n, d) => n + d.views, 0));
    const top = sampleTopVideos("2026-10-23", "2026-11-21");
    expect(top[0].views).toBeGreaterThan(top[top.length - 1].views);
    expect(sampleDailyViewsForVideos("2026-11-01", "2026-11-02", [top[0].videoId])).toHaveLength(2);
    const clicks = sampleClickReport(new Date("2026-11-24T00:00:00Z"));
    expect(clicks.totalClicks).toBe(clicks.byTag.reduce((n, t) => n + t.clicks, 0));
  });
});
