import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  tagFind: vi.fn(),
  contactFind: vi.fn(),
  automationFind: vi.fn(),
  linkDelete: vi.fn(),
  linkMany: vi.fn(),
  leadCreate: vi.fn(),
  leadUpdateMany: vi.fn(),
  leadContactCreate: vi.fn(),
  leadContactMany: vi.fn(),
  itemFind: vi.fn(),
  itemCreate: vi.fn(),
  itemDelete: vi.fn(),
  evidenceUpsert: vi.fn(),
  jobUpsert: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/tenancy/context", () => ({
  createBrandDataContext: (c: unknown) => c,
  withBrandDataTransaction: async (_c: unknown, run: (t: unknown) => unknown) =>
    run({
      contactTag: { findUnique: mocks.tagFind },
      contact: { findFirst: mocks.contactFind },
      contactTagAutomation: { findFirst: mocks.automationFind },
      contactTagLink: { deleteMany: mocks.linkDelete, findMany: mocks.linkMany },
      meetingLead: { create: mocks.leadCreate, updateMany: mocks.leadUpdateMany },
      leadContact: { create: mocks.leadContactCreate, findMany: mocks.leadContactMany },
      pipelineItem: {
        findUnique: mocks.itemFind,
        create: mocks.itemCreate,
        deleteMany: mocks.itemDelete,
      },
      salesEvidenceEvent: { upsert: mocks.evidenceUpsert },
      allThingWriteJob: { upsert: mocks.jobUpsert },
    }),
}));

import { applyTagPipelineAutomation, leadKindForHeldTags, removeTagPipelineAutomation } from "./automation";

const addArgs = { brandId: "brand-1", actorUserId: "u1", contactId: "c1", tagId: "t1" };

beforeEach(() => {
  Object.values(mocks).forEach((m) => m.mockReset());
  mocks.evidenceUpsert.mockImplementation(async (args: { create: Record<string, unknown> }) => ({ id: "e1" }));
  mocks.jobUpsert.mockResolvedValue({ id: "j1" });
});

describe("applyTagPipelineAutomation", () => {
  it("seats the lead and records tag-assigned evidence in the same transaction", async () => {
    mocks.tagFind.mockResolvedValue({ kind: "SERVICES", label: "Bookkeeping" });
    mocks.contactFind.mockResolvedValue({
      id: "c1",
      name: "Ann Client",
      email: null,
      company: null,
      leadLinks: [],
    });
    mocks.automationFind.mockResolvedValue({
      pipelineId: "p1",
      stageId: "s1",
      pipeline: { id: "p1", key: "prospects", isActive: true, stages: [{ id: "s1" }] },
    });
    mocks.leadCreate.mockResolvedValue({ id: "lead-1" });
    mocks.itemFind.mockResolvedValue(null);

    await applyTagPipelineAutomation(addArgs);

    expect(mocks.leadCreate).toHaveBeenCalledTimes(1);
    expect(mocks.itemCreate).toHaveBeenCalledWith({
      data: { pipelineId: "p1", stageId: "s1", leadId: "lead-1", isActive: true },
    });
    expect(mocks.evidenceUpsert).toHaveBeenCalledTimes(1);
    const evidence = mocks.evidenceUpsert.mock.calls[0]?.[0] as {
      where: { brandId_source_sourceEventId: Record<string, string> };
      create: Record<string, unknown>;
    };
    expect(evidence.where.brandId_source_sourceEventId).toMatchObject({
      brandId: "brand-1",
      source: "swapp",
      sourceEventId: "contact-tag:c1:t1:assigned",
    });
    expect(evidence.create).toMatchObject({
      eventType: "contact.tag_assigned",
      leadId: "lead-1",
      sourceRef: "/contacts/c1",
    });
    expect(mocks.jobUpsert).toHaveBeenCalledTimes(1);
  });

  it("records evidence even when the tag has no pipeline mapping", async () => {
    mocks.tagFind.mockResolvedValue({ kind: "CUSTOM", label: "VIP" });
    mocks.contactFind.mockResolvedValue({
      id: "c1",
      name: "Ann Client",
      email: null,
      company: null,
      leadLinks: [],
    });
    mocks.automationFind.mockResolvedValue(null);

    await applyTagPipelineAutomation(addArgs);

    expect(mocks.leadCreate).not.toHaveBeenCalled();
    expect(mocks.itemCreate).not.toHaveBeenCalled();
    expect(mocks.evidenceUpsert).toHaveBeenCalledTimes(1);
  });

  it("does nothing when the tag or contact is unknown", async () => {
    mocks.tagFind.mockResolvedValue(null);

    await applyTagPipelineAutomation(addArgs);

    expect(mocks.evidenceUpsert).not.toHaveBeenCalled();
  });
});

