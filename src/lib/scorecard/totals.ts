/**
 * The Scorecard's big numbers (docs/scorecard.md § Big numbers): all-time and
 * monthly totals of transactions our team recorded in clients' QuickBooks
 * books, reports issued, and client messages answered.
 *
 * Transactions and reports are counted on ripley by scripts/scorecard_totals.mjs,
 * which posts one number per metric per month; client records never leave
 * ripley. Messages answered are counted here from ScorecardEvent.
 *
 * ScorecardMonthly is not under row-level security (like ScorecardEvent), so the
 * plain prisma client is used; the brand comes from the posted slug.
 */
import { prisma } from "@/lib/prisma";
import { firmInstant } from "@/lib/operations/schedule";
import { firmDay } from "./queries";

export const TOTAL_METRICS = ["transactions", "reports"] as const;
export type TotalMetric = (typeof TOTAL_METRICS)[number];

const MONTH = /^(\d{4})-(0[1-9]|1[0-2])$/;
/** Generous: about 80 years of months. */
export const MAX_MONTHS = 1000;
const MAX_VALUE = 100_000_000;
const MAX_NOTE_CHARS = 300;

export type ParsedTotals = {
  brand: string;
  metric: TotalMetric;
  months: { month: string; value: number }[];
  note: string | null;
};

const isObject = (value: unknown): value is Record<string, unknown> =>
  !!value && typeof value === "object" && !Array.isArray(value);

/** Validates a totals post. Returns the parsed body or an error message. */
export function parseTotalsBody(body: unknown, now: Date): ParsedTotals | string {
  if (!isObject(body)) return "body must be a JSON object";
  const brand = typeof body.brand === "string" ? body.brand.trim() : "";
  if (!brand) return "brand is required";
  if (!TOTAL_METRICS.includes(body.metric as TotalMetric)) return `metric must be one of ${TOTAL_METRICS.join(", ")}`;
  if (!Array.isArray(body.months)) return "months must be an array";
  if (body.months.length > MAX_MONTHS) return `months has more than ${MAX_MONTHS} entries`;
  const thisMonth = firmDay(now).slice(0, 7);
  const seen = new Set<string>();
  const months: ParsedTotals["months"] = [];
  for (const [index, row] of body.months.entries()) {
    if (!isObject(row)) return `months[${index}] must be an object`;
    const month = typeof row.month === "string" ? row.month : "";
    if (!MONTH.test(month)) return `months[${index}].month must be YYYY-MM`;
    if (month > thisMonth) return `months[${index}].month is in the future`;
    if (seen.has(month)) return `months[${index}].month repeats ${month}`;
    const value = row.value;
    if (typeof value !== "number" || !Number.isInteger(value) || value < 0 || value > MAX_VALUE) {
      return `months[${index}].value must be a whole number from 0 to ${MAX_VALUE}`;
    }
    seen.add(month);
    months.push({ month, value });
  }
  let note: string | null = null;
  if (body.note !== undefined && body.note !== null) {
    if (typeof body.note !== "string") return "note must be a string or null";
    note = body.note.trim().slice(0, MAX_NOTE_CHARS) || null;
  }
  return { brand, metric: body.metric as TotalMetric, months, note };
}

/**
 * Replaces every month of one metric, so a month that drops to nothing (or a
 * correction) never leaves an old row behind. The QuickBooks run also records
 * a "qbo" sync so the Last sync strip shows when it last ran.
 */
export async function replaceTotals(brandId: string, input: ParsedTotals, now: Date) {
  await prisma.$transaction([
    prisma.scorecardMonthly.deleteMany({ where: { brandId, metric: input.metric } }),
    prisma.scorecardMonthly.createMany({
      data: input.months.map(({ month, value }) => ({ brandId, metric: input.metric, month, value })),
    }),
    ...(input.metric === "transactions"
      ? [
          prisma.scorecardSync.upsert({
            where: { brandId_source: { brandId, source: "qbo" } },
            create: { brandId, source: "qbo", lastRunAt: now, coveredTo: now, ok: true, note: input.note },
            update: { lastRunAt: now, coveredTo: now, ok: true, note: input.note },
          }),
        ]
      : []),
  ]);
  return { metric: input.metric, months: input.months.length, total: input.months.reduce((n, m) => n + m.value, 0) };
}

