import { describe, expect, it } from "vitest";
import type { SiteHealth, HeadlineMetrics, ReportTable } from "@/lib/analytics/ga4";
import { combineSiteHealth, combineTrafficTrends } from "./combine";

function report(sessions: number, engagedSessions: number, rate: number): SiteHealth {
  const metrics: HeadlineMetrics = { activeUsers: sessions - 1, sessions, engagementRate: rate, newUsers: 2, engagedSessions, pageViews: sessions * 2, bounceRate: 1 - rate, engagementDuration: sessions * 10 };
  const comparison = Object.fromEntries(Object.entries(metrics).map(([key, current]) => [key, { current, previous: typeof current === "number" ? current / 2 : null, percentageChange: 100, direction: "increased" }])) as SiteHealth["headline"]["comparison"];
  const acquisition: ReportTable = { columns: [{ key: "channel", label: "Channel", type: "dimension" }, { key: "sessions", label: "Sessions", type: "metric" }, { key: "engagementRate", label: "Rate", type: "metric" }], rows: [{ channel: "Organic Search", sessions, engagementRate: rate }] };
  const landingPages: ReportTable = { columns: [{ key: "page", label: "Page", type: "dimension" }, { key: "sessions", label: "Sessions", type: "metric" }], rows: [{ page: "/", sessions }] };
  const geographicTraffic: ReportTable = { columns: [{ key: "country", label: "Country", type: "dimension" }, { key: "sessions", label: "Sessions", type: "metric" }], rows: [{ country: "US", sessions }] };
  return { headline: { current: metrics, comparison }, acquisition, landingPages, geographicTraffic, generatedAt: "2026-11-22T00:00:00Z" };
}

describe("combined Website traffic", () => {
  it("adds both GA properties and weights rates by sessions", () => {
    const combined = combineSiteHealth([report(100, 60, 0.6), report(20, 10, 0.5)]);
    expect(combined.headline.current.sessions).toBe(120);
    expect(combined.headline.current.activeUsers).toBe(118);
    expect(combined.headline.current.engagedSessions).toBe(70);
    expect(combined.headline.current.engagementRate).toBeCloseTo(70 / 120);
    expect(combined.headline.comparison.sessions.previous).toBe(60);
    expect(combined.acquisition.rows[0]).toMatchObject({ channel: "Organic Search", sessions: 120 });
    expect(combined.acquisition.rows[0].engagementRate).toBeCloseTo(70 / 120);
    expect(combined.landingPages.rows[0].sessions).toBe(120);
  });

  it("adds matching trend dates even when one property has no row", () => {
    expect(combineTrafficTrends([
      [{ date: "2026-11-20", current: 3, previous: 1 }],
      [{ date: "2026-11-20", current: 4, previous: 2 }, { date: "2026-11-21", current: 5, previous: 0 }],
    ])).toEqual([{ date: "2026-11-20", current: 7, previous: 3 }, { date: "2026-11-21", current: 5, previous: 0 }]);
  });
});
