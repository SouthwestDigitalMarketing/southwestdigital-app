/**
 * What the Scorecard page reads (docs/scorecard.md). One fetch per table for
 * the last 90 firm days, then everything is computed in memory by
 * computeScorecard, which is pure so it can be tested without a database.
 *
 * Texts, calls and emails come from ScorecardEvent rows the collector posts.
 * Reports and duties are worked out at read time from OperationsEvidence.
 */
import { prisma } from "@/lib/prisma";
import { PLAYBOOK, firmDate, type Duty } from "@/lib/operations/playbook";
import {
  TRACKING_STARTS,
  firmInstant,
  occurrences,
  onboardingPeriod,
  type ClientStage,
} from "@/lib/operations/schedule";
import { BUSINESS_HOURS, businessSecondsBetween, clockSecondsBetween } from "./hours";
import { median, p90, summarize, type Span } from "./stats";
import type {
  DailyPoint,
  DutySummary,
  MeasureSummary,
  ScorecardChannel,
  ScorecardData,
  ScorecardRange,
  ScorecardSource,
  WaitingItem,
} from "./types";

/** Targets (docs/scorecard.md § Business hours). Reports are calendar time. */
export const TARGETS = {
  text: 3600,
  callback: 3600,
  email: 4 * 3600,
  report: 10 * 86_400,
} as const;

/** Graphs always cover this many firm days, ending today. */
export const SERIES_DAYS = 90;
/** The live list shows open events started this recently. */
export const WAITING_DAYS = 14;
export const WAITING_MAX = 20;

const REPORT_DUTY = "monthly-close";

