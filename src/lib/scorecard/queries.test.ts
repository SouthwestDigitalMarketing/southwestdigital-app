import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/prisma", () => ({ prisma: {} }));

import type { Duty } from "@/lib/operations/playbook";
import {
  computeScorecard,
  dutiesSummary,
  firmDay,
  rangeWindow,
  reportStartedAt,
  reportedMonth,
  type EventRow,
  type ScorecardInput,
} from "./queries";

// Friday 2026-11-20, 12:00 CST.
const now = new Date("2026-11-20T18:00:00Z");

const ev = (over: Partial<EventRow>): EventRow => ({
  channel: "text",
  kind: "text_reply",
  startedAt: new Date("2026-11-20T15:00:00Z"),
  respondedAt: null,
  clockSeconds: null,
  businessSeconds: null,
  details: null,
  contactName: "Rodan",
  ...over,
});
const answered = (startIso: string, seconds: number, over: Partial<EventRow> = {}): EventRow =>
  ev({
    startedAt: new Date(startIso),
    respondedAt: new Date(new Date(startIso).getTime() + seconds * 1000),
    clockSeconds: seconds,
    businessSeconds: seconds,
    ...over,
  });

const input = (over: Partial<ScorecardInput>): ScorecardInput => ({
  range: "30d",
  now,
  events: [],
  reports: [],
  dutyClients: [],
  dutyEvidence: [],
  syncs: [],
  ...over,
});

describe("windows", () => {
  it("works out firm-local ranges", () => {
    expect(rangeWindow("today", now)).toEqual({ from: "2026-11-20", to: "2026-11-20" });
    expect(rangeWindow("week", now)).toEqual({ from: "2026-11-16", to: "2026-11-20" });
    expect(rangeWindow("week", new Date("2026-11-22T20:00:00Z"))).toEqual({ from: "2026-11-16", to: "2026-11-22" });
    expect(rangeWindow("week", new Date("2026-11-16T05:00:00Z"))).toEqual({ from: "2026-11-09", to: "2026-11-15" });
    expect(rangeWindow("30d", now)).toEqual({ from: "2026-10-22", to: "2026-11-20" });
    expect(rangeWindow("90d", now)).toEqual({ from: "2026-08-23", to: "2026-11-20" });
  });

  it("keys days in Chicago time", () => {
    expect(firmDay(new Date("2026-11-20T05:59:00Z"))).toBe("2026-11-19");
    expect(firmDay(new Date("2026-07-01T04:59:00Z"))).toBe("2026-06-30");
  });

  it("dates reports from the end of the month before the due day's month", () => {
    expect(reportedMonth("2026-11-20")).toBe("2026-10");
    expect(reportedMonth("2026-01-20")).toBe("2025-12");
    // 2026-10-31 23:59:59 CDT.
    expect(reportStartedAt("2026-11-20").toISOString()).toBe("2026-11-01T04:59:59.000Z");
    // 2026-01-31 23:59:59 CST.
    expect(reportStartedAt("2026-02-20").toISOString()).toBe("2026-02-01T05:59:59.000Z");
  });
});

