/**
 * Turns the playbook into dated occurrences and gives each one a state from
 * the evidence agents posted. Nothing is created or ticked by hand: an
 * occurrence exists because the playbook says it falls due, and it is done
 * only when the newest evidence for it says so.
 */
import { PLAYBOOK, dutiesDueOn, firmDate, type Duty } from "./playbook";

const TIME_ZONE = "America/Chicago";

/** First day firm-wide duties are expected. Client duties start at each client's startsOn. */
export const TRACKING_STARTS = "2026-11-19";

/** How far back the screens look for open (overdue) occurrences. */
export const LOOKBACK_DAYS = 14;

export const EVIDENCE_STATUSES = ["done", "waiting_client", "needs_tom", "failed"] as const;
export type EvidenceStatus = (typeof EVIDENCE_STATUSES)[number];
export type DutyState = EvidenceStatus | "overdue" | "due";

/** Most urgent first. */
const STATE_RANK: Record<DutyState, number> = {
  failed: 0,
  overdue: 0,
  needs_tom: 1,
  waiting_client: 2,
  due: 3,
  done: 4,
};

export const STATE_LABEL: Record<DutyState, string> = {
  failed: "Failed",
  overdue: "Overdue",
  needs_tom: "Needs you",
  waiting_client: "Waiting on client",
  due: "Due",
  done: "Done",
};

/** "YYYY-MM-DD" of the firm-local day containing `at`. */
export function firmDateKey(at: Date): string {
  const { year, month, day } = firmDate(at);
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function offsetMinutes(at: Date): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: TIME_ZONE,
    hourCycle: "h23",
    year: "numeric",
    month: "numeric",
    day: "numeric",
    hour: "numeric",
    minute: "numeric",
  }).formatToParts(at);
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value);
  const wall = Date.UTC(get("year"), get("month") - 1, get("day"), get("hour"), get("minute"));
  return Math.round((wall - at.getTime()) / 60_000);
}

/** The instant of a firm-local wall time, e.g. 9:00 on 2026-11-19 in Chicago. */
export function firmInstant(dateKey: string, hour: number): Date {
  const [y, m, d] = dateKey.split("-").map(Number);
  const naive = Date.UTC(y, m - 1, d, hour);
  let at = new Date(naive - offsetMinutes(new Date(naive)) * 60_000);
  // A second pass settles days when daylight saving changes.
  at = new Date(naive - offsetMinutes(at) * 60_000);
  return at;
}

function addDays(dateKey: string, days: number): string {
  const [y, m, d] = dateKey.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10);
}

export type Occurrence = { duty: Duty; period: string; dueAt: Date };

/** Every duty occurrence from `fromKey` through the firm-local day of `now`. */
export function occurrences(fromKey: string, now: Date, playbook: Duty[] = PLAYBOOK): Occurrence[] {
  const todayKey = firmDateKey(now);
  const out: Occurrence[] = [];
  for (let key = fromKey; key <= todayKey; key = addDays(key, 1)) {
    for (const duty of dutiesDueOn(firmInstant(key, 12), playbook)) {
      out.push({ duty, period: key, dueAt: firmInstant(key, duty.dueHour ?? 17) });
    }
  }
  return out;
}

/** True when `period` is a day the duty falls due. */
export function isOccurrence(duty: Duty, period: string): boolean {
  return dutiesDueOn(firmInstant(period, 12), [duty]).length === 1;
}

/** The newest day on or before today that the duty fell due, within 62 days. */
export function latestPeriod(duty: Duty, now: Date): string | null {
  let key = firmDateKey(now);
  for (let i = 0; i < 62; i += 1, key = addDays(key, -1)) {
    if (isOccurrence(duty, key)) return key;
  }
  return null;
}

export function stateOf(dueAt: Date, latest: EvidenceStatus | undefined, now: Date): DutyState {
  if (latest) return latest;
  return now.getTime() >= dueAt.getTime() ? "overdue" : "due";
}

export type ClientStage = "onboarding" | "active" | "former";
export type BoardClient = {
  id: string;
  key?: string;
  name: string;
  startsOn: string;
  /** Default "active". */
  stage?: ClientStage;
  /** Day the client was won; onboarding duties count from here. */
  wonOn?: string | null;
};

/** Due day of an onboarding duty for a client won on `wonOn`. */
export function onboardingPeriod(duty: Duty, wonOn: string): string {
  return addDays(wonOn, duty.dayOffset ?? 0);
}
export type BoardEvidence = {
  dutyId: string;
  clientId: string | null;
  period: string;
  status: EvidenceStatus;
  summary: string;
  sourceRef: string | null;
  reportedBy: string;
  occurredAt: Date;
};
export type BoardItem = Occurrence & {
  client: BoardClient | null;
  state: DutyState;
  evidence: BoardEvidence | null;
};

/**
 * Every recurring occurrence in the lookback window for active clients, plus
 * every onboarding step for clients in onboarding (all of them, from the day
 * they were won, so the checklist shows whole). Sorted most urgent first,
 * then oldest due first.
 */
export function buildBoard(input: {
  now: Date;
  clients: BoardClient[];
  evidence: BoardEvidence[];
  playbook?: Duty[];
}): BoardItem[] {
  const { now, clients } = input;
  const windowStart = addDays(firmDateKey(now), -LOOKBACK_DAYS);
  const from = windowStart > TRACKING_STARTS ? windowStart : TRACKING_STARTS;
  const latest = new Map<string, BoardEvidence>();
  for (const row of input.evidence) {
    const key = `${row.dutyId}|${row.clientId ?? ""}|${row.period}`;
    const seen = latest.get(key);
    if (!seen || seen.occurredAt.getTime() <= row.occurredAt.getTime()) latest.set(key, row);
  }

  const playbook = input.playbook ?? PLAYBOOK;
  const items: BoardItem[] = [];
  const recurringClients = clients.filter((c) => (c.stage ?? "active") === "active");
  for (const occ of occurrences(from, now, playbook)) {
    const targets =
      occ.duty.scope === "firm" ? [null] : recurringClients.filter((c) => c.startsOn <= occ.period);
    for (const client of targets) {
      const evidence = latest.get(`${occ.duty.id}|${client?.id ?? ""}|${occ.period}`) ?? null;
      items.push({ ...occ, client, evidence, state: stateOf(occ.dueAt, evidence?.status, now) });
    }
  }
  const onboardingDuties = playbook.filter((d) => d.cadence === "onboarding");
  for (const client of clients) {
    if (client.stage !== "onboarding" || !client.wonOn) continue;
    for (const duty of onboardingDuties) {
      const period = onboardingPeriod(duty, client.wonOn);
      const dueAt = firmInstant(period, duty.dueHour ?? 17);
      const evidence = latest.get(`${duty.id}|${client.id}|${period}`) ?? null;
      items.push({ duty, period, dueAt, client, evidence, state: stateOf(dueAt, evidence?.status, now) });
    }
  }
  return items.sort(
    (a, b) => STATE_RANK[a.state] - STATE_RANK[b.state] || a.dueAt.getTime() - b.dueAt.getTime(),
  );
}

export type Health = "red" | "amber" | "green" | "none";

/** red: something overdue or failed. amber: waiting on someone. green: nothing wrong. */
export function healthOf(items: BoardItem[]): Health {
  if (items.length === 0) return "none";
  if (items.some((i) => i.state === "overdue" || i.state === "failed")) return "red";
  if (items.some((i) => i.state === "needs_tom" || i.state === "waiting_client")) return "amber";
  return "green";
}
