/** This week's story, told from SWapp's own numbers. No names, no prices. */
import { z } from "zod";
import type { Prisma } from "@prisma/client";
import { median } from "../scorecard/stats";
import canon from "./canon.json";
import { episodeSchema } from "./studio";

export const storylineSchema = z.object({
  id: z.string().min(1).max(60),
  kind: z.enum([
    "proposal-waiting",
    "client-won",
    "proposals-out",
    "fast-replies",
    "close-week",
    "contract-teaser",
    "custom",
    "climb",
  ]),
  headline: z.string().trim().min(1).max(220),
  metrics: z.array(z.string().trim().min(1).max(240)).min(1).max(5),
  hook: z.string().trim().min(1).max(220),
  confirm: z.string().trim().min(1).max(240),
  serviceLine: z.string().trim().min(1).max(300),
});
/** Plain-count summary of the week for the "none of these" path. */
export function signalMetrics(signals: WeekSignals): string[] {
  const metrics: string[] = [];
  if (signals.proposalsSent > 0) metrics.push(`${plural(signals.proposalsSent, "proposal")} sent this week`);
  if (signals.proposalsViewed > 0) metrics.push(`${plural(signals.proposalsViewed, "proposal")} viewed and awaiting an answer`);
  if (signals.proposalsAccepted > 0) metrics.push(`${plural(signals.proposalsAccepted, "proposal")} signed`);
  if (signals.newClients > 0) metrics.push(plural(signals.newClients, "new client") + " won");
  if (signals.repliesAnswered > 0) metrics.push(plural(signals.repliesAnswered, "message") + " answered");
  if (signals.reportsOut > 0) metrics.push(plural(signals.reportsOut, "report") + " out the door this month");
  if (signals.videosLive > 0) metrics.push(plural(signals.videosLive, "episode") + " went live this week");
  return metrics.slice(0, 5);
}
export type StoredStoryline = z.infer<typeof storylineSchema>;

export const storylineDraftSchema = z.object({
  storyline: storylineSchema,
  episode: episodeSchema,
  source: z.enum(["openai", "guided"]),
  warning: z.string().max(240).optional(),
});
export type StorylineDraft = z.infer<typeof storylineDraftSchema>;

export function parseStorylineDrafts(value: unknown): StorylineDraft[] {
  return z.array(storylineDraftSchema).parse(value);
}

export type WeekSignals = {
  proposalsSent: number;
  /** Viewed but not accepted: still waiting on an answer. */
  proposalsViewed: number;
  proposalsAccepted: number;
  newClients: number;
  repliesAnswered: number;
  replyMedianBusinessSeconds: number | null;
  reportsOut: number;
  transactionsTouched: number;
  videosLive: number;
  latestRevenueUsd: number | null;
  previousRevenueUsd: number | null;
  revenueMonthLabel: string | null;
};

export type StorylineKind = StoredStoryline["kind"];
/** A candidate story. Firm-wide counts only: never a name or a price. */
export type Storyline = StoredStoryline;

function plural(count: number, one: string, many?: string) {
  return `${count} ${count === 1 ? one : (many ?? `${one}s`)}`;
}

function oneDecimal(n: number) {
  return String(Math.round(n * 10) / 10);
}

/** "4 min", "1.5 h": business seconds are never turned into days. */
export function wordsForBusinessSeconds(seconds: number): string {
  const s = Math.max(0, Math.round(seconds));
  if (s < 60) return "under 1 min";
  if (s < 3600) return `${Math.round(s / 60)} min`;
  return `${oneDecimal(s / 3600)} h`;
}

function monthLabel(date: Date): string {
  return date.toLocaleDateString("en-US", { timeZone: "UTC", month: "short", year: "numeric" });
}

function currentMonthKey(now: Date): string {
  return `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}`;
}

