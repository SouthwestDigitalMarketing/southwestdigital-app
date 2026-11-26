import { createHmac, timingSafeEqual } from "node:crypto";
import { z } from "zod";

export const STATES = ["needs-you", "working", "waiting", "handled"] as const;
export type DonnaState = (typeof STATES)[number];
export const TABS: Record<DonnaState, string> = {
  "needs-you": "Needs you",
  working: "Working",
  waiting: "Waiting",
  handled: "Handled",
};
export const ACTIVITY_LABELS: Record<string, string> = {
  reviewed: "Emails reviewed",
  handled: "Emails handled",
  spam: "Marked as spam",
  rescued: "Rescued from spam",
  tagged: "Tagged",
  untagged: "Tags removed",
  filed: "Filed",
  document: "Documents filed",
  "draft-ready": "Replies prepared",
  sent: "Replies sent",
  "request-opened": "Requests opened",
  answered: "Requests answered",
  completed: "Requests finished",
  reopened: "Requests reopened",
  lead: "Sales enquiries",
  "follow-up": "Follow-ups prepared",
  corrected: "Corrections",
  failed: "Failed actions",
};
export const draftSchema = z
  .object({
    from: z.email(),
    to: z.array(z.email()).min(1).max(20),
    cc: z.array(z.email()).max(20).default([]),
    subject: z.string().max(500),
    body: z.string().min(1).max(20000),
    attachments: z.array(z.string().max(250)).max(30).default([]),
  })
  .strict();
export const evidenceSchema = z
  .object({
    key: z.string().min(1).max(250),
    from: z.string().max(500),
    subject: z.string().max(500),
    at: z.iso.datetime(),
    excerpt: z.string().max(600),
    folder: z.string().max(250),
    attachments: z.array(z.string().max(250)).max(50).default([]),
  })
  .strict();
export const requestSchema = z
  .object({
    sourceKey: z.string().min(1).max(250),
    sourceVersion: z.string().min(1).max(150),
    baseVersion: z.number().int().positive().nullable(),
    title: z.string().min(1).max(250),
    person: z.string().max(500),
    category: z.enum([
      "client",
      "sales",
      "business",
      "information",
      "personal",
      "noise",
      "unknown",
    ]),
    owner: z.string().min(1).max(100),
    state: z.enum(STATES),
    urgent: z.boolean(),
    summary: z.string().min(1).max(3000),
    recommendation: z.string().min(1).max(3000),
    nextAction: z.string().min(1).max(1000),
    evidence: z.array(evidenceSchema).min(1).max(100),
    draft: draftSchema.nullable(),
    firstReceivedAt: z.iso.datetime(),
    dueAt: z.iso.datetime().nullable(),
    followUpAt: z.iso.datetime().nullable(),
    waitingOn: z.string().max(200).nullable(),
    answeredAt: z.iso.datetime().nullable(),
    completionNote: z.string().max(2000).nullable(),
  })
  .strict()
  .superRefine((r, ctx) => {
    if (r.state === "handled" && (!r.completionNote || r.draft))
      ctx.addIssue({
        code: "custom",
        message:
          "Finished work requires completion evidence and no unsent draft.",
      });
    if (r.state === "waiting" && (!r.waitingOn || !r.followUpAt))
      ctx.addIssue({
        code: "custom",
        message: "Waiting work requires a waiting party and follow-up date.",
      });
  });
export const activitySchema = z
  .object({
    eventKey: z.string().min(1).max(250),
    messageKey: z.string().min(1).max(250).nullable(),
    kind: z.enum(Object.keys(ACTIVITY_LABELS) as [string, ...string[]]),
    detail: z.string().min(1).max(1000),
    evidence: z.string().min(1).max(2000),
    occurredAt: z.iso.datetime(),
    metadata: z.record(z.string(), z.string().max(500)).default({}),
  })
  .strict();

export function verifyHook(
  raw: Buffer,
  signature: string | null,
  secret: string,
): boolean {
  if (!signature || !secret || !/^[A-Za-z0-9+/]+={0,2}$/.test(signature))
    return false;
  const expected = createHmac("sha256", secret).update(raw).digest();
  const given = Buffer.from(signature, "base64");
  return given.length === expected.length && timingSafeEqual(given, expected);
}