describe("computeScorecard", () => {
  it("summarises texts and emails in range only", () => {
    const data = computeScorecard(
      input({
        range: "week",
        events: [
          answered("2026-11-17T15:00:00Z", 600),
          answered("2026-11-18T15:00:00Z", 1200),
          answered("2026-11-19T15:00:00Z", 7200),
          answered("2026-11-10T15:00:00Z", 99), // last week
          answered("2026-11-18T15:00:00Z", 3000, { channel: "email", kind: "email_reply" }),
          // Open for 2h of business time already: a miss.
          ev({ startedAt: new Date("2026-11-20T15:00:00Z") }),
        ],
      }),
    );
    expect(data.from).toBe("2026-11-16");
    expect(data.texts).toMatchObject({ count: 4, answered: 3, medianSeconds: 1200, p90Seconds: 7200, targetSeconds: 3600 });
    expect(data.texts.withinTargetShare).toBe(2 / 4);
    expect(data.emails).toMatchObject({ count: 1, answered: 1, medianSeconds: 3000, targetSeconds: 14_400, withinTargetShare: 1 });
    expect(data.businessHours.label).toBe("Mon–Fri 8am–5pm Central");
  });

  it("does not count a fresh open event as a miss yet", () => {
    const data = computeScorecard(
      input({ range: "today", events: [answered("2026-11-20T15:00:00Z", 600), ev({ startedAt: new Date("2026-11-20T17:50:00Z") })] }),
    );
    expect(data.texts.count).toBe(2);
    expect(data.texts.withinTargetShare).toBe(1);
  });

  it("counts calls, voicemails and callbacks", () => {
    const data = computeScorecard(
      input({
        events: [
          answered("2026-11-18T15:00:00Z", 0, { channel: "call", kind: "call_answered" }),
          answered("2026-11-18T16:00:00Z", 0, { channel: "call", kind: "call_answered" }),
          answered("2026-11-19T15:00:00Z", 1800, { channel: "call", kind: "call_missed", details: { voicemail: true } }),
          answered("2026-11-19T16:00:00Z", 5400, { channel: "call", kind: "call_missed" }),
        ],
      }),
    );
    expect(data.calls).toMatchObject({ incoming: 4, answeredLive: 2, missed: 2, voicemails: 1, answeredShare: 0.5 });
    expect(data.calls.callback).toMatchObject({ count: 2, answered: 2, medianSeconds: 3600, p90Seconds: 5400, withinTargetShare: 0.5 });
  });

  it("builds a 90-day daily series ending today", () => {
    const data = computeScorecard(
      input({
        events: [
          answered("2026-11-19T15:00:00Z", 100),
          answered("2026-11-19T16:00:00Z", 300),
          answered("2026-11-19T17:00:00Z", 900),
          answered("2026-11-19T15:00:00Z", 0, { channel: "call", kind: "call_answered" }),
          answered("2026-11-19T16:00:00Z", 60, { channel: "call", kind: "call_missed" }),
          answered("2026-05-01T15:00:00Z", 100), // older than the series
        ],
      }),
    );
    expect(data.series.texts).toHaveLength(90);
    expect(data.series.texts[0].date).toBe("2026-08-23");
    expect(data.series.texts[89]).toEqual({ date: "2026-11-20", count: 0, medianSeconds: null, p90Seconds: null });
    expect(data.series.texts[88]).toEqual({ date: "2026-11-19", count: 3, medianSeconds: 300, p90Seconds: 900 });
    expect(data.series.callbacks[88]).toMatchObject({ count: 1, medianSeconds: 60 });
    expect(data.series.callsAnsweredShare[88]).toEqual({ date: "2026-11-19", share: 0.5, incoming: 2 });
    expect(data.series.callsAnsweredShare[87]).toEqual({ date: "2026-11-18", share: null, incoming: 0 });
  });

  it("lists open events from the last 14 days, newest first, with business time waiting", () => {
    const data = computeScorecard(
      input({
        events: [
          ev({ startedAt: new Date("2026-11-19T22:00:00Z"), contactName: "Older" }), // Thu 16:00 CST
          ev({ startedAt: new Date("2026-11-20T17:00:00Z"), channel: "email", kind: "email_reply", contactName: null }),
          ev({ startedAt: new Date("2026-11-01T17:00:00Z") }), // too old
          answered("2026-11-20T16:00:00Z", 60),
        ],
      }),
    );
    expect(data.waiting).toEqual([
      { channel: "email", contactName: null, startedAt: "2026-11-20T17:00:00.000Z", businessSecondsWaiting: 3600 },
      // Thu 16:00-17:00 plus Fri 8:00-12:00.
      { channel: "text", contactName: "Older", startedAt: "2026-11-19T22:00:00.000Z", businessSecondsWaiting: 5 * 3600 },
    ]);
  });

  it("measures reports from month end to publication in clock time", () => {
    const data = computeScorecard(
      input({
        reports: [
          // October report published Nov 19 noon CST: 18.5 days late.
          { operationsClientId: "o1", clientName: "Rodan", period: "2026-11-20", occurredAt: new Date("2026-11-19T18:00:00Z") },
          // A second done post for the same close does not count again.
          { operationsClientId: "o1", clientName: "Rodan", period: "2026-11-20", occurredAt: new Date("2026-11-20T15:00:00Z") },
          // Published Nov 5: within 10 days.
          { operationsClientId: "o2", clientName: "BnB", period: "2026-11-20", occurredAt: new Date("2026-11-05T18:00:00Z") },
        ],
      }),
    );
    expect(data.reports.count).toBe(2);
    expect(data.reports.targetSeconds).toBe(864_000);
    expect(data.reports.withinTargetShare).toBe(0.5);
    expect(data.reports.days).toEqual([
      { client: "BnB", month: "2026-10", days: 4.5 },
      { client: "Rodan", month: "2026-10", days: 18.5 },
    ]);
  });

  it("passes syncs through", () => {
    const data = computeScorecard(
      input({ syncs: [{ source: "quo", lastRunAt: now, coveredTo: null, ok: false, note: "db locked" }] }),
    );
    expect(data.syncs).toEqual([{ source: "quo", lastRunAt: now.toISOString(), coveredTo: null, ok: false, note: "db locked" }]);
  });
});