export type TotalFigure = {
  allTime: number;
  thisMonth: number;
  lastMonth: number;
  /** First month with a count, "YYYY-MM", or null when there is none. */
  since: string | null;
  /** Every month from `since` to this month, zeros included, oldest first. */
  months: { month: string; value: number }[];
};

export type ScorecardTotals = {
  transactions: TotalFigure;
  reports: TotalFigure;
  messages: Omit<TotalFigure, "months">;
};

export function previousMonth(month: string): string {
  const [y, m] = month.split("-").map(Number);
  return m === 1 ? `${y - 1}-12` : `${y}-${String(m - 1).padStart(2, "0")}`;
}

function nextMonth(month: string): string {
  const [y, m] = month.split("-").map(Number);
  return m === 12 ? `${y + 1}-01` : `${y}-${String(m + 1).padStart(2, "0")}`;
}

/** Totals for one metric from its monthly rows, as of the firm month `thisMonth`. */
export function totalFigure(rows: { month: string; value: number }[], thisMonth: string): TotalFigure {
  const byMonth = new Map<string, number>();
  for (const row of rows) if (row.month <= thisMonth) byMonth.set(row.month, (byMonth.get(row.month) ?? 0) + row.value);
  const counted = [...byMonth].filter(([, value]) => value > 0).map(([month]) => month).sort();
  const since = counted[0] ?? null;
  const months: TotalFigure["months"] = [];
  if (since) for (let m = since; m <= thisMonth; m = nextMonth(m)) months.push({ month: m, value: byMonth.get(m) ?? 0 });
  return {
    allTime: months.reduce((n, m) => n + m.value, 0),
    thisMonth: byMonth.get(thisMonth) ?? 0,
    lastMonth: byMonth.get(previousMonth(thisMonth)) ?? 0,
    since,
    months,
  };
}

/** The big numbers for a brand, as of `now`. */
export async function getScorecardTotals(brandId: string, now: Date): Promise<ScorecardTotals> {
  const thisMonth = firmDay(now).slice(0, 7);
  const thisStart = firmInstant(`${thisMonth}-01`, 0);
  const lastStart = firmInstant(`${previousMonth(thisMonth)}-01`, 0);
  // Clients only, and answered: a text or email reply, a live call, or a callback.
  const answered = {
    brandId,
    channel: { in: ["text", "call", "email"] },
    contactId: { not: null },
    respondedAt: { not: null, lte: now },
  };
  const [rows, allTime, thisCount, lastCount, first] = await Promise.all([
    prisma.scorecardMonthly.findMany({ where: { brandId }, select: { metric: true, month: true, value: true } }),
    prisma.scorecardEvent.count({ where: answered }),
    prisma.scorecardEvent.count({ where: { ...answered, respondedAt: { gte: thisStart, lte: now } } }),
    prisma.scorecardEvent.count({ where: { ...answered, respondedAt: { gte: lastStart, lt: thisStart } } }),
    prisma.scorecardEvent.findFirst({ where: answered, orderBy: { respondedAt: "asc" }, select: { respondedAt: true } }),
  ]);
  const of = (metric: TotalMetric) => rows.filter((r) => r.metric === metric);
  return {
    transactions: totalFigure(of("transactions"), thisMonth),
    reports: totalFigure(of("reports"), thisMonth),
    messages: {
      allTime,
      thisMonth: thisCount,
      lastMonth: lastCount,
      since: first?.respondedAt ? firmDay(first.respondedAt).slice(0, 7) : null,
    },
  };
}
