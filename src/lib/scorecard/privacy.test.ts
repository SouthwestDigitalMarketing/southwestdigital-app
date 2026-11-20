import { describe, expect, it } from "vitest";
import { clientAlias, privacyOn, privatizeScorecard } from "./privacy";
import type { ScorecardData } from "./types";

const summary = {
  count: 0,
  answered: 0,
  medianSeconds: null,
  p90Seconds: null,
  medianClockSeconds: null,
  p90ClockSeconds: null,
  withinTargetShare: null,
  targetSeconds: 3600,
};

function data(): ScorecardData {
  return {
    range: "week",
    from: "2026-11-16",
    to: "2026-11-20",
    generatedAt: "2026-11-20T15:00:00.000Z",
    texts: summary,
    emails: summary,
    calls: { incoming: 0, answeredLive: 0, missed: 0, voicemails: 0, answeredShare: null, callback: summary },
    reports: {
      ...summary,
      days: [
        { client: "Acme Plumbing", month: "2026-10", days: 12 },
        { client: "Zed Dental", month: "2026-10", days: 5 },
      ],
    },
    duties: { due: 0, doneOnTime: 0, doneLate: 0, notDone: 0, onTimeShare: null, trackingStarts: "2026-11-01" },
    series: { texts: [], emails: [], callbacks: [], callsAnsweredShare: [] },
    waiting: [
      { channel: "text", contactName: "Jane Smith", startedAt: "2026-11-20T14:00:00.000Z", businessSecondsWaiting: 60 },
      { channel: "email", contactName: "acme plumbing ", startedAt: "2026-11-20T13:00:00.000Z", businessSecondsWaiting: 600 },
      { channel: "call", contactName: null, startedAt: "2026-11-20T12:00:00.000Z", businessSecondsWaiting: 30 },
    ],
    syncs: [{ source: "zoho", lastRunAt: "2026-11-20T14:59:00.000Z", coveredTo: null, ok: false, note: "jane@example.com: 401" }],
    businessHours: { label: "Mon–Fri 8–5" },
  } as ScorecardData;
}

describe("privacyOn", () => {
  it("is on only for the value 1", () => {
    expect(privacyOn("1")).toBe(true);
    expect(privacyOn("0")).toBe(false);
    expect(privacyOn(undefined)).toBe(false);
  });
});

describe("clientAlias", () => {
  it("runs A to Z, then AA", () => {
    expect(clientAlias(0)).toBe("Client A");
    expect(clientAlias(25)).toBe("Client Z");
    expect(clientAlias(26)).toBe("Client AA");
    expect(clientAlias(27)).toBe("Client AB");
  });
});

describe("privatizeScorecard", () => {
  it("replaces every name, keeps one letter per client, and drops sync notes", () => {
    const out = privatizeScorecard(data());
    expect(out.waiting.map((w) => w.contactName)).toEqual(["Client A", "Client B", null]);
    expect(out.reports.days.map((r) => r.client)).toEqual(["Client A", "Client C"]);
    expect(out.syncs[0]).toMatchObject({ ok: false, note: null });
    const text = JSON.stringify(out);
    for (const real of ["Jane", "Smith", "Acme", "Zed", "example.com"]) expect(text).not.toContain(real);
  });
  it("keeps the numbers", () => {
    const out = privatizeScorecard(data());
    expect(out.reports.days.map((r) => r.days)).toEqual([12, 5]);
    expect(out.waiting.map((w) => w.businessSecondsWaiting)).toEqual([600, 60, 30]);
  });
});