describe("dutiesSummary", () => {
  const playbook: Duty[] = [
    { id: "daily", title: "Daily", cadence: "daily", when: "", scope: "client", owner: "", what: "", evidence: "" },
    { id: "firm-weekly", title: "Weekly", cadence: "weekly", weekday: 1, when: "", scope: "firm", owner: "", what: "", evidence: "" },
    { id: "onb", title: "Onboard", cadence: "onboarding", dayOffset: 2, when: "", scope: "client", owner: "", what: "", evidence: "" },
  ];
  const clients = [
    { id: "c1", startsOn: "2026-11-19", stage: "active" as const, wonOn: null },
    { id: "c2", startsOn: "2026-12-01", stage: "onboarding" as const, wonOn: "2026-11-17" },
  ];

  it("counts on time, late and not done for occurrences due by now since tracking started", () => {
    const summary = dutiesSummary({
      from: "2026-11-16",
      to: "2026-11-20",
      now,
      playbook,
      clients,
      evidence: [
        // Thu daily for c1: done before 17:00 CST.
        { dutyId: "daily", clientId: "c1", period: "2026-11-19", status: "done", occurredAt: new Date("2026-11-19T20:00:00Z") },
        // Onboarding step due Thu 19th: done Friday, late.
        { dutyId: "onb", clientId: "c2", period: "2026-11-19", status: "done", occurredAt: new Date("2026-11-20T15:00:00Z") },
      ],
    });
    // Tracking starts 2026-11-19: Thu daily (on time), Fri daily not yet due,
    // Monday's firm duty is before tracking, onboarding step late.
    expect(summary).toEqual({ due: 2, doneOnTime: 1, doneLate: 1, notDone: 0, onTimeShare: 0.5, trackingStarts: "2026-11-19" });
  });

  it("counts a missed occurrence as not done", () => {
    const summary = dutiesSummary({
      from: "2026-11-16",
      to: "2026-11-20",
      now: new Date("2026-11-21T00:00:00Z"), // Fri 18:00 CST
      playbook,
      clients,
      evidence: [{ dutyId: "daily", clientId: "c1", period: "2026-11-20", status: "waiting_client", occurredAt: now }],
    });
    expect(summary).toMatchObject({ due: 3, doneOnTime: 0, doneLate: 0, notDone: 3, onTimeShare: 0 });
  });

  it("is empty before tracking starts", () => {
    expect(dutiesSummary({ from: "2026-11-01", to: "2026-11-10", now, playbook, clients, evidence: [] })).toMatchObject({ due: 0, onTimeShare: null });
  });
});