export function mailboxHealth(
  m: {
    paused: boolean;
    heartbeatAt: Date | null;
    lastError: string | null;
    hookSecret: string | null;
    lastCheckedAt: Date | null;
    coverage?: unknown;
  },
  now = new Date(),
) {
  if (m.paused) return "Paused";
  if (m.lastError) return "Needs attention";
  if (!m.heartbeatAt || now.getTime() - m.heartbeatAt.getTime() > 90_000)
    return "Worker offline";
  if (!m.lastCheckedAt) return "Checking mailbox coverage";
  const coverage = m.coverage as { idleInbox?: boolean } | null;
  return m.hookSecret
    ? "Listening for email"
    : coverage?.idleInbox
      ? "Listening for inbox · other folders checked during recovery"
      : "Webhook setup needed";
}

const ZOHO_DEFAULT_FOLDERS = new Set([
  "inbox",
  "drafts",
  "templates",
  "snoozed",
  "sent",
  "spam",
  "junk",
  "trash",
  "outbox",
  "archive",
]);
const ZOHO_FOLDER_ORDER = [
  "INBOX",
  "Spam",
  "Sent",
  "Drafts",
  "Trash",
  "Archive",
  "Snoozed",
  "Templates",
  "Outbox",
  "Junk",
];

export type MailboxFolder = {
  folder: string;
  label: string;
  messages: number;
  zohoDefault: boolean;
};

function folderRank(name: string) {
  const i = ZOHO_FOLDER_ORDER.findIndex(
    (item) => item.toLowerCase() === name.toLowerCase(),
  );
  return i === -1 ? ZOHO_FOLDER_ORDER.length : i;
}

export function isZohoDefaultFolder(name: string) {
  return ZOHO_DEFAULT_FOLDERS.has(name.trim().toLowerCase());
}

export function mailboxFolders(value: unknown): MailboxFolder[] {
  if (!value || typeof value !== "object" || Array.isArray(value)) return [];
  const folders = (value as { folders?: unknown }).folders;
  if (!Array.isArray(folders)) return [];
  const rows = folders.flatMap((item) => {
    if (!item || typeof item !== "object" || Array.isArray(item)) return [];
    const raw = item as { folder?: unknown; messages?: unknown };
    const folder = typeof raw.folder === "string" ? raw.folder.trim() : "";
    if (!folder) return [];
    const messages =
      typeof raw.messages === "number" && Number.isFinite(raw.messages)
        ? Math.max(0, Math.trunc(raw.messages))
        : 0;
    return [
      {
        folder,
        label: folder.toUpperCase() === "INBOX" ? "Inbox" : folder,
        messages,
        zohoDefault: isZohoDefaultFolder(folder),
      },
    ];
  });
  return rows.sort((a, b) => {
    if (a.zohoDefault !== b.zohoDefault) return a.zohoDefault ? -1 : 1;
    if (a.zohoDefault)
      return (
        folderRank(a.folder) - folderRank(b.folder) ||
        a.label.localeCompare(b.label)
      );
    return a.label.localeCompare(b.label);
  });
}

export function mailboxFolderTables(value: unknown) {
  const folders = mailboxFolders(value);
  return {
    zoho: folders.filter((folder) => folder.zohoDefault),
    custom: folders.filter((folder) => !folder.zohoDefault),
  };
}

export type DonnaActionCounts = {
  inbox: number;
  spam: number;
  notifications: number;
  trash: number;
  drafts: number;
  all: number;
};

export function donnaActionCounts(value: unknown): DonnaActionCounts {
  const folders = mailboxFolders(value);
  const count = (name: string) =>
    folders.find((folder) => folder.folder.toLowerCase() === name)?.messages ??
    0;
  const inbox = count("inbox");
  const spam = count("spam");
  const notifications = count("notification");
  const trash = count("trash");
  const drafts = count("drafts");
  return {
    inbox,
    spam,
    notifications,
    trash,
    drafts,
    all: inbox + spam + notifications + trash + drafts,
  };
}

export type CleanBarStatus = {
  id: string;
  /** "Checking inbox" for a preview, "Cleaning inbox" when mail moves. */
  title: string;
  paused: boolean;
  /** Queued, and no worker heartbeat in the last 90 seconds: nothing will pick it up. */
  offline: boolean;
  waiting: boolean;
  total: number;
  done: number;
  percent: number;
  current: string | null;
  label: string;
  countLabel: string;
  etaLabel: string | null;
};

