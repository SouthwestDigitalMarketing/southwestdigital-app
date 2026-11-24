import type { Prisma, PrismaClient } from "@prisma/client";

/**
 * Scanner reviews (Tom 2026-11-24): the spam and newsletter reviews that used
 * to run in the terminal (`scan review`). Ripley's poller pushes what waits,
 * Tom answers on /scanner, the poller runs mailroom-app's commands and reports
 * back. Confirmed spam stays in Spam: nothing here deletes mail for good.
 */

export const REVIEW_KINDS = ["spam", "newsletter"] as const;
export type ReviewKind = (typeof REVIEW_KINDS)[number];
export const UNDO_REVIEW = "newsletter-undo";

export type SpamRow = {
  number: number;
  date: string | null;
  from: string;
  subject: string;
  why: string;
  verdict: string;
};

export type NewsletterRow = {
  addr: string;
  name: string | null;
  count: number;
  date: string | null;
  subjects: string[];
  /** Why the tool suggests keeping it (payment/receipt mail), or null. */
  suggest: string | null;
  /** On the never-block list (Intuit, Zoho ...). */
  protected: boolean;
  /** A person replying (Re:/Fw:), never cleared in bulk. */
  reply: boolean;
};

export type ReviewItemInput = { itemKey: string; data: SpamRow | NewsletterRow };

const MAX_ROWS = 500;

type Db = Pick<PrismaClient, "scanReviewItem">;

export function isReviewKind(value: unknown): value is ReviewKind {
  return typeof value === "string" && (REVIEW_KINDS as readonly string[]).includes(value);
}

function text(value: unknown, max: number): string | null {
  if (typeof value !== "string") return null;
  const clean = value.replace(/\s+/g, " ").trim();
  return clean ? clean.slice(0, max) : null;
}

function spamRow(raw: Record<string, unknown>): ReviewItemInput | null {
  const number = raw.number;
  if (typeof number !== "number" || !Number.isSafeInteger(number) || number < 0) return null;
  const from = text(raw.from, 200);
  if (!from) return null;
  return {
    itemKey: String(number),
    data: {
      number,
      date: text(raw.date, 80),
      from,
      subject: text(raw.subject, 300) ?? "(no subject)",
      why: text(raw.why, 300) ?? "",
      verdict: text(raw.verdict, 20) ?? "block",
    },
  };
}

function newsletterRow(raw: Record<string, unknown>): ReviewItemInput | null {
  const addr = text(raw.addr, 200)?.toLowerCase();
  if (!addr || !addr.includes("@") || addr.includes(",")) return null;
  const count = raw.count;
  if (typeof count !== "number" || !Number.isSafeInteger(count) || count < 0) return null;
  const subjects = Array.isArray(raw.subjects)
    ? raw.subjects.map((s) => text(s, 200)).filter((s): s is string => !!s).slice(0, 3)
    : [];
  return {
    itemKey: addr,
    data: {
      addr,
      name: text(raw.name, 120),
      count,
      date: text(raw.date, 80),
      subjects,
      suggest: text(raw.suggest, 200),
      protected: raw.protected === true,
      reply: raw.reply === true,
    },
  };
}

/** Validate one pushed list. Null when it is not a list (the poller failed to
 * read it): then nothing may be marked gone. Bad rows are dropped. */
export function parseReviewList(review: ReviewKind, raw: unknown): ReviewItemInput[] | null {
  if (!Array.isArray(raw)) return null;
  const parse = review === "spam" ? spamRow : newsletterRow;
  const seen = new Set<string>();
  const items: ReviewItemInput[] = [];
  for (const row of raw.slice(0, MAX_ROWS)) {
    if (!row || typeof row !== "object" || Array.isArray(row)) continue;
    const item = parse(row as Record<string, unknown>);
    if (!item || seen.has(item.itemKey)) continue;
    seen.add(item.itemKey);
    items.push(item);
  }
  return items;
}

/** Make the stored rows match what waits on ripley right now.
 * - new rows are created pending;
 * - rows still listed after they were applied, failed or gone come back to
 *   pending (an undo, or the action did not take);
 * - pending rows no longer listed are gone (answered in the terminal);
 * - answered rows are left for the poller to apply. */
export async function syncReviewList(
  db: Db,
  review: ReviewKind,
  items: ReviewItemInput[],
  now = new Date(),
): Promise<{ created: number; reopened: number; gone: number }> {
  const existing = await db.scanReviewItem.findMany({
    where: { review },
    select: { id: true, itemKey: true, status: true },
  });
  const byKey = new Map(existing.map((row) => [row.itemKey, row]));
  const listed = new Set(items.map((item) => item.itemKey));
  let created = 0;
  let reopened = 0;
  const fresh: Prisma.ScanReviewItemCreateManyInput[] = [];
  for (const item of items) {
    const row = byKey.get(item.itemKey);
    const data = item.data as unknown as Prisma.InputJsonValue;
    if (!row) {
      fresh.push({ review, itemKey: item.itemKey, data, lastSeenAt: now });
      continue;
    }
    if (row.status === "applied" || row.status === "failed" || row.status === "gone") {
      await db.scanReviewItem.update({
        where: { id: row.id },
        data: { data, status: "pending", answer: null, answeredBy: null, answeredAt: null, lastSeenAt: now },
      });
      reopened += 1;
    } else {
      await db.scanReviewItem.update({ where: { id: row.id }, data: { data, lastSeenAt: now } });
    }
  }
  if (fresh.length > 0) created = (await db.scanReviewItem.createMany({ data: fresh, skipDuplicates: true })).count;
  const goneIds = existing.filter((row) => row.status === "pending" && !listed.has(row.itemKey)).map((row) => row.id);
  const gone = goneIds.length > 0
    ? (await db.scanReviewItem.updateMany({
        where: { id: { in: goneIds }, status: "pending" },
        data: { status: "gone", result: "No longer waiting (handled elsewhere)." },
      })).count
    : 0;
  return { created, reopened, gone };
}

