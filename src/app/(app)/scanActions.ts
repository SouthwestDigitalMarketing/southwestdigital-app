"use server";

import { cookies } from "next/headers";
import { PRIVACY_COOKIE, privacyOn } from "@/lib/privacy";
import { prisma } from "@/lib/prisma";
import { requireStaffBrandOrThrow } from "@/lib/brands/staff";
import { formatUpdatedAgo, scanRunStaleness, type ScanChange } from "@/lib/scan/scan";
import { initialSources, type ScanSourceState } from "@/lib/scan/sources";
import { answerQuestion, undoQuestion, type QuestionOption } from "@/lib/scan/questions";

export type ScanQuestionView = {
  id: string;
  kind: string;
  what: string;
  options: QuestionOption[];
  answered: boolean;
  answerKey: string | null;
};

export type ScanStatus = {
  running: boolean;
  /** A scan was asked for but no poller picked it up (or the poller died).
   * The sheet explains it; tapping Scan starts a fresh one. */
  stuck: boolean;
  updatedAgo: string;
  minutesSinceUpdate: number | null;
  changes: ScanChange[];
  sources: ScanSourceState[];
  questions: ScanQuestionView[];
  recentlyAnswered: { id: string; what: string; answerKey: string | null; answerLabel: string | null }[];
  scoreboard: { askedWeek: number; answeredWeek: number; open: number };
  autoApplied: string[];
  intakeHolds?: { key: string; number: string; reviewAfter: string; due: boolean; error: string | null }[];
  reviewActions?: { sourceId: string; action: string; verification: string }[];
  reviewPending?: { sourceId: string; reason: string; owner: string; nextAction: string }[];
};

function readSources(raw: unknown): ScanSourceState[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter(
    (row): row is ScanSourceState =>
      !!row && typeof row === "object" && typeof (row as { source?: unknown }).source === "string",
  );
}

/** Tom presses Scan: record a requested run unless one is already waiting or running.
 * A stale run (no poller picked it up, or the poller died) is marked errored
 * so one dead scan can never pin the header spinner forever. */
export async function requestScan(): Promise<{ runId: string; alreadyRunning: boolean }> {
  const { session } = await requireStaffBrandOrThrow();
  const active = await prisma.scanRun.findFirst({
    where: { status: { in: ["requested", "running"] } },
    orderBy: { requestedAt: "desc" },
  });
  if (active && scanRunStaleness(active) === "stale") {
    await prisma.scanRun.update({
      where: { id: active.id },
      data: { status: "error", error: "Superseded: no poller picked this run up in time." },
    });
  } else if (active) {
    return { runId: active.id, alreadyRunning: true };
  }
  const run = await prisma.scanRun.create({
    data: {
      status: "requested",
      requestedBy: session.user.id ?? session.user.email ?? "staff",
      sources: initialSources(),
    },
  });
  return { runId: run.id, alreadyRunning: false };
}

/** Header status: whether a scan is in flight, when the last one landed, what
 * changed, per-source live progress, and tap-answer questions. */
