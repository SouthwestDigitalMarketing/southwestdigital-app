import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  itemFind: vi.fn(),
  stageFind: vi.fn(),
  itemUpdate: vi.fn(),
  leadUpdate: vi.fn(),
  transaction: vi.fn(),
  revalidate: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    pipelineItem: { findFirst: mocks.itemFind, update: mocks.itemUpdate },
    pipelineStage: { findFirst: mocks.stageFind },
    meetingLead: { update: mocks.leadUpdate },
    $transaction: mocks.transaction,
  },
}));
vi.mock("@/lib/brands/staff", () => ({ requireStaffBrandOrThrow: async () => ({ brand: { id: "brand-1" } }) }));
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidate }));
vi.mock("next/navigation", () => ({ redirect: vi.fn() }));

import { movePipelineItemAction } from "./actions";

function form({
  stageId = "stage-talking",
  leadStep,
  includeLeadStep = true,
  pipelineKey = "pipe-prospects",
}: {
  stageId?: string;
  leadStep?: string;
  includeLeadStep?: boolean;
  pipelineKey?: string;
} = {}) {
  const data = new FormData();
  data.set("itemId", "item-1");
  data.set("stageId", stageId);
  data.set("pipelineKey", pipelineKey);
  if (includeLeadStep) data.set("leadStep", leadStep ?? "");
  return data;
}

beforeEach(() => {
  mocks.itemFind.mockReset().mockResolvedValue({
    id: "item-1",
    pipelineId: "pipeline-1",
    pipeline: { key: "pipe-prospects" },
    lead: { id: "lead-1", updatedAt: new Date("2026-10-20T10:00:00.000Z") },
  });
  mocks.stageFind.mockReset().mockImplementation(async ({ where }) => ({
    id: where.id,
    key: ({ "stage-lead": "lead", "stage-talking": "talking", "stage-proposed": "proposed", "stage-won": "won", "stage-prospect": "prospect" } as Record<string, string>)[where.id],
  }));
  mocks.itemUpdate.mockReset().mockResolvedValue({ id: "item-1" });
  mocks.leadUpdate.mockReset().mockResolvedValue({ id: "lead-1" });
  mocks.transaction.mockReset().mockImplementation((operations: Promise<unknown>[]) => Promise.all(operations));
  mocks.revalidate.mockReset();
});

describe("movePipelineItemAction on the pipe Leads board", () => {
  it("sets both the step and its mapped underlying stage", async () => {
    await movePipelineItemAction(form({ stageId: "stage-talking", leadStep: "book" }));
    expect(mocks.leadUpdate).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: "lead-1" },
      data: expect.objectContaining({ leadStep: "book", updatedAt: expect.any(Date) }),
    }));
    expect(mocks.itemUpdate).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: "item-1" },
      data: { stageId: "stage-talking" },
    }));
    expect(mocks.transaction).toHaveBeenCalledTimes(1);
    expect(mocks.revalidate).toHaveBeenCalledWith("/pipeline/pipe-prospects");
  });

  it("uses the required stage mapping for all six Leads steps", async () => {
    const previousUpdatedAt = new Date("2026-10-20T10:00:00.000Z");
    const moves = [
      ["reach", "stage-lead"],
      ["qb", "stage-talking"],
      ["book", "stage-talking"],
      ["call", "stage-talking"],
      ["quote", "stage-proposed"],
      ["nurture", "stage-proposed"],
    ] as const;
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-21T10:00:00.000Z"));
    try {
      for (const [leadStep, stageId] of moves) {
        await movePipelineItemAction(form({ leadStep, stageId }));
      }
    } finally {
      vi.useRealTimers();
    }
    expect(mocks.leadUpdate.mock.calls.map(([args]) => args.data.leadStep)).toEqual(moves.map(([step]) => step));
    expect(mocks.leadUpdate.mock.calls.every(([args]) => args.data.updatedAt.getTime() > previousUpdatedAt.getTime())).toBe(true);
    expect(mocks.itemUpdate.mock.calls.map(([args]) => args.data.stageId)).toEqual(moves.map(([, stage]) => stage));
  });

  it("rejects a step sent with the wrong underlying stage", async () => {
    await expect(movePipelineItemAction(form({ stageId: "stage-talking", leadStep: "reach" })))
      .rejects.toThrow("must use the lead stage");
    expect(mocks.leadUpdate).not.toHaveBeenCalled();
    expect(mocks.itemUpdate).not.toHaveBeenCalled();
  });

  it("clears the step when a card moves to an existing non-Leads stage", async () => {
    await movePipelineItemAction(form({ stageId: "stage-won", leadStep: "" }));
    expect(mocks.leadUpdate).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ leadStep: null, updatedAt: expect.any(Date) }),
    }));
    expect(mocks.itemUpdate).toHaveBeenCalledWith(expect.objectContaining({ data: { stageId: "stage-won" } }));
  });

  it("bumps MeetingLead.updatedAt when a general pipeline stage moves", async () => {
    const previousUpdatedAt = new Date("2026-10-20T10:00:00.000Z");
    const expectedUpdatedAt = new Date(previousUpdatedAt.getTime() + 1);
    mocks.itemFind.mockResolvedValue({
      id: "item-1",
      pipelineId: "pipeline-1",
      pipeline: { key: "custom-pipeline" },
      lead: { id: "lead-1", updatedAt: previousUpdatedAt },
    });
    vi.useFakeTimers();
    vi.setSystemTime(previousUpdatedAt);
    try {
      await movePipelineItemAction(form({ stageId: "stage-talking", pipelineKey: "custom-pipeline" }));
    } finally {
      vi.useRealTimers();
    }

    const update = mocks.leadUpdate.mock.calls[0]?.[0];
    expect(update).toEqual(expect.objectContaining({
      where: { id: "lead-1" },
      data: { updatedAt: expectedUpdatedAt },
    }));
    expect(update.data.updatedAt.getTime()).toBeGreaterThan(previousUpdatedAt.getTime());
    expect(mocks.itemUpdate).toHaveBeenCalledWith(expect.objectContaining({ data: { stageId: "stage-talking" } }));
  });

  it("requires the step field for pipe pipeline moves", async () => {
    await expect(movePipelineItemAction(form({ includeLeadStep: false }))).rejects.toThrow("A Leads step is required");
    expect(mocks.itemUpdate).not.toHaveBeenCalled();
  });
});