export function formatCleanEta(seconds: number): string {
  if (seconds < 60) return "Under a minute left";
  const minutes = Math.max(1, Math.round(seconds / 60));
  if (minutes === 1) return "About 1 min left";
  if (minutes < 60) return `About ${minutes} min left`;
  const hours = Math.max(1, Math.round(minutes / 60));
  return hours === 1 ? "About 1 hr left" : `About ${hours} hr left`;
}

/** Only an explicit preview moves nothing; other cleans file on their own. */
export function cleanIsPreview(options: unknown): boolean {
  return Boolean(
    options &&
    typeof options === "object" &&
    !Array.isArray(options) &&
    (options as { preview?: unknown }).preview === true,
  );
}

/** Step 1 of a stepped clean: sort Inbox into buckets, move nothing. */
export function cleanIsSort(options: unknown): boolean {
  return Boolean(
    options &&
    typeof options === "object" &&
    !Array.isArray(options) &&
    (options as { buckets?: unknown }).buckets === true &&
    !Array.isArray((options as { plan?: unknown }).plan),
  );
}

/** Folders step 2 may move mail to; anything else stays in Inbox. */
export const STEP_FOLDERS = [
  "Archive",
  "Bills",
  "Payments",
  "Newsletter",
  "Notification",
  "Cold Outreach",
  "Personal",
  "DMARC",
  "Spam",
] as const;

/** Bucket order on the step 1 page: what matters most first. */
export const BUCKET_ORDER = [
  "Money and legal",
  "Clients",
  "People you know",
  "Sales and leads",
  "Needs a reply or decision",
  "Not sure",
];

export const BUCKET_NOTES: Record<string, string> = {
  "Money and legal":
    "Past due, final notice, expiring, collection or a client question in Double. Your Mailroom keep rules put these here.",
  Clients: "From a client in SWapp contacts, or reads like client mail.",
  "People you know": "From someone in your SWapp contacts.",
  "Sales and leads": "Reads like a lead or a sales conversation.",
  "Needs a reply or decision": "Donna thinks you need to answer or decide.",
  "Not sure": "Donna could not tell where this belongs.",
};

export type SortedItem = {
  thread: string;
  subject: string;
  from: string;
  at: string;
  bucket: string;
  why: string;
  suggest: string | null;
  client: string | null;
};

export type Bucket = {
  name: string;
  note: string;
  suggest: string | null;
  items: SortedItem[];
};

function sortedItems(value: unknown): SortedItem[] {
  if (!Array.isArray(value)) return [];
  const text = (v: unknown, n: number) =>
    typeof v === "string" ? v.trim().slice(0, n) : "";
  return value.flatMap((item) => {
    if (!item || typeof item !== "object" || Array.isArray(item)) return [];
    const raw = item as Record<string, unknown>;
    const thread = text(raw.thread, 64);
    if (!/^[a-f0-9]{1,64}$/.test(thread)) return [];
    const suggest = text(raw.suggest, 80);
    return [
      {
        thread,
        subject: text(raw.subject, 200) || "Email",
        from: text(raw.from, 200),
        at: text(raw.at, 40),
        bucket: text(raw.bucket, 80) || "Not sure",
        why: text(raw.why, 300),
        suggest: (STEP_FOLDERS as readonly string[]).includes(suggest)
          ? suggest
          : null,
        client: text(raw.client, 120) || null,
      },
    ];
  });
}

/** Step 1's buckets, most important first; folder buckets after, biggest first. */
export function cleanBuckets(raw: unknown): Bucket[] {
  const items =
    raw && typeof raw === "object" && !Array.isArray(raw)
      ? sortedItems((raw as { sorted?: unknown }).sorted)
      : [];
  const groups = new Map<string, SortedItem[]>();
  for (const item of items)
    groups.set(item.bucket, [...(groups.get(item.bucket) ?? []), item]);
  const rank = (name: string) => {
    const i = BUCKET_ORDER.indexOf(name);
    return i === -1 ? BUCKET_ORDER.length : i;
  };
  return [...groups.entries()]
    .map(([name, list]) => ({
      name,
      note:
        BUCKET_NOTES[name] ??
        (list[0].suggest
          ? `Donna would move these to ${list[0].suggest}.`
          : "Donna sorted these together."),
      suggest: list.every((i) => i.suggest === list[0].suggest)
        ? list[0].suggest
        : null,
      items: list,
    }))
    .sort(
      (a, b) =>
        rank(a.name) - rank(b.name) ||
        b.items.length - a.items.length ||
        a.name.localeCompare(b.name),
    );
}