export async function getScanStatus(): Promise<ScanStatus> {
  await requireStaffBrandOrThrow();
  const [active, lastDone] = await Promise.all([
    prisma.scanRun.findFirst({
      where: { status: { in: ["requested", "running"] } },
      orderBy: { requestedAt: "desc" },
    }),
    prisma.scanRun.findFirst({ where: { status: "done" }, orderBy: { finishedAt: "desc" } }),
  ]);
  const shown = active ?? lastDone;
  const changes = Array.isArray(lastDone?.changes) ? (lastDone.changes as ScanChange[]) : [];
  const questions = await prisma.scanQuestion.findMany({
    where: { status: "open" },
    orderBy: [{ severity: "desc" }, { createdAt: "asc" }],
    take: 5,
    select: { id: true, kind: true, what: true, options: true },
  });
  const recentlyAnswered = await prisma.scanQuestion.findMany({
    where: { status: "answered", answeredAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) } },
    orderBy: { answeredAt: "desc" },
    select: { id: true, what: true, answerKey: true, options: true },
  });
  const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const [askedWeek, answeredWeek, open] = await Promise.all([
    prisma.scanQuestion.count({ where: { createdAt: { gte: weekAgo } } }),
    prisma.scanQuestion.count({ where: { status: "answered", answeredAt: { gte: weekAgo } } }),
    prisma.scanQuestion.count({ where: { status: "open" } }),
  ]);
  const summary = (lastDone?.summary ?? {}) as { autoApplied?: unknown; sources?: { sourceReviews?: unknown } };
  const reports = summary.sources?.sourceReviews;
  const reviews = reports && typeof reports === "object" && !Array.isArray(reports)
    ? Object.values(reports as Record<string, unknown>).filter(
        (value): value is Record<string, unknown> => !!value && typeof value === "object" && !Array.isArray(value),
      )
    : [];
  const hidePrivateDetails = privacyOn((await cookies()).get(PRIVACY_COOKIE)?.value);
  const intakeHolds = reviews.flatMap((review) => Array.isArray(review.holds) ? review.holds : [])
    .filter((hold): hold is { key: string; number: string; review_after: string; error?: string } =>
      !!hold && typeof hold.key === "string" && typeof hold.number === "string" && typeof hold.review_after === "string",
    ).map((hold) => ({ key: hold.key, number: hidePrivateDetails ? "Caller" : hold.number, reviewAfter: hold.review_after, due: new Date(hold.review_after).getTime() <= Date.now(), error: hold.error ?? null }));
  const reviewActions = reviews.flatMap((review) => Array.isArray(review.actions) ? review.actions : [])
    .filter((action): action is { source_id: string; action: string; verification: string } =>
      !!action && typeof action.source_id === "string" && typeof action.action === "string" && typeof action.verification === "string",
    ).map((action) => ({ sourceId: action.source_id, action: hidePrivateDetails ? "Quo review action verified" : action.action, verification: action.verification }));
  const reviewPending = reviews.flatMap((review) => Array.isArray(review.pending) ? review.pending : [])
    .filter((item): item is { source_id: string; reason: string; owner: string; next_action: string } =>
      !!item && typeof item.source_id === "string" && typeof item.reason === "string"
      && typeof item.owner === "string" && typeof item.next_action === "string",
    ).map((item) => ({
      sourceId: item.source_id,
      reason: hidePrivateDetails ? "Conversation review needs attention" : item.reason,
      owner: item.owner,
      nextAction: hidePrivateDetails ? "Turn privacy off to see the details" : item.next_action,
    }));
  return {
    running: active !== null,
    stuck: active !== null && scanRunStaleness(active) === "stale",
    minutesSinceUpdate: lastDone?.finishedAt
      ? Math.max(0, Math.floor((Date.now() - lastDone.finishedAt.getTime()) / 60_000))
      : null,
    updatedAgo: formatUpdatedAgo(lastDone?.finishedAt ?? null),
    changes,
    intakeHolds,
    reviewActions,
    reviewPending,
    sources: readSources(shown?.sources),
    questions: questions.map((row) => ({
      id: row.id,
      kind: row.kind,
      what: row.what,
      options: (Array.isArray(row.options) ? row.options : []) as QuestionOption[],
      answered: false,
      answerKey: null,
    })),
    recentlyAnswered: recentlyAnswered.map((row) => ({
      id: row.id,
      what: row.what,
      answerKey: row.answerKey,
      answerLabel: (Array.isArray(row.options) ? row.options as QuestionOption[] : [])
        .find((option) => option.key === row.answerKey)?.label ?? row.answerKey,
    })),
    scoreboard: { askedWeek, answeredWeek, open },
    autoApplied: Array.isArray(summary.autoApplied) ? (summary.autoApplied as string[]) : [],
  };
}

/** One tap answer: applies it, saves the rule, closes the question. */
export async function answerScanQuestion(questionId: string, optionKey: string): Promise<{ message: string }> {
  const { session } = await requireStaffBrandOrThrow();
  const actorUserId = session.user.id ?? session.user.email ?? "staff";
  const question = await prisma.scanQuestion.findUnique({ where: { id: questionId }, select: { brandId: true } });
  if (!question) throw new Error("Question not found.");
  return answerQuestion(prisma, actorUserId, questionId, optionKey);
}

/** Take back the last answer while it is still the latest word. */
export async function undoScanQuestion(questionId: string): Promise<{ message: string }> {
  const { session } = await requireStaffBrandOrThrow();
  const actorUserId = session.user.id ?? session.user.email ?? "staff";
  return undoQuestion(prisma, actorUserId, questionId);
}