/** Tom's answers on one review screen. `shownIds` are the rows he saw; only
 * those still pending are answered. Every shown row gets the default answer
 * unless it is in `flipped`. */
export function answersFor(
  review: ReviewKind,
  shown: { id: string; defaultAnswer: string }[],
  flipped: Set<string>,
): { id: string; answer: string }[] {
  const other = (answer: string) =>
    review === "spam" ? (answer === "spam" ? "not-spam" : "spam") : answer === "keep" ? "clear" : "keep";
  return shown.map((row) => ({ id: row.id, answer: flipped.has(row.id) ? other(row.defaultAnswer) : row.defaultAnswer }));
}

/** Newsletter rows the tool would keep: payment/receipt mail, the never-block
 * list, and people replying. Everything else starts as "clear". */
export function newsletterDefault(row: NewsletterRow): "keep" | "clear" {
  return row.suggest || row.protected || row.reply ? "keep" : "clear";
}

export const SPAM_ANSWERS = new Set(["spam", "not-spam"]);
export const NEWSLETTER_ANSWERS = new Set(["keep", "clear"]);

/** Save answers: pending rows only, so a row handled meanwhile is never re-applied. */
export async function saveAnswers(
  db: Db,
  review: ReviewKind,
  answers: { id: string; answer: string }[],
  actor: string,
  now = new Date(),
): Promise<number> {
  const allowed = review === "spam" ? SPAM_ANSWERS : NEWSLETTER_ANSWERS;
  let saved = 0;
  for (const answer of new Set(answers.map((a) => a.answer))) {
    if (!allowed.has(answer)) throw new Error("Unknown answer.");
    const ids = answers.filter((a) => a.answer === answer).map((a) => a.id);
    const result = await db.scanReviewItem.updateMany({
      where: { id: { in: ids }, review, status: "pending" },
      data: { status: "answered", answer, answeredBy: actor, answeredAt: now },
    });
    saved += result.count;
  }
  return saved;
}

export type AppliedResult = { id: string; ok: boolean; result: string | null };

export function parseApplied(raw: unknown): AppliedResult[] | null {
  if (!Array.isArray(raw)) return null;
  const out: AppliedResult[] = [];
  for (const row of raw.slice(0, MAX_ROWS)) {
    if (!row || typeof row !== "object") return null;
    const r = row as Record<string, unknown>;
    if (typeof r.id !== "string" || !r.id || typeof r.ok !== "boolean") return null;
    out.push({ id: r.id, ok: r.ok, result: text(r.result, 400) });
  }
  return out;
}

export type ReviewCounts = {
  pending: number;
  /** Answered, waiting for ripley to apply. */
  answered: number;
  /** Answers ripley could not apply in the last 7 days. */
  failed: number;
  lastSeenAt: Date | null;
};

/** Per-review counts for the Scanner page's "Needs you" lines. */
export async function loadReviewCounts(db: Db): Promise<Record<ReviewKind, ReviewCounts>> {
  const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const out = {} as Record<ReviewKind, ReviewCounts>;
  for (const review of REVIEW_KINDS) {
    const [pending, answered, failed, last] = await Promise.all([
      db.scanReviewItem.count({ where: { review, status: "pending" } }),
      db.scanReviewItem.count({ where: { review, status: "answered" } }),
      db.scanReviewItem.count({ where: { review, status: "failed", appliedAt: { gte: weekAgo } } }),
      db.scanReviewItem.findFirst({ where: { review }, orderBy: { lastSeenAt: "desc" }, select: { lastSeenAt: true } }),
    ]);
    out[review] = { pending, answered, failed, lastSeenAt: last?.lastSeenAt ?? null };
  }
  return out;
}

export type ReviewItemView = { id: string; data: SpamRow | NewsletterRow };

export async function loadPendingItems(db: Db, review: ReviewKind): Promise<ReviewItemView[]> {
  const rows = await db.scanReviewItem.findMany({
    where: { review, status: "pending" },
    select: { id: true, data: true },
    take: MAX_ROWS,
  });
  const items = rows.map((row) => ({ id: row.id, data: row.data as unknown as SpamRow | NewsletterRow }));
  if (review === "spam") {
    return items.sort((a, b) => (b.data as SpamRow).number - (a.data as SpamRow).number);
  }
  return items.sort((a, b) => {
    const x = a.data as NewsletterRow;
    const y = b.data as NewsletterRow;
    return y.count - x.count || x.addr.localeCompare(y.addr);
  });
}

/** What ripley did with recent answers (last 24 h), newest first. */
export async function loadRecentResults(db: Db, reviews: string[]) {
  return db.scanReviewItem.findMany({
    where: { review: { in: reviews }, status: { in: ["applied", "failed"] }, appliedAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) } },
    orderBy: { appliedAt: "desc" },
    take: 200,
    select: { id: true, review: true, itemKey: true, status: true, answer: true, result: true, appliedAt: true },
  });
}