export function cleanBarStatus(
  job: { id: string; status: string; options?: unknown },
  coverage: unknown,
  now = new Date(),
  paused = false,
  heartbeatAt?: Date | null,
): CleanBarStatus {
  const counts = donnaActionCounts(coverage);
  const raw =
    coverage && typeof coverage === "object" && !Array.isArray(coverage)
      ? (coverage as { cleanProgress?: unknown }).cleanProgress
      : null;
  const progress =
    raw && typeof raw === "object" && !Array.isArray(raw)
      ? (raw as Record<string, unknown>)
      : {};
  const total =
    typeof progress.total === "number" && Number.isFinite(progress.total)
      ? Math.max(0, Math.trunc(progress.total))
      : counts.inbox;
  const done =
    typeof progress.done === "number" && Number.isFinite(progress.done)
      ? Math.max(0, Math.min(total, Math.trunc(progress.done)))
      : 0;
  const current =
    typeof progress.current === "string" && progress.current.trim()
      ? progress.current.trim().slice(0, 200)
      : null;
  const waiting = paused || job.status !== "leased";
  const offline =
    waiting &&
    !paused &&
    heartbeatAt !== undefined &&
    (!heartbeatAt || now.getTime() - heartbeatAt.getTime() > 90_000);
  const percent =
    total > 0 ? Math.min(100, Math.round((done / total) * 100)) : 0;
  let etaLabel: string | null = null;
  const startedAt =
    typeof progress.startedAt === "string"
      ? Date.parse(progress.startedAt)
      : NaN;
  if (!waiting && done > 0 && total > done && Number.isFinite(startedAt)) {
    const elapsed = Math.max(1, (now.getTime() - startedAt) / 1000);
    etaLabel = formatCleanEta((elapsed / done) * (total - done));
  }
  const title = cleanIsSort(job.options)
    ? "Step 1: sorting Inbox into buckets"
    : Array.isArray((job.options as { plan?: unknown } | null)?.plan) &&
        (job.options as { buckets?: unknown }).buckets === true
      ? "Step 2: doing what you chose"
      : cleanIsPreview(job.options)
        ? "Checking inbox"
        : "Cleaning inbox";
  return {
    id: job.id,
    title,
    paused,
    offline,
    waiting,
    total,
    done,
    percent,
    current,
    label: paused
      ? "Paused"
      : offline
        ? "Donna is not running"
        : waiting
          ? "Waiting for Donna"
          : current
            ? current
            : title,
    countLabel: `${done.toLocaleString("en-US")} of ${total.toLocaleString("en-US")}`,
    etaLabel: waiting ? null : etaLabel,
  };
}

export type CleanReportItem = {
  /** Worker thread id; present on filed items so they can be approved or undone. */
  thread?: string;
  subject: string;
  from: string;
  undone?: boolean;
  undoPending?: boolean;
  undoError?: string;
  folder?: string;
  /** Zoho client tag added in step 2. */
  tag?: string;
  waitingOn?: string;
  nextAction?: string;
  reason?: string;
};

export type CleanReport = {
  /** True when nothing moved: the list is what Donna would file. */
  preview: boolean;
  cancelled: boolean;
  at: string;
  reviewed: number;
  remaining: number;
  filed: CleanReportItem[];
  tagged: CleanReportItem[];
  waiting: CleanReportItem[];
  needsYou: CleanReportItem[];
  skipped: CleanReportItem[];
};

