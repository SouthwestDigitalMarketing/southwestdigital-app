import "server-only";

import { prisma } from "@/lib/prisma";
import { PipeBrandError, resolveBrand } from "./contacts";

/**
 * Front Desk tasks synced with the `pipe` terminal tool.
 *
 * A task IS its changing state, so the upsert rewrites every working field
 * each time, matched by pipe's task number (pipeId), which never changes.
 * pipe owns the stage rule (tags drive it: archived/completed > big3 >
 * blocked > waiting > todo) and the midnight big-three rollover; SWapp
 * stores what it is sent and does not recompute it.
 *
 * Where a task lives: the brand it is for, the Personal brand for personal
 * tasks, and the Lochside LLC brand for n/a. taskBrand keeps the choice
 * as made. A task that changes brand is moved, not duplicated.
 */

export const PIPE_TASK_STAGES = ["todo", "waiting", "blocked", "big3", "archived"] as const;
export type PipeTaskStage = (typeof PIPE_TASK_STAGES)[number];

export const PIPE_PERSONAL_BRAND = "personal";
export const PIPE_NA_BRAND = "n/a";
export const PIPE_LOCHSIDE_BRAND = "lochside-llc";

/** The SWapp brand slug that holds a task for the given task brand. */
export function homeBrandSlug(taskBrand: string): string {
  return taskBrand === PIPE_NA_BRAND ? PIPE_LOCHSIDE_BRAND : taskBrand;
}

export type PipeTaskOwner = { id: string; name: string | null; kind: string | null };
export type PipeTaskNoteInput = { id: string; body: string; at: Date };

export type ParsedPipeTask = {
  pipeId: string;
  title: string;
  instructions: string | null;
  stage: PipeTaskStage;
  brand: string;
  owner: PipeTaskOwner | null;
  nextDue: string | null;
  big3Rank: number | null;
  big3On: string | null;
  closedAt: Date | null;
  tags: string[];
  notes: PipeTaskNoteInput[];
};

export type PipeTaskDelete = { deleted: true; pipeId: string | null; id: string | null };

export type PipeTask = {
  id: string;
  pipeId: string;
  title: string;
  instructions: string | null;
  stage: string;
  brand: string;
  homeBrand: string;
  owner: PipeTaskOwner | null;
  nextDue: string | null;
  big3Rank: number | null;
  big3On: string | null;
  closedAt: string | null;
  tags: string[];
  notes: { id: string; body: string; at: string }[];
  updatedAt: string;
};

function clean(value: unknown, max: number): string | null {
  if (typeof value !== "string") return null;
  const text = value.trim();
  return text ? text.slice(0, max) : null;
}

function pick(raw: Record<string, unknown>, ...names: string[]): unknown {
  for (const name of names) if (raw[name] !== undefined) return raw[name];
  return undefined;
}

function cleanDate(value: unknown, field: string): Date | null {
  if (value === null || value === undefined || value === "") return null;
  const date = new Date(String(value));
  if (Number.isNaN(date.getTime())) throw new RangeError(`${field} is not a date`);
  return date;
}

export function parsePipeTaskInput(body: unknown): ParsedPipeTask | PipeTaskDelete {
  const raw = (body && typeof body === "object" ? body : {}) as Record<string, unknown>;
  const pipeId = clean(pick(raw, "pipeId", "pipe_id"), 32);
  if (raw.deleted === true) {
    const id = clean(raw.id, 64);
    if (!pipeId && !id) throw new RangeError("pipe_id or id is required");
    return { deleted: true, pipeId, id };
  }
  if (!pipeId) throw new RangeError("pipe_id is required");
  const title = clean(raw.title, 300);
  if (!title) throw new RangeError("title is required");
  const stage = (clean(raw.stage, 32) ?? "todo").toLowerCase();
  if (!(PIPE_TASK_STAGES as readonly string[]).includes(stage)) {
    throw new RangeError(`stage must be one of: ${PIPE_TASK_STAGES.join(", ")}`);
  }
  const brand = (clean(raw.brand, 80) ?? PIPE_PERSONAL_BRAND).toLowerCase();
  const ownerRaw = raw.owner && typeof raw.owner === "object" ? (raw.owner as Record<string, unknown>) : null;
  const ownerId = ownerRaw ? clean(ownerRaw.id, 64) : null;
  const rank = raw.big3_rank ?? raw.big3Rank;
  if (rank !== undefined && rank !== null && !Number.isInteger(rank)) {
    throw new RangeError("big3_rank must be a whole number");
  }
  const tagsRaw = Array.isArray(raw.tags) ? raw.tags : [];
  if (tagsRaw.length > 50) throw new RangeError("a task takes at most 50 tags");
  const tags = [...new Set(tagsRaw.map((tag) => clean(tag, 60)).filter((tag): tag is string => !!tag))];
  const notesRaw = Array.isArray(raw.notes) ? raw.notes : [];
  if (notesRaw.length > 500) throw new RangeError("a task takes at most 500 notes");
  const notes = notesRaw.flatMap((entry): PipeTaskNoteInput[] => {
    const note = (entry && typeof entry === "object" ? entry : {}) as Record<string, unknown>;
    const id = clean(note.id, 32);
    const text = typeof note.body === "string" ? note.body.trim().slice(0, 4000) : "";
    if (!id || !text) return [];
    return [{ id, body: text, at: cleanDate(pick(note, "at", "created_at"), "note date") ?? new Date() }];
  });
  return {
    pipeId,
    title,
    instructions: clean(raw.instructions, 4000),
    stage: stage as PipeTaskStage,
    brand,
    owner: ownerId
      ? { id: ownerId, name: clean(ownerRaw?.name, 120), kind: clean(ownerRaw?.kind, 16) }
      : null,
    nextDue: clean(pick(raw, "next_due", "nextDue"), 32),
    big3Rank: (rank as number | null | undefined) ?? null,
    big3On: clean(pick(raw, "big3_on", "big3On"), 32),
    closedAt: cleanDate(pick(raw, "closed_at", "closedAt"), "closed_at"),
    tags,
    notes,
  };
}