/** Counts and firm-wide aggregates only. Never selects a name, price, or body. */
export async function collectWeekSignals(
  tx: Prisma.TransactionClient,
  brandId: string,
  now: Date = new Date(),
): Promise<WeekSignals> {
  const weekAgo = new Date(now.getTime() - 7 * 24 * 3600_000);
  const [proposalsSent, proposalsViewed, proposalsAccepted, newClients, videosLive] =
    await Promise.all([
      tx.quote.count({ where: { brandId, firstSentAt: { gte: weekAgo } } }),
      tx.quote.count({
        where: { brandId, firstViewedAt: { gte: weekAgo }, status: { not: "accepted" } },
      }),
      tx.quote.count({ where: { brandId, status: "accepted", updatedAt: { gte: weekAgo } } }),
      tx.operationsClient.count({ where: { brandId, wonOn: { gte: weekAgo } } }),
      tx.showrunnerVideoStatus.count({
        where: { brandId, url: { not: null }, updatedAt: { gte: weekAgo } },
      }),
    ]);
  const replies = await tx.scorecardEvent.findMany({
    where: { brandId, startedAt: { gte: weekAgo }, respondedAt: { not: null } },
    select: { businessSeconds: true },
  });
  const monthly = await tx.scorecardMonthly.findMany({
    where: { brandId, month: currentMonthKey(now) },
    select: { metric: true, value: true },
  });
  const revenue = await tx.companyRevenueMonth.findMany({
    where: { brandId },
    orderBy: { monthStart: "desc" },
    take: 2,
    select: { grossRevenueUsd: true, monthStart: true },
  });
  const byMetric = new Map(monthly.map((row) => [row.metric, row.value]));
  const replySeconds = replies.flatMap((row) => (row.businessSeconds === null ? [] : [row.businessSeconds]));
  const [latest, previous] = revenue;
  return {
    proposalsSent,
    proposalsViewed,
    proposalsAccepted,
    newClients,
    repliesAnswered: replies.length,
    replyMedianBusinessSeconds: median(replySeconds),
    reportsOut: byMetric.get("reports") ?? 0,
    transactionsTouched: byMetric.get("transactions") ?? 0,
    videosLive,
    latestRevenueUsd: latest ? Number(latest.grossRevenueUsd) : null,
    previousRevenueUsd: previous ? Number(previous.grossRevenueUsd) : null,
    revenueMonthLabel: latest ? monthLabel(latest.monthStart) : null,
  };
}

function replyServiceLine(signals: WeekSignals): string {
  if (signals.replyMedianBusinessSeconds !== null) {
    return `Our firm-wide median reply was ${wordsForBusinessSeconds(signals.replyMedianBusinessSeconds)} of business time.`;
  }
  return `Our week in numbers is above; add 1 firm-wide service number before locking.`;
}