function cleanItems(value: unknown): CleanReportItem[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    if (!item || typeof item !== "object" || Array.isArray(item)) return [];
    const raw = item as Record<string, unknown>;
    const subject = typeof raw.subject === "string" ? raw.subject : "";
    const title = typeof raw.title === "string" ? raw.title : "";
    const from = typeof raw.from === "string" ? raw.from : "";
    const text = (subject || title).trim();
    if (!text) return [];
    return [
      {
        thread:
          typeof raw.thread === "string" && /^[a-f0-9]{1,64}$/.test(raw.thread)
            ? raw.thread
            : undefined,
        undone: raw.undone === true || undefined,
        undoPending: raw.undoPending === true || undefined,
        undoError:
          typeof raw.undoError === "string"
            ? raw.undoError.slice(0, 200)
            : undefined,
        subject: text.slice(0, 200),
        from: from.slice(0, 200),
        folder:
          typeof raw.folder === "string" ? raw.folder.slice(0, 80) : undefined,
        tag: typeof raw.tag === "string" ? raw.tag.slice(0, 80) : undefined,
        waitingOn:
          typeof raw.waitingOn === "string"
            ? raw.waitingOn.slice(0, 200)
            : undefined,
        nextAction:
          typeof raw.nextAction === "string"
            ? raw.nextAction.slice(0, 200)
            : undefined,
        reason:
          typeof raw.reason === "string" ? raw.reason.slice(0, 200) : undefined,
      },
    ];
  });
}

export function mailboxCleanReport(value: unknown): CleanReport | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return cleanReport((value as { clean?: unknown }).clean);
}

/** A clean job's own report (DonnaJob.result), the same shape the worker writes. */
export function cleanReport(raw: unknown): CleanReport | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const c = raw as Record<string, unknown>;
  const at = typeof c.at === "string" ? c.at : "";
  const reviewed =
    typeof c.reviewed === "number" && Number.isFinite(c.reviewed)
      ? Math.max(0, Math.trunc(c.reviewed))
      : 0;
  const remaining =
    typeof c.remaining === "number" && Number.isFinite(c.remaining)
      ? Math.max(0, Math.trunc(c.remaining))
      : 0;
  if (!at && !reviewed && !remaining && !Array.isArray(c.filed)) return null;
  return {
    preview: c.preview === true,
    cancelled: c.cancelled === true,
    at,
    reviewed,
    remaining,
    filed: cleanItems(c.filed).slice(0, 200),
    tagged: cleanItems(c.tagged).slice(0, 200),
    waiting: cleanItems(c.waiting).slice(0, 50),
    needsYou: cleanItems(c.needsYou).slice(0, 50),
    skipped: cleanItems(c.skipped).slice(0, 50),
  };
}

export function coverageLabel(value: unknown): string {
  if (!value || typeof value !== "object" || Array.isArray(value))
    return "Coverage not verified yet.";
  const c = value as Record<string, unknown>;
  if (
    !Array.isArray(c.folders) ||
    !c.folders.length ||
    typeof c.message_locations !== "number"
  )
    return "Coverage not verified yet.";
  const prefix = `${c.folders.length} folders · ${c.message_locations.toLocaleString("en-US")} message locations`;
  const remaining =
    typeof c.remaining_threads === "number" ? c.remaining_threads : null;
  if (remaining !== null && remaining > 0)
    return `${prefix} · ${remaining.toLocaleString("en-US")} conversations await review.`;
  if (c.coverage_complete === true && remaining === 0)
    return `${prefix} · All inventoried conversations reviewed. Open work is listed below.`;
  return `${prefix} · Coverage is incomplete.`;
}

export function deferredRetryNote(value: unknown): string | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const n = Number((value as { deferred_threads?: unknown }).deferred_threads);
  if (!Number.isFinite(n) || n <= 0) return null;
  const count = Math.trunc(n);
  return count === 1
    ? "1 conversation will be tried again."
    : `${count.toLocaleString("en-US")} conversations will be tried again.`;
}

export function activityCounts(
  rows: {
    kind: string;
    messageKey: string | null;
    requestId?: string | null;
    eventKey: string;
  }[],
) {
  const groups = new Map<string, Set<string>>();
  for (const row of rows) {
    const set = groups.get(row.kind) ?? new Set<string>();
    // Message categories count unique messages; task categories count requests.
    const key = [
      "request-opened",
      "completed",
      "answered",
      "reopened",
    ].includes(row.kind)
      ? (row.requestId ?? row.eventKey)
      : (row.messageKey ?? row.eventKey);
    set.add(key);
    groups.set(row.kind, set);
  }
  return Object.fromEntries(
    Object.keys(ACTIVITY_LABELS).map((key) => [
      key,
      groups.get(key)?.size ?? 0,
    ]),
  );
}

export type DonnaSettings = {
  /** Model reviews Donna may use per UTC day. */
  dailyReviews: number;
  /** Of those, the most that background history reading may use. */
  historyReviews: number;
  /** Background reading of older mail on or off. Inbox cleans always run. */
  history: boolean;
  /** Inbox zero: everything Donna has read leaves Inbox (rest to Archive). */
  /** Steps (Tom, 2026-11-26): Donna only does a step Tom starts; nothing runs on its own. */
  steps: boolean;
};