type Row = {
  id: string;
  pipeId: string;
  title: string;
  instructions: string | null;
  stage: string;
  taskBrand: string;
  ownerKey: string | null;
  ownerName: string | null;
  ownerKind: string | null;
  nextDue: string | null;
  big3Rank: number | null;
  big3On: string | null;
  closedAt: Date | null;
  updatedAt: Date;
  brand: { slug: string };
  tags: { label: string }[];
  notes: { pipeNoteId: string; body: string; notedAt: Date }[];
};

const include = {
  brand: { select: { slug: true } },
  tags: { select: { label: true }, orderBy: { label: "asc" as const } },
  notes: { select: { pipeNoteId: true, body: true, notedAt: true }, orderBy: { notedAt: "desc" as const } },
};

function present(row: Row): PipeTask {
  return {
    id: row.id,
    pipeId: row.pipeId,
    title: row.title,
    instructions: row.instructions,
    stage: row.stage,
    brand: row.taskBrand,
    homeBrand: row.brand.slug,
    owner: row.ownerKey ? { id: row.ownerKey, name: row.ownerName, kind: row.ownerKind } : null,
    nextDue: row.nextDue,
    big3Rank: row.big3Rank,
    big3On: row.big3On,
    closedAt: row.closedAt?.toISOString() ?? null,
    tags: row.tags.map((tag) => tag.label),
    notes: row.notes.map((note) => ({ id: note.pipeNoteId, body: note.body, at: note.notedAt.toISOString() })),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export type PipeTaskUpsert = { created: boolean; task: PipeTask };

/**
 * Create the task on first sight, then rewrite its working fields on every
 * push, replacing its tags and adding any notes it does not have yet. A
 * task whose brand changed moves to the new home brand.
 */
export async function upsertPipeTask(args: {
  actorUserId: string;
  input: ParsedPipeTask;
}): Promise<PipeTaskUpsert> {
  const { input } = args;
  const brand = await resolveBrand(homeBrandSlug(input.brand));
  return prisma.$transaction(async (transaction) => {
    const data = {
      brandId: brand.id,
      title: input.title,
      instructions: input.instructions,
      stage: input.stage,
      taskBrand: input.brand,
      ownerKey: input.owner?.id ?? null,
      ownerName: input.owner?.name ?? null,
      ownerKind: input.owner?.kind ?? null,
      nextDue: input.nextDue,
      big3Rank: input.big3Rank,
      big3On: input.big3On,
      closedAt: input.closedAt,
    };
    const existing = await transaction.pipeTask.findUnique({
      where: { pipeId: input.pipeId },
      select: { id: true },
    });
    const task = existing
      ? await transaction.pipeTask.update({ where: { id: existing.id }, data, select: { id: true } })
      : await transaction.pipeTask.create({ data: { ...data, pipeId: input.pipeId }, select: { id: true } });
    await transaction.pipeTaskTag.deleteMany({ where: { taskId: task.id } });
    if (input.tags.length) {
      await transaction.pipeTaskTag.createMany({
        data: input.tags.map((label) => ({ taskId: task.id, label })),
        skipDuplicates: true,
      });
    }
    if (input.notes.length) {
      await transaction.pipeTaskNote.createMany({
        data: input.notes.map((note) => ({
          taskId: task.id,
          pipeNoteId: note.id,
          body: note.body,
          notedAt: note.at,
        })),
        skipDuplicates: true,
      });
    }
    const row = await transaction.pipeTask.findUniqueOrThrow({ where: { id: task.id }, include });
    return { created: !existing, task: present(row as Row) };
  });
}

/** Remove a task by pipe number or SWapp id. Removing one that is gone is fine. */
export async function deletePipeTask(args: {
  input: PipeTaskDelete;
}): Promise<{ deleted: boolean }> {
  const { input } = args;
  const where = input.pipeId ? { pipeId: input.pipeId } : { id: input.id as string };
  const result = await prisma.pipeTask.deleteMany({ where });
  return { deleted: result.count > 0 };
}

export async function listPipeTasks(args: {
  actorUserId: string;
  brand: string;
  stage?: string;
  query?: string;
}): Promise<PipeTask[]> {
  const brand = await resolveBrand(homeBrandSlug(args.brand));
  const q = args.query?.trim();
  const rows = await prisma.pipeTask.findMany({
    where: {
      brandId: brand.id,
      ...(args.stage ? { stage: args.stage } : {}),
      ...(q ? { title: { contains: q, mode: "insensitive" as const } } : {}),
    },
    include,
    orderBy: [{ big3Rank: { sort: "asc", nulls: "last" } }, { createdAt: "asc" }],
    take: 500,
  });
  return rows.map((row) => present(row as Row));
}

export { PipeBrandError };