describe("removeTagPipelineAutomation", () => {
  it("deletes the link, unseats the lead, and records tag-removed evidence together", async () => {
    mocks.tagFind.mockResolvedValue({ label: "Bookkeeping" });
    mocks.linkDelete.mockResolvedValue({ count: 1 });
    mocks.contactFind.mockResolvedValue({ id: "c1", name: "Ann Client" });
    mocks.automationFind
      .mockResolvedValueOnce({
        pipelineId: "p1",
        pipeline: { id: "p1", key: "prospects" },
      })
      .mockResolvedValueOnce(null);
    mocks.linkMany.mockResolvedValue([]);
    mocks.leadContactMany.mockResolvedValue([{ leadId: "lead-1" }]);

    const result = await removeTagPipelineAutomation(addArgs);

    expect(result).toEqual({ removed: true });
    expect(mocks.linkDelete).toHaveBeenCalledWith({ where: { contactId: "c1", tagId: "t1" } });
    expect(mocks.itemDelete).toHaveBeenCalledWith({
      where: { pipelineId: "p1", leadId: { in: ["lead-1"] } },
    });
    const evidence = mocks.evidenceUpsert.mock.calls[0]?.[0] as {
      where: { brandId_source_sourceEventId: Record<string, string> };
      create: Record<string, unknown>;
    };
    expect(evidence.where.brandId_source_sourceEventId.sourceEventId).toBe("contact-tag:c1:t1:removed");
    expect(evidence.create).toMatchObject({ eventType: "contact.tag_removed", leadId: "lead-1" });
    expect(mocks.jobUpsert).toHaveBeenCalledTimes(1);
  });

  it("keeps the seat when another held tag maps to the same pipeline", async () => {
    mocks.tagFind.mockResolvedValue({ label: "Bookkeeping" });
    mocks.linkDelete.mockResolvedValue({ count: 1 });
    mocks.contactFind.mockResolvedValue({ id: "c1", name: "Ann Client" });
    mocks.automationFind
      .mockResolvedValueOnce({
        pipelineId: "p1",
        pipeline: { id: "p1", key: "prospects" },
      })
      .mockResolvedValueOnce({ id: "sibling-automation" });
    mocks.linkMany.mockResolvedValue([{ tagId: "t2" }]);

    const result = await removeTagPipelineAutomation(addArgs);

    expect(result).toEqual({ removed: true });
    expect(mocks.linkDelete).toHaveBeenCalled();
    expect(mocks.itemDelete).not.toHaveBeenCalled();
    expect(mocks.leadContactMany).not.toHaveBeenCalled();
    expect(mocks.evidenceUpsert).toHaveBeenCalledTimes(1);
  });

  it("removes an unmapped tag link with evidence but no pipeline write", async () => {
    mocks.tagFind.mockResolvedValue({ label: "VIP" });
    mocks.linkDelete.mockResolvedValue({ count: 1 });
    mocks.contactFind.mockResolvedValue({ id: "c1", name: "Ann Client" });
    mocks.automationFind.mockResolvedValue(null);

    const result = await removeTagPipelineAutomation(addArgs);

    expect(result).toEqual({ removed: true });
    expect(mocks.itemDelete).not.toHaveBeenCalled();
    expect(mocks.evidenceUpsert).toHaveBeenCalledTimes(1);
  });

  it("is a quiet no-op when the link was already gone", async () => {
    mocks.tagFind.mockResolvedValue({ label: "VIP" });
    mocks.linkDelete.mockResolvedValue({ count: 0 });

    const result = await removeTagPipelineAutomation(addArgs);

    expect(result).toEqual({ removed: false });
    expect(mocks.itemDelete).not.toHaveBeenCalled();
    expect(mocks.evidenceUpsert).not.toHaveBeenCalled();
  });
});

