/**
 * Operations playbook: the firm's recurring duties for every bookkeeping
 * client. First draft chosen by Sol on Tom's go (2026-11-18); Tom edits it.
 * Design brief: All Thing concepts/swapp-operations.md.
 *
 * A duty only counts as done once an agent posts evidence for it
 * (OperationsEvidence); see schedule.ts for how due and overdue are worked out.
 */

export type Cadence = "daily" | "weekly" | "monthly";

export type Duty = {
  id: string;
  title: string;
  cadence: Cadence;
  /** Plain-words "when", shown to Tom. */
  when: string;
  /** weekly: 1 = Monday ... 5 = Friday. */
  weekday?: number;
  /** monthly: day of the month it is due. */
  dayOfMonth?: number;
  /** Firm-local hour (24h) on the due day after which it is overdue. Default 17. */
  dueHour?: number;
  /** "client" duties repeat for every active client; "firm" duties run once. */
  scope: "client" | "firm";
  owner: string;
  what: string;
  evidence: string;
};

export const PLAYBOOK: Duty[] = [
  {
    id: "daily-bank-feeds",
    title: "Bank feeds categorized",
    cadence: "daily",
    when: "Every business morning by 9am",
    dueHour: 9,
    scope: "client",
    owner: "Agent",
    what: "Code yesterday's pending bank and card transactions the client's own history answers. Park the rest in Uncategorized and ask one portal question (Notify off, no duplicates).",
    evidence: "Pending count per account, before and after",
  },
  {
    id: "daily-portal",
    title: "Portal checked",
    cadence: "daily",
    when: "Every business morning by 9am",
    dueHour: 9,
    scope: "client",
    owner: "Agent",
    what: "New uploads in Double filed by content; new answers applied to the books.",
    evidence: "Uploads and answers counted, files filed",
  },
  {
    id: "daily-messages",
    title: "Client messages answered",
    cadence: "daily",
    when: "Same business day",
    scope: "client",
    owner: "Agent drafts, Tom approves",
    what: "Every text and email from the client is answered or routed the day it arrives.",
    evidence: "Open client threads: 0",
  },
  {
    id: "daily-tom-review",
    title: "Morning review",
    cadence: "daily",
    when: "Every business morning",
    dueHour: 12,
    scope: "firm",
    owner: "Tom",
    what: "Open Operations, clear everything under Needs you, address anything red today.",
    evidence: "Needs you: 0",
  },
  {
    id: "weekly-status-note",
    title: "Weekly status note",
    cadence: "weekly",
    weekday: 1,
    when: "Mondays",
    scope: "client",
    owner: "Agent drafts, Tom approves, Donna sends",
    what: "What we did last week, what we need from them, what comes next.",
    evidence: "Sent message id",
  },
  {
    id: "weekly-owed-nudge",
    title: "Nudge on what the client owes",
    cadence: "weekly",
    weekday: 3,
    when: "Wednesdays",
    scope: "client",
    owner: "Agent drafts, Tom approves",
    what: "Statements or answers past their date get one friendly nudge with the portal link.",
    evidence: "Nudge sent, or nothing owed",
  },
  {
    id: "weekly-unpaid-invoices",
    title: "Unpaid invoice check",
    cadence: "weekly",
    weekday: 4,
    when: "Thursdays",
    scope: "firm",
    owner: "Agent, Tom approves any message",
    what: "Read our A/R aging. Any invoice past due gets a follow-up under that client's agreement.",
    evidence: "A/R aging read; follow-ups sent",
  },
  {
    id: "weekly-recap",
    title: "Friday recap",
    cadence: "weekly",
    weekday: 5,
    when: "Fridays",
    scope: "firm",
    owner: "Agent",
    what: "One page for Tom: what moved, what is stuck, what is due next week.",
    evidence: "Recap posted",
  },
  {
    id: "monthly-invoice",
    title: "Monthly invoice sent",
    cadence: "monthly",
    dayOfMonth: 1,
    when: "The 1st",
    scope: "client",
    owner: "Sol prepares, Tom approves, Donna sends",
    what: "Our invoice for the month, read back before sending.",
    evidence: "Invoice marked Sent in QuickBooks",
  },
  {
    id: "monthly-statement-reminder",
    title: "Statement reminder",
    cadence: "monthly",
    dayOfMonth: 1,
    when: "The 1st",
    scope: "client",
    owner: "Agent drafts, Tom approves",
    what: "Portal link and the statements we need, due by the 10th.",
    evidence: "Sent message id",
  },
  {
    id: "monthly-late-payment",
    title: "Late payment follow-up",
    cadence: "monthly",
    dayOfMonth: 8,
    when: "The 8th",
    scope: "client",
    owner: "Agent drafts, Tom approves",
    what: "Any invoice still unpaid 7 days after the 1st gets a follow-up per the agreement.",
    evidence: "Paid, or follow-up sent",
  },
  {
    id: "monthly-missing-docs",
    title: "Missing statements asked",
    cadence: "monthly",
    dayOfMonth: 10,
    when: "The 10th",
    scope: "client",
    owner: "Agent",
    what: "Anything not uploaded is asked in the portal. The close goes ahead with what we have.",
    evidence: "Portal questions posted",
  },
  {
    id: "monthly-close",
    title: "Close done, reports published",
    cadence: "monthly",
    dayOfMonth: 20,
    when: "By the 20th",
    scope: "client",
    owner: "Agent",
    what: "Last month's close in Double is Done (our work done), reports published to the portal.",
    evidence: "Double close at 100%, reports in the portal",
  },
  {
    id: "monthly-post-close-email",
    title: "Post-close email",
    cadence: "monthly",
    dayOfMonth: 21,
    when: "The 21st",
    scope: "client",
    owner: "Agent drafts, Tom approves",
    what: "Missing documents, reports are in the portal, how many questions wait, reports firm up once those arrive.",
    evidence: "Sent message id",
  },
  {
    id: "monthly-check-in",
    title: "Day-25 check-in and invoice heads-up",
    cadence: "monthly",
    dayOfMonth: 25,
    when: "The 25th",
    scope: "client",
    owner: "Tom",
    what: "A short personal check-in; mention next month's invoice is coming on the 1st.",
    evidence: "Call or message logged",
  },
];