/** Deterministic rules turn the week's numbers into two or three storylines. */
export function buildStorylines(signals: WeekSignals, previousHook: string): Storyline[] {
  const candidates: Storyline[] = [];
  if (signals.proposalsViewed > 0 && signals.proposalsAccepted === 0) {
    candidates.push({
      id: "proposal-waiting",
      kind: "proposal-waiting",
      headline: "A proposal is sitting with a client. Will they sign?",
      metrics: [
        `${plural(signals.proposalsSent, "proposal")} sent this week`,
        `${plural(signals.proposalsViewed, "proposal")} viewed and awaiting an answer`,
      ],
      hook: "Will they sign before next week?",
      confirm: "Confirm whether they signed before filming.",
      serviceLine: replyServiceLine(signals),
    });
  }
  if (signals.proposalsAccepted > 0 || signals.newClients > 0) {
    const wins: string[] = [];
    if (signals.proposalsAccepted > 0) wins.push(plural(signals.proposalsAccepted, "proposal") + " signed");
    if (signals.newClients > 0) wins.push(plural(signals.newClients, "new client") + " won");
    candidates.push({
      id: "client-won",
      kind: "client-won",
      headline: "A new client said yes this week.",
      metrics: [...wins, `${plural(signals.proposalsSent, "proposal")} sent in total`],
      hook: "What does a great first month look like?",
      confirm: "Confirm what the client can share publicly before filming.",
      serviceLine: replyServiceLine(signals),
    });
  }
  if (signals.proposalsSent > 0 && signals.proposalsViewed === 0 && signals.proposalsAccepted === 0) {
    candidates.push({
      id: "proposals-out",
      kind: "proposals-out",
      headline: "New proposals are out. Waiting on answers.",
      metrics: [`${plural(signals.proposalsSent, "proposal")} sent this week`, "None viewed yet"],
      hook: "Who answers first?",
      confirm: "Check for fresh proposal views before filming.",
      serviceLine: replyServiceLine(signals),
    });
  }
  if (signals.repliesAnswered >= 5 && signals.replyMedianBusinessSeconds !== null) {
    candidates.push({
      id: "fast-replies",
      kind: "fast-replies",
      headline: "The phones stayed fast in a busy week.",
      metrics: [
        `${plural(signals.repliesAnswered, "message")} answered`,
        `Median reply ${wordsForBusinessSeconds(signals.replyMedianBusinessSeconds)} of business time`,
      ],
      hook: "Can we stay this fast as the client list grows?",
      confirm: "Confirm the reply number is still firm-wide before filming.",
      serviceLine: replyServiceLine(signals),
    });
  }
  if (signals.reportsOut > 0) {
    const metrics = [`${plural(signals.reportsOut, "report")} out the door this month`];
    if (signals.transactionsTouched > 0) metrics.push(`${signals.transactionsTouched} transactions touched`);
    candidates.push({
      id: "close-week",
      kind: "close-week",
      headline: "Close week: the books kept moving.",
      metrics,
      hook: "Which close taught us the most?",
      confirm: "Confirm the report count covers the whole firm before filming.",
      serviceLine: replyServiceLine(signals),
    });
  }
  const fallbacks: Storyline[] = [
    {
      id: "climb",
      kind: "climb",
      headline: "The climb continues.",
      metrics: climbMetrics(signals, previousHook),
      hook: previousHook || "What moves the number next week?",
      confirm: "Confirm the mountain number before filming.",
      serviceLine: replyServiceLine(signals),
    },
    {
      id: "contract-teaser",
      kind: "contract-teaser",
      headline: "Will they sign? How we do contracts.",
      metrics: ["One standard agreement, same for everyone", "Proposal, signature, and payment in one place"],
      hook: canon.pilot.hook,
      confirm: "Confirm the proposal outcome and use approved pages only.",
      serviceLine: replyServiceLine(signals),
    },
  ];
  const picked = candidates.slice(0, 3);
  for (const fallback of fallbacks) {
    if (picked.length >= 3 || picked.length >= 2) break;
    picked.push(fallback);
  }
  return picked;
}

function climbMetrics(signals: WeekSignals, previousHook: string): string[] {
  const metrics: string[] = [];
  if (signals.latestRevenueUsd !== null) {
    const percent = Math.round((Math.min(10000, Math.max(0, signals.latestRevenueUsd)) / 10000) * 100);
    const label = signals.revenueMonthLabel ? ` in ${signals.revenueMonthLabel}` : "";
    let line = `${percent}% of the climb${label}`;
    if (signals.previousRevenueUsd !== null && signals.previousRevenueUsd !== signals.latestRevenueUsd) {
      line += signals.latestRevenueUsd > signals.previousRevenueUsd ? ", up from last month" : ", down from last month";
    }
    metrics.push(line);
  } else {
    metrics.push("Mountain position not set yet");
  }
  if (signals.videosLive > 0) metrics.push(plural(signals.videosLive, "episode") + " went live this week");
  if (previousHook) metrics.push(`Picking up last week: ${previousHook.slice(0, 180)}`);
  return metrics;
}
