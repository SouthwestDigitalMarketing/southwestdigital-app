/**
 * Scorecard contract (docs/scorecard.md). Shared by the ingest API, the
 * queries the page reads, and the page itself. Change it only together with
 * docs/scorecard.md.
 */

export const SCORECARD_CHANNELS = ["text", "call", "email", "report"] as const;
export type ScorecardChannel = (typeof SCORECARD_CHANNELS)[number];

export const SCORECARD_KINDS = [
  "text_reply",
  "call_answered",
  "call_missed",
  "email_reply",
  "report_delivered",
] as const;
export type ScorecardKind = (typeof SCORECARD_KINDS)[number];

export const SCORECARD_SOURCES = ["quo", "zoho", "reports"] as const;
export type ScorecardSource = (typeof SCORECARD_SOURCES)[number];

/** One event as the collector posts it (POST /api/scorecard/ingest). */
export type ScorecardEventInput = {
  sourceKey: string;
  channel: ScorecardChannel;
  kind: ScorecardKind;
  contactId: string | null;
  /** ISO 8601 with offset or Z. */
  startedAt: string;
  respondedAt: string | null;
  responseVia: string | null;
  details?: Record<string, unknown> | null;
};

export type ScorecardSyncInput = {
  source: ScorecardSource;
  coveredTo: string | null;
  ok: boolean;
  note?: string | null;
};

/** POST /api/scorecard/ingest body. */
export type ScorecardIngestBody = {
  brand: string;
  events: ScorecardEventInput[];
  sync?: ScorecardSyncInput | null;
};

/** GET /api/scorecard/clients?brand=<slug> response row. */
export type ScorecardClient = {
  contactId: string;
  name: string;
  /** E.164 numbers (phoneE164, phoneNumber normalised). */
  phones: string[];
  /** Lower-cased addresses (email, secondaryEmail, businessEmail, personalEmail). */
  emails: string[];
  /** Earliest ServiceRecord startDate or evidenceDate, YYYY-MM-DD (firm date). */
  clientFrom: string;
  /** Latest endDate when every record has ended, else null (still a client). */
  clientUntil: string | null;
};

export type ScorecardRange = "today" | "week" | "30d" | "90d";

/** Summary for one measure over a range. Seconds are business-hours seconds. */
export type MeasureSummary = {
  /** Events in range that needed an answer. */
  count: number;
  /** Of those, answered (respondedAt set). */
  answered: number;
  medianSeconds: number | null;
  p90Seconds: number | null;
  /** Same, counted on the clock (24/7), for honesty in the video. */
  medianClockSeconds: number | null;
  p90ClockSeconds: number | null;
  /** Share answered within the target (0..1), null when count is 0. */
  withinTargetShare: number | null;
  targetSeconds: number;
};

export type DailyPoint = {
  /** Firm-local date YYYY-MM-DD. */
  date: string;
  count: number;
  medianSeconds: number | null;
  p90Seconds: number | null;
};

export type CallsSummary = {
  incoming: number;
  answeredLive: number;
  missed: number;
  /** Missed calls that left a voicemail. */
  voicemails: number;
  answeredShare: number | null;
  /** Time to call back (or text back) after a missed call. */
  callback: MeasureSummary;
};

export type WaitingItem = {
  channel: ScorecardChannel;
  contactName: string | null;
  startedAt: string;
  businessSecondsWaiting: number;
};

export type DutySummary = {
  /** Duty occurrences due in range (doneOnTime + doneLate + notDone). */
  due: number;
  doneOnTime: number;
  doneLate: number;
  notDone: number;
  onTimeShare: number | null;
  trackingStarts: string;
};

export type ScorecardData = {
  range: ScorecardRange;
  /** Firm-local window start/end dates YYYY-MM-DD (inclusive). */
  from: string;
  to: string;
  generatedAt: string;
  texts: MeasureSummary;
  calls: CallsSummary;
  emails: MeasureSummary;
  reports: MeasureSummary & { days: { client: string; month: string; days: number }[] };
  duties: DutySummary;
  /** Daily series for the graphs, always the last 90 firm days. */
  series: { texts: DailyPoint[]; emails: DailyPoint[]; callbacks: DailyPoint[]; callsAnsweredShare: { date: string; share: number | null; incoming: number }[] };
  waiting: WaitingItem[];
  syncs: { source: ScorecardSource; lastRunAt: string; coveredTo: string | null; ok: boolean; note: string | null }[];
  businessHours: { label: string };
};
