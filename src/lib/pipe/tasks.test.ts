import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  brandFind: vi.fn(),
  taskFind: vi.fn(),
  taskCreate: vi.fn(),
  taskUpdate: vi.fn(),
  taskFindOrThrow: vi.fn(),
  taskFindMany: vi.fn(),
  taskDeleteMany: vi.fn(),
  tagDeleteMany: vi.fn(),
  tagCreateMany: vi.fn(),
  noteCreateMany: vi.fn(),
}));

vi.mock("@/lib/prisma", () => {
  const transaction = {
    pipeTask: {
      findUnique: mocks.taskFind,
      create: mocks.taskCreate,
      update: mocks.taskUpdate,
      findUniqueOrThrow: mocks.taskFindOrThrow,
    },
    pipeTaskTag: { deleteMany: mocks.tagDeleteMany, createMany: mocks.tagCreateMany },
    pipeTaskNote: { createMany: mocks.noteCreateMany },
  };
  return {
    prisma: {
      brand: { findUnique: mocks.brandFind },
      pipeTask: { findMany: mocks.taskFindMany, deleteMany: mocks.taskDeleteMany },
      $transaction: (operation: (t: unknown) => unknown) => operation(transaction),
    },
  };
});

import { PipeBrandError } from "./contacts";
import { deletePipeTask, homeBrandSlug, listPipeTasks, parsePipeTaskInput, upsertPipeTask } from "./tasks";
import type { ParsedPipeTask } from "./tasks";

const row = (over: Record<string, unknown> = {}) => ({
  id: "t1",
  pipeId: "7",
  title: "Fix the gate",
  instructions: null,
  stage: "todo",
  taskBrand: "personal",
  ownerKey: null,
  ownerName: null,
  ownerKind: null,
  nextDue: null,
  big3Rank: null,
  big3On: null,
  closedAt: null,
  updatedAt: new Date("2026-10-22T12:00:00Z"),
  brand: { slug: "personal" },
  tags: [],
  notes: [],
  ...over,
});

beforeEach(() => {
  for (const mock of Object.values(mocks)) mock.mockReset();
  mocks.brandFind.mockImplementation(async ({ where }: { where: { slug: string } }) => ({
    id: `brand-${where.slug}`,
    slug: where.slug,
    status: "ACTIVE",
    deletedAt: null,
  }));
  mocks.taskCreate.mockResolvedValue({ id: "t1" });
  mocks.taskUpdate.mockResolvedValue({ id: "t1" });
  mocks.taskFindOrThrow.mockResolvedValue(row());
});

describe("homeBrandSlug", () => {
  it("keeps a brand as is, and files n/a under Lochside LLC", () => {
    expect(homeBrandSlug("personal")).toBe("personal");
    expect(homeBrandSlug("bookkeeping-conroe")).toBe("bookkeeping-conroe");
    expect(homeBrandSlug("lochside-llc")).toBe("lochside-llc");
    expect(homeBrandSlug("n/a")).toBe("lochside-llc");
  });
});

describe("parsePipeTaskInput", () => {
  it("needs a pipe id and a title, and only known stages", () => {
    expect(() => parsePipeTaskInput({ title: "x" })).toThrow(RangeError);
    expect(() => parsePipeTaskInput({ pipe_id: "7" })).toThrow(/title/);
    expect(() => parsePipeTaskInput({ pipe_id: "7", title: "x", stage: "done" })).toThrow(/stage must be one of/);
  });
  it("reads either casing, defaults the brand to personal, and tidies tags and notes", () => {
    const task = parsePipeTaskInput({
      pipe_id: " 7 ",
      title: " Fix the gate ",
      stage: "BIG3",
      next_due: "2026-10-23",
      big3_rank: 2,
      owner: { id: "agent:donna", name: "Donna", kind: "agent" },
      tags: ["big3", " yard ", "yard", ""],
      notes: [{ id: "n1", body: " Started ", created_at: "2026-10-22T10:00:00Z" }, { id: "n2", body: "" }, { body: "no id" }],
    }) as ParsedPipeTask;
    expect(task).toMatchObject({
      pipeId: "7",
      title: "Fix the gate",
      stage: "big3",
      brand: "personal",
      nextDue: "2026-10-23",
      big3Rank: 2,
      owner: { id: "agent:donna", name: "Donna", kind: "agent" },
      tags: ["big3", "yard"],
    });
    expect(task.notes).toHaveLength(1);
    expect(task.notes[0].body).toBe("Started");
  });
  it("rejects a fractional big-three rank and bad dates", () => {
    expect(() => parsePipeTaskInput({ pipe_id: "7", title: "x", big3_rank: 1.5 })).toThrow(/whole number/);
    expect(() => parsePipeTaskInput({ pipe_id: "7", title: "x", closed_at: "nonsense" })).toThrow(/closed_at/);
  });
  it("reads a delete by pipe id or by SWapp id", () => {
    expect(parsePipeTaskInput({ deleted: true, id: "t1" })).toEqual({ deleted: true, pipeId: null, id: "t1" });
    expect(parsePipeTaskInput({ deleted: true, pipe_id: "7" })).toEqual({ deleted: true, pipeId: "7", id: null });
    expect(() => parsePipeTaskInput({ deleted: true })).toThrow(RangeError);
  });
});