export const DONNA_SETTING_DEFAULTS: DonnaSettings = {
  dailyReviews: 500,
  historyReviews: 60,
  history: true,
  steps: true,
};

function boundedInt(value: unknown, fallback: number) {
  return typeof value === "number" && Number.isFinite(value)
    ? Math.max(0, Math.min(2000, Math.trunc(value)))
    : fallback;
}

export function donnaSettings(raw: unknown): DonnaSettings {
  const s =
    raw && typeof raw === "object" && !Array.isArray(raw)
      ? (raw as Record<string, unknown>)
      : {};
  return {
    dailyReviews: boundedInt(
      s.dailyReviews,
      DONNA_SETTING_DEFAULTS.dailyReviews,
    ),
    historyReviews: boundedInt(
      s.historyReviews,
      DONNA_SETTING_DEFAULTS.historyReviews,
    ),
    history: typeof s.history === "boolean" ? s.history : true,
    steps: typeof s.steps === "boolean" ? s.steps : true,
  };
}

export type WorkerStats = {
  day: string;
  reviews: number;
  history: number;
  at: string;
};

export function workerStats(coverage: unknown): WorkerStats | null {
  const raw =
    coverage && typeof coverage === "object" && !Array.isArray(coverage)
      ? (coverage as { worker?: unknown }).worker
      : null;
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const w = raw as Record<string, unknown>;
  if (typeof w.day !== "string") return null;
  return {
    day: w.day,
    reviews: boundedInt(w.reviews, 0),
    history: boundedInt(w.history, 0),
    at: typeof w.at === "string" ? w.at : "",
  };
}

const JOB_LABELS: Record<string, string> = {
  clean: "Cleaning inbox",
  undo: "Moving mail back to Inbox",
  reconcile: "Checking the mailbox",
  backlog: "Reading older mail",
  incoming: "Reading new mail",
};

export type DonnaNow = {
  state: "working" | "idle" | "paused" | "offline" | "limit";
  headline: string;
  detail: string;
};

/** One plain sentence about what Donna is doing right now. */
export function donnaNow(input: {
  paused: boolean;
  heartbeatAt: Date | null;
  activeKind: string | null;
  progress: CleanBarStatus | null;
  settings: DonnaSettings;
  stats: WorkerStats | null;
  now?: Date;
}): DonnaNow {
  const now = input.now ?? new Date();
  if (input.paused)
    return {
      state: "paused",
      headline: "Donna is paused",
      detail:
        "She is not reading or filing anything. Resume to start her again.",
    };
  if (
    !input.heartbeatAt ||
    now.getTime() - input.heartbeatAt.getTime() > 90_000
  )
    return {
      state: "offline",
      headline: "Donna is not running",
      detail: input.heartbeatAt
        ? "The worker on Ripley has stopped checking in. Nothing is being read or filed."
        : "The worker on Ripley has never checked in.",
    };
  const today = now.toISOString().slice(0, 10);
  const used = input.stats?.day === today ? input.stats.reviews : 0;
  if (used >= input.settings.dailyReviews)
    return {
      state: "limit",
      headline: "Donna reached today’s review limit",
      detail: `She used ${used} of ${input.settings.dailyReviews} reviews. She starts again at 6 pm Central, or raise the limit below.`,
    };
  if (input.activeKind) {
    const label = JOB_LABELS[input.activeKind] ?? "Working";
    const p = input.activeKind === "clean" ? input.progress : null;
    return {
      state: "working",
      headline: `Donna is ${label.charAt(0).toLowerCase()}${label.slice(1)}`,
      detail: p
        ? [p.current, p.countLabel, p.etaLabel].filter(Boolean).join(" · ")
        : input.activeKind === "undo"
          ? "Putting back the mail you undid."
          : "Reading only; nothing is moved in this step.",
    };
  }
  if (input.settings.steps)
    return {
      state: "idle",
      headline: "Donna is ready",
      detail: "She does nothing until you start a step.",
    };
  return {
    state: "idle",
    headline: "Donna is listening for new mail",
    detail: "New Inbox mail is read and filed within a minute or two.",
  };
}
