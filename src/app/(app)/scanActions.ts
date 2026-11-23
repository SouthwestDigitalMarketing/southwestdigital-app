"use server";

import { prisma } from "@/lib/prisma";
import { requireStaffBrandOrThrow } from "@/lib/brands/staff";
import { formatUpdatedAgo, type ScanChange } from "@/lib/scan/scan";
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
  updatedAgo: string;
  changes: ScanChange[];
  sources: ScanSourceState[];
  questions: ScanQuestionView[];
  recentlyAnswered: { id: string; what: string; answerKey: string | null }[];
  scoreboard: { askedWeek: number; answeredWeek: number; open: number };
  autoApplied: string[];
};

function readSources(raw: unknown): ScanSourceState[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter(
    (row): row is ScanSourceState =>
      !!row && typeof row === "object" && typeof (row as { source?: unknown }).source === "string",
  );
}

/** Tom presses Scan: record a requested run unless one is already waiting or running. */
export async function requestScan(): Promise<{ runId: string; alreadyRunning: boolean }> {
  const { session } = await requireStaffBrandOrThrow();
  const active = await prisma.scanRun.findFirst({
    where: { status: { in: ["requested", "running"] } },
    orderBy: { requestedAt: "desc" },
  });
  if (active) return { runId: active.id, alreadyRunning: true };
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
    take: 3,
    select: { id: true, what: true, answerKey: true },
  });
  const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const [askedWeek, answeredWeek, open] = await Promise.all([
    prisma.scanQuestion.count({ where: { createdAt: { gte: weekAgo } } }),
    prisma.scanQuestion.count({ where: { status: "answered", answeredAt: { gte: weekAgo } } }),
    prisma.scanQuestion.count({ where: { status: "open" } }),
  ]);
  const summary = (lastDone?.summary ?? {}) as { autoApplied?: unknown };
  return {
    running: active !== null,
    updatedAgo: formatUpdatedAgo(lastDone?.finishedAt ?? null),
    changes: changes.slice(0, 10),
    sources: readSources(shown?.sources),
    questions: questions.map((row) => ({
      id: row.id,
      kind: row.kind,
      what: row.what,
      options: (Array.isArray(row.options) ? row.options : []) as QuestionOption[],
      answered: false,
      answerKey: null,
    })),
    recentlyAnswered: recentlyAnswered.map((row) => ({ id: row.id, what: row.what, answerKey: row.answerKey })),
    scoreboard: { askedWeek, answeredWeek, open },
    autoApplied: Array.isArray(summary.autoApplied) ? (summary.autoApplied as string[]).slice(0, 6) : [],
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