export const CADENCES: Array<{ id: Cadence; label: string }> = [
  { id: "daily", label: "Daily" },
  { id: "weekly", label: "Weekly" },
  { id: "monthly", label: "Monthly" },
];

const TIME_ZONE = "America/Chicago";

/** Calendar parts of an instant, in the firm's time zone. */
export function firmDate(at: Date) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: TIME_ZONE,
    year: "numeric",
    month: "numeric",
    day: "numeric",
    weekday: "short",
  }).formatToParts(at);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
  const weekdays = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  return {
    year: Number(get("year")),
    month: Number(get("month")),
    day: Number(get("day")),
    weekday: weekdays.indexOf(get("weekday")),
  };
}

/** Duties due on the firm-local day containing `at`. Weekends have none. */
export function dutiesDueOn(at: Date, playbook: Duty[] = PLAYBOOK): Duty[] {
  const { day, weekday } = firmDate(at);
  const businessDay = weekday >= 1 && weekday <= 5;
  return playbook.filter((duty) => {
    if (duty.cadence === "daily") return businessDay;
    if (duty.cadence === "weekly") return duty.weekday === weekday;
    return duty.dayOfMonth === day;
  });
}

/** Monthly duties still ahead this month, soonest first. */
export function upcomingThisMonth(at: Date, playbook: Duty[] = PLAYBOOK): Duty[] {
  const { day } = firmDate(at);
  return playbook
    .filter((duty) => duty.cadence === "monthly" && (duty.dayOfMonth ?? 0) > day)
    .sort((a, b) => (a.dayOfMonth ?? 0) - (b.dayOfMonth ?? 0));
}