describe("upsertPipeTask", () => {
  const input = (over: Partial<ParsedPipeTask> = {}): ParsedPipeTask => ({
    pipeId: "7",
    title: "Fix the gate",
    instructions: null,
    stage: "todo",
    brand: "personal",
    owner: null,
    nextDue: null,
    big3Rank: null,
    big3On: null,
    closedAt: null,
    tags: ["yard"],
    notes: [{ id: "n1", body: "Started", at: new Date("2026-10-22T10:00:00Z") }],
    ...over,
  });

  it("creates a new task under its home brand, replaces tags, adds notes", async () => {
    mocks.taskFind.mockResolvedValue(null);
    const result = await upsertPipeTask({ actorUserId: "u", input: input() });
    expect(result.created).toBe(true);
    expect(mocks.taskCreate.mock.calls[0][0].data).toMatchObject({ brandId: "brand-personal", pipeId: "7", taskBrand: "personal" });
    expect(mocks.tagDeleteMany).toHaveBeenCalledWith({ where: { taskId: "t1" } });
    expect(mocks.tagCreateMany.mock.calls[0][0].data).toEqual([{ taskId: "t1", label: "yard" }]);
    expect(mocks.noteCreateMany.mock.calls[0][0].data[0]).toMatchObject({ taskId: "t1", pipeNoteId: "n1", body: "Started" });
  });
  it("updates an existing task by pipe id and moves it when the brand changed", async () => {
    mocks.taskFind.mockResolvedValue({ id: "t1" });
    const result = await upsertPipeTask({
      actorUserId: "u",
      input: input({ brand: "bookkeeping-conroe", stage: "blocked", owner: { id: "u9", name: "Zane", kind: "person" } }),
    });
    expect(result.created).toBe(false);
    expect(mocks.taskCreate).not.toHaveBeenCalled();
    expect(mocks.taskUpdate.mock.calls[0][0].data).toMatchObject({
      brandId: "brand-bookkeeping-conroe",
      stage: "blocked",
      ownerKey: "u9",
      ownerName: "Zane",
    });
  });
  it("files n/a under Lochside LLC but remembers the choice", async () => {
    mocks.taskFind.mockResolvedValue(null);
    await upsertPipeTask({ actorUserId: "u", input: input({ brand: "n/a" }) });
    expect(mocks.taskCreate.mock.calls[0][0].data).toMatchObject({ brandId: "brand-lochside-llc", taskBrand: "n/a" });
  });
  it("skips the tag and note writes when there are none", async () => {
    mocks.taskFind.mockResolvedValue(null);
    await upsertPipeTask({ actorUserId: "u", input: input({ tags: [], notes: [] }) });
    expect(mocks.tagDeleteMany).toHaveBeenCalled();
    expect(mocks.tagCreateMany).not.toHaveBeenCalled();
    expect(mocks.noteCreateMany).not.toHaveBeenCalled();
  });
  it("refuses a brand SWapp does not have", async () => {
    mocks.brandFind.mockResolvedValue(null);
    await expect(upsertPipeTask({ actorUserId: "u", input: input({ brand: "nope" }) })).rejects.toBeInstanceOf(PipeBrandError);
    expect(mocks.taskCreate).not.toHaveBeenCalled();
  });
});

describe("deletePipeTask and listPipeTasks", () => {
  it("deletes by pipe id or id, and reports whether anything was there", async () => {
    mocks.taskDeleteMany.mockResolvedValue({ count: 1 });
    expect(await deletePipeTask({ input: { deleted: true, pipeId: "7", id: null } })).toEqual({ deleted: true });
    expect(mocks.taskDeleteMany).toHaveBeenCalledWith({ where: { pipeId: "7" } });
    mocks.taskDeleteMany.mockResolvedValue({ count: 0 });
    expect(await deletePipeTask({ input: { deleted: true, pipeId: null, id: "t1" } })).toEqual({ deleted: false });
    expect(mocks.taskDeleteMany).toHaveBeenLastCalledWith({ where: { id: "t1" } });
  });
  it("lists a brand's tasks, mapping n/a to Lochside LLC", async () => {
    mocks.taskFindMany.mockResolvedValue([
      row({ stage: "big3", big3Rank: 1, ownerKey: "agent:donna", ownerName: "Donna", ownerKind: "agent", tags: [{ label: "big3" }],
            notes: [{ pipeNoteId: "n1", body: "Hi", notedAt: new Date("2026-10-22T10:00:00Z") }] }),
    ]);
    const tasks = await listPipeTasks({ actorUserId: "u", brand: "n/a", stage: "big3", query: "gate" });
    expect(mocks.taskFindMany.mock.calls[0][0].where).toMatchObject({
      brandId: "brand-lochside-llc",
      stage: "big3",
      title: { contains: "gate", mode: "insensitive" },
    });
    expect(tasks[0]).toMatchObject({
      pipeId: "7",
      homeBrand: "personal",
      owner: { id: "agent:donna", name: "Donna", kind: "agent" },
      tags: ["big3"],
      notes: [{ id: "n1", body: "Hi", at: "2026-10-22T10:00:00.000Z" }],
    });
  });
});