let dayFormat: Intl.DateTimeFormat | null = null;
/** Firm-local "YYYY-MM-DD" of an instant; the formatter is built once. */
export function firmDay(at: Date): string {
  dayFormat ??= new Intl.DateTimeFormat("en-US", {
    timeZone: BUSINESS_HOURS.timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const parts = dayFormat.formatToParts(at);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
  return `${get("year")}-${get("month")}-${get("day")}`;
}

function addDays(dateKey: string, days: number): string {
  const [y, m, d] = dateKey.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10);
}

/** Firm-local first and last day (inclusive) of a range ending today. */
export function rangeWindow(range: ScorecardRange, now: Date): { from: string; to: string } {
  const to = firmDay(now);
  if (range === "today") return { from: to, to };
  if (range === "week") return { from: addDays(to, -((firmDate(now).weekday + 6) % 7)), to };
  return { from: addDays(to, range === "30d" ? -29 : -89), to };
}

export type EventRow = {
  channel: string;
  kind: string;
  startedAt: Date;
  respondedAt: Date | null;
  clockSeconds: number | null;
  businessSeconds: number | null;
  details: unknown;
  contactName: string | null;
};

export type ReportEvidenceRow = {
  operationsClientId: string | null;
  clientName: string | null;
  /** Due day of the close (in the month after the reported month), YYYY-MM-DD. */
  period: string;
  occurredAt: Date;
};

export type DutyClientRow = {
  id: string;
  startsOn: string;
  stage: ClientStage;
  wonOn: string | null;
};

export type DutyEvidenceRow = {
  dutyId: string;
  clientId: string | null;
  period: string;
  status: string;
  occurredAt: Date;
};

export type SyncRow = {
  source: string;
  lastRunAt: Date;
  coveredTo: Date | null;
  ok: boolean;
  note: string | null;
};

export type ScorecardInput = {
  range: ScorecardRange;
  now: Date;
  events: EventRow[];
  reports: ReportEvidenceRow[];
  dutyClients: DutyClientRow[];
  dutyEvidence: DutyEvidenceRow[];
  syncs: SyncRow[];
  playbook?: Duty[];
};

/** A span for summarize; open events carry how long they have waited so far. */
function spanOf(event: EventRow, now: Date, targetSeconds: number): Span {
  if (event.respondedAt) {
    return {
      businessSeconds: event.businessSeconds ?? businessSecondsBetween(event.startedAt, event.respondedAt),
      clockSeconds: event.clockSeconds ?? clockSecondsBetween(event.startedAt, event.respondedAt),
    };
  }
  // Business time never exceeds clock time, so a young event skips the walk.
  const clock = clockSecondsBetween(event.startedAt, now);
  return {
    businessSeconds: null,
    clockSeconds: null,
    waitingSeconds: clock < targetSeconds ? clock : businessSecondsBetween(event.startedAt, now),
  };
}

const isVoicemail = (details: unknown) =>
  !!details && typeof details === "object" && (details as Record<string, unknown>).voicemail === true;

function dailySeries(days: string[], events: EventRow[], dayOf: Map<EventRow, string>): DailyPoint[] {
  const byDay = new Map<string, EventRow[]>();
  for (const event of events) {
    const list = byDay.get(dayOf.get(event)!) ?? [];
    list.push(event);
    byDay.set(dayOf.get(event)!, list);
  }
  return days.map((date) => {
    const list = byDay.get(date) ?? [];
    const answered = list.flatMap((e) =>
      e.respondedAt ? [e.businessSeconds ?? businessSecondsBetween(e.startedAt, e.respondedAt)] : [],
    );
    return { date, count: list.length, medianSeconds: median(answered), p90Seconds: p90(answered) };
  });
}

/** Last moment (23:59:59 firm time) of the month before the period's month. */
export function reportStartedAt(period: string): Date {
  return new Date(firmInstant(`${period.slice(0, 7)}-01`, 0).getTime() - 1000);
}

/** "YYYY-MM" of the month a close reports on: the month before its due day. */
export function reportedMonth(period: string): string {
  const [y, m] = period.split("-").map(Number);
  return new Date(Date.UTC(y, m - 2, 1)).toISOString().slice(0, 7);
}

/**
 * Reports delivered in the window: the first done monthly-close evidence per
 * client and period, counted on the day it was published.
 */
function reportsSummary(rows: ReportEvidenceRow[], from: string, to: string): ScorecardData["reports"] {
  const first = new Map<string, ReportEvidenceRow>();
  for (const row of rows) {
    const key = `${row.operationsClientId ?? ""}|${row.period}`;
    const seen = first.get(key);
    if (!seen || row.occurredAt.getTime() < seen.occurredAt.getTime()) first.set(key, row);
  }
  const delivered = [...first.values()]
    .filter((r) => {
      const day = firmDay(r.occurredAt);
      return day >= from && day <= to;
    })
    .map((r) => {
      const startedAt = reportStartedAt(r.period);
      return {
        row: r,
        span: {
          businessSeconds: businessSecondsBetween(startedAt, r.occurredAt),
          clockSeconds: clockSecondsBetween(startedAt, r.occurredAt),
        },
      };
    })
    .sort((a, b) => a.row.occurredAt.getTime() - b.row.occurredAt.getTime());
  return {
    ...summarize(
      delivered.map((d) => d.span),
      TARGETS.report,
      "clock",
    ),
    days: delivered.map((d) => ({
      client: d.row.clientName ?? "Firm",
      month: reportedMonth(d.row.period),
      days: Math.round((d.span.clockSeconds / 86_400) * 10) / 10,
    })),
  };
}

/**
 * Duty occurrences due in the window (from tracking start, up to now): on time
 * when a done report was made by the due time, late when done after it, not
 * done otherwise. Mirrors buildBoard's targets: recurring duties for active
 * clients from their startsOn, firm duties once, onboarding steps from the day
 * each client was won.
 */
export function dutiesSummary(input: {
  from: string;
  to: string;
  now: Date;
  clients: DutyClientRow[];
  evidence: DutyEvidenceRow[];
  playbook?: Duty[];
}): DutySummary {
  const playbook = input.playbook ?? PLAYBOOK;
  const from = input.from > TRACKING_STARTS ? input.from : TRACKING_STARTS;
  const done = new Map<string, Date[]>();
  for (const row of input.evidence) {
    if (row.status !== "done") continue;
    const key = `${row.dutyId}|${row.clientId ?? ""}|${row.period}`;
    const list = done.get(key) ?? [];
    list.push(row.occurredAt);
    done.set(key, list);
  }
  let onTime = 0;
  let late = 0;
  let notDone = 0;
  const judge = (dutyId: string, clientId: string | null, period: string, dueAt: Date) => {
    if (dueAt.getTime() > input.now.getTime()) return;
    const times = done.get(`${dutyId}|${clientId ?? ""}|${period}`) ?? [];
    if (times.some((t) => t.getTime() <= dueAt.getTime())) onTime += 1;
    else if (times.length) late += 1;
    else notDone += 1;
  };
  if (from <= input.to) {
    const recurring = input.clients.filter((c) => c.stage === "active");
    for (const occ of occurrences(from, input.now, playbook)) {
      if (occ.period > input.to) continue;
      if (occ.duty.scope === "firm") {
        judge(occ.duty.id, null, occ.period, occ.dueAt);
        continue;
      }
      for (const client of recurring) {
        if (client.startsOn <= occ.period) judge(occ.duty.id, client.id, occ.period, occ.dueAt);
      }
    }
    for (const client of input.clients) {
      if (!client.wonOn || client.stage === "former") continue;
      for (const duty of playbook.filter((d) => d.cadence === "onboarding")) {
        const period = onboardingPeriod(duty, client.wonOn);
        if (period < from || period > input.to) continue;
        judge(duty.id, client.id, period, firmInstant(period, duty.dueHour ?? 17));
      }
    }
  }
  const due = onTime + late + notDone;
  return {
    due,
    doneOnTime: onTime,
    doneLate: late,
    notDone,
    onTimeShare: due === 0 ? null : onTime / due,
    trackingStarts: TRACKING_STARTS,
  };
}

/** Everything the page shows, from rows already fetched. */
export function computeScorecard(input: ScorecardInput): ScorecardData {
  const { range, now } = input;
  const { from, to } = rangeWindow(range, now);
  const today = firmDay(now);
  const seriesDays = Array.from({ length: SERIES_DAYS }, (_, i) => addDays(today, i - (SERIES_DAYS - 1)));
  const seriesFrom = seriesDays[0];

  const dayOf = new Map<EventRow, string>();
  for (const event of input.events) dayOf.set(event, firmDay(event.startedAt));
  const inSeries = input.events.filter((e) => dayOf.get(e)! >= seriesFrom && dayOf.get(e)! <= today);
  const inRange = inSeries.filter((e) => dayOf.get(e)! >= from && dayOf.get(e)! <= to);
  const ofKind = (list: EventRow[], kind: string) => list.filter((e) => e.kind === kind);

  const measure = (kind: string, target: number): MeasureSummary =>
    summarize(
      ofKind(inRange, kind).map((e) => spanOf(e, now, target)),
      target,
    );

  const answeredCalls = ofKind(inRange, "call_answered");
  const missedCalls = ofKind(inRange, "call_missed");
  const incoming = answeredCalls.length + missedCalls.length;

  const callsByDay = new Map<string, { answered: number; incoming: number }>();
  for (const event of inSeries) {
    if (event.kind !== "call_answered" && event.kind !== "call_missed") continue;
    const day = dayOf.get(event)!;
    const row = callsByDay.get(day) ?? { answered: 0, incoming: 0 };
    row.incoming += 1;
    if (event.kind === "call_answered") row.answered += 1;
    callsByDay.set(day, row);
  }

  const waitingSince = now.getTime() - WAITING_DAYS * 86_400_000;
  const waiting: WaitingItem[] = input.events
    .filter(
      (e) =>
        e.respondedAt === null &&
        e.kind !== "call_answered" &&
        e.kind !== "report_delivered" &&
        e.startedAt.getTime() >= waitingSince &&
        e.startedAt.getTime() <= now.getTime(),
    )
    .sort((a, b) => b.startedAt.getTime() - a.startedAt.getTime())
    .slice(0, WAITING_MAX)
    .map((e) => ({
      channel: e.channel as ScorecardChannel,
      contactName: e.contactName,
      startedAt: e.startedAt.toISOString(),
      businessSecondsWaiting: businessSecondsBetween(e.startedAt, now),
    }));

  return {
    range,
    from,
    to,
    generatedAt: now.toISOString(),
    texts: measure("text_reply", TARGETS.text),
    calls: {
      incoming,
      answeredLive: answeredCalls.length,
      missed: missedCalls.length,
      voicemails: missedCalls.filter((e) => isVoicemail(e.details)).length,
      answeredShare: incoming === 0 ? null : answeredCalls.length / incoming,
      callback: measure("call_missed", TARGETS.callback),
    },
    emails: measure("email_reply", TARGETS.email),
    reports: reportsSummary(input.reports, from, to),
    duties: dutiesSummary({
      from,
      to,
      now,
      clients: input.dutyClients,
      evidence: input.dutyEvidence,
      playbook: input.playbook,
    }),
    series: {
      texts: dailySeries(seriesDays, ofKind(inSeries, "text_reply"), dayOf),
      emails: dailySeries(seriesDays, ofKind(inSeries, "email_reply"), dayOf),
      callbacks: dailySeries(seriesDays, ofKind(inSeries, "call_missed"), dayOf),
      callsAnsweredShare: seriesDays.map((date) => {
        const row = callsByDay.get(date);
        return {
          date,
          share: row && row.incoming ? row.answered / row.incoming : null,
          incoming: row?.incoming ?? 0,
        };
      }),
    },
    waiting,
    syncs: input.syncs.map((s) => ({
      source: s.source as ScorecardSource,
      lastRunAt: s.lastRunAt.toISOString(),
      coveredTo: s.coveredTo ? s.coveredTo.toISOString() : null,
      ok: s.ok,
      note: s.note,
    })),
    businessHours: { label: BUSINESS_HOURS.label },
  };
}

const dateKey = (d: Date) => d.toISOString().slice(0, 10);

/** The Scorecard for a brand and range, as of `now`. */
export async function getScorecardData(brandId: string, range: ScorecardRange, now: Date): Promise<ScorecardData> {
  const today = firmDay(now);
  const seriesFrom = addDays(today, -(SERIES_DAYS - 1));
  // The series window always contains every range and the waiting window.
  const since = firmInstant(seriesFrom, 0);
  const { from } = rangeWindow(range, now);
  const dutiesFrom = from > TRACKING_STARTS ? from : TRACKING_STARTS;

  const [events, reports, dutyClients, dutyEvidence, syncs] = await Promise.all([
    prisma.scorecardEvent.findMany({
      where: { brandId, startedAt: { gte: since, lte: now } },
      select: {
        channel: true,
        kind: true,
        startedAt: true,
        respondedAt: true,
        clockSeconds: true,
        businessSeconds: true,
        details: true,
        contact: { select: { name: true } },
      },
    }),
    prisma.operationsEvidence.findMany({
      where: { brandId, dutyId: REPORT_DUTY, status: "done" },
      select: { operationsClientId: true, period: true, occurredAt: true, client: { select: { name: true } } },
    }),
    prisma.operationsClient.findMany({
      where: { brandId, active: true, stage: { not: "former" } },
      select: { id: true, startsOn: true, stage: true, wonOn: true },
    }),
    prisma.operationsEvidence.findMany({
      // Every occurrence judged has its period on or after dutiesFrom.
      where: { brandId, period: { gte: new Date(`${dutiesFrom}T00:00:00Z`) } },
      select: { dutyId: true, operationsClientId: true, period: true, status: true, occurredAt: true },
    }),
    prisma.scorecardSync.findMany({
      where: { brandId },
      orderBy: { source: "asc" },
      select: { source: true, lastRunAt: true, coveredTo: true, ok: true, note: true },
    }),
  ]);

  return computeScorecard({
    range,
    now,
    events: events.map(({ contact, ...e }) => ({ ...e, contactName: contact?.name ?? null })),
    reports: reports.map((r) => ({
      operationsClientId: r.operationsClientId,
      clientName: r.client?.name ?? null,
      period: dateKey(r.period),
      occurredAt: r.occurredAt,
    })),
    dutyClients: dutyClients.map((c) => ({
      id: c.id,
      startsOn: dateKey(c.startsOn),
      stage: c.stage as ClientStage,
      wonOn: c.wonOn ? dateKey(c.wonOn) : null,
    })),
    dutyEvidence: dutyEvidence.map((r) => ({
      dutyId: r.dutyId,
      clientId: r.operationsClientId,
      period: dateKey(r.period),
      status: r.status,
      occurredAt: r.occurredAt,
    })),
    syncs,
  });
}