describe("leadKindForHeldTags", () => {
  it("returns PROSPECT when an INDUSTRY tag is held", () => {
    expect(leadKindForHeldTags([{ key: "accountant", kind: "INDUSTRY" }])).toBe("PROSPECT");
  });

  it("returns LEAD when a step tag is held", () => {
    for (const key of ["business-owner", "lead", "talking", "reached", "proposed"]) {
      expect(leadKindForHeldTags([{ key, kind: "LEAD" }])).toBe("LEAD");
    }
  });

  it("prefers PROSPECT when both an INDUSTRY and a step tag are held", () => {
    expect(
      leadKindForHeldTags([
        { key: "talking", kind: "LEAD" },
        { key: "accountant", kind: "INDUSTRY" },
      ]),
    ).toBe("PROSPECT");
  });

  it("returns null when no held tag carries a kind signal", () => {
    expect(leadKindForHeldTags([])).toBeNull();
    expect(leadKindForHeldTags([{ key: "vip", kind: "CUSTOM" }])).toBeNull();
    expect(leadKindForHeldTags([{ key: "bookkeeper", kind: "SERVICES" }])).toBeNull();
  });
});

describe("lead kind recompute on tag add/remove", () => {
  it("sets linked leads to PROSPECT when an INDUSTRY tag is added", async () => {
    mocks.tagFind.mockResolvedValue({ kind: "INDUSTRY", label: "Accountant" });
    mocks.contactFind.mockResolvedValue({
      id: "c1",
      name: "Ann Client",
      email: null,
      company: null,
      leadLinks: [],
    });
    mocks.automationFind.mockResolvedValue(null);
    mocks.linkMany.mockResolvedValue([{ tag: { key: "accountant", kind: "INDUSTRY" } }]);
    mocks.leadContactMany.mockResolvedValue([{ leadId: "lead-1" }]);

    await applyTagPipelineAutomation(addArgs);

    expect(mocks.leadUpdateMany).toHaveBeenCalledWith({
      where: { brandId: "brand-1", id: { in: ["lead-1"] } },
      data: { kind: "PROSPECT" },
    });
  });

  it("sets linked leads to LEAD when a step tag is added", async () => {
    mocks.tagFind.mockResolvedValue({ kind: "LEAD", label: "Talking" });
    mocks.contactFind.mockResolvedValue({
      id: "c1",
      name: "Ann Client",
      email: null,
      company: null,
      leadLinks: [],
    });
    mocks.automationFind.mockResolvedValue(null);
    mocks.linkMany.mockResolvedValue([{ tag: { key: "talking", kind: "LEAD" } }]);
    mocks.leadContactMany.mockResolvedValue([{ leadId: "lead-1" }, { leadId: "lead-2" }]);

    await applyTagPipelineAutomation(addArgs);

    expect(mocks.leadUpdateMany).toHaveBeenCalledWith({
      where: { brandId: "brand-1", id: { in: ["lead-1", "lead-2"] } },
      data: { kind: "LEAD" },
    });
  });

  it("leaves kind alone when the added tag carries no kind signal", async () => {
    mocks.tagFind.mockResolvedValue({ kind: "CUSTOM", label: "VIP" });
    mocks.contactFind.mockResolvedValue({
      id: "c1",
      name: "Ann Client",
      email: null,
      company: null,
      leadLinks: [],
    });
    mocks.automationFind.mockResolvedValue(null);
    mocks.linkMany.mockResolvedValue([{ tag: { key: "vip", kind: "CUSTOM" } }]);

    await applyTagPipelineAutomation(addArgs);

    expect(mocks.leadUpdateMany).not.toHaveBeenCalled();
    expect(mocks.evidenceUpsert).toHaveBeenCalledTimes(1);
  });

  it("flips linked leads to PROSPECT when removing the last step tag leaves an INDUSTRY tag", async () => {
    mocks.tagFind.mockResolvedValue({ label: "Talking" });
    mocks.linkDelete.mockResolvedValue({ count: 1 });
    mocks.contactFind.mockResolvedValue({ id: "c1", name: "Ann Client" });
    mocks.automationFind.mockResolvedValue(null);
    mocks.linkMany.mockResolvedValue([{ tag: { key: "accountant", kind: "INDUSTRY" } }]);
    mocks.leadContactMany.mockResolvedValue([{ leadId: "lead-1" }]);

    await removeTagPipelineAutomation(addArgs);

    expect(mocks.leadUpdateMany).toHaveBeenCalledWith({
      where: { brandId: "brand-1", id: { in: ["lead-1"] } },
      data: { kind: "PROSPECT" },
    });
  });
});
