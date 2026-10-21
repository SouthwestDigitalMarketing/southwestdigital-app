import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  brandFind: vi.fn(),
  pipelineFind: vi.fn(),
  pipelineCreate: vi.fn(),
  stageFindMany: vi.fn(),
  stageCreate: vi.fn(),
  leadFind: vi.fn(),
  leadCreate: vi.fn(),
  leadUpdate: vi.fn(),
  contactFind: vi.fn(),
  accountFind: vi.fn(),
  linkUpsert: vi.fn(),
  itemUpsert: vi.fn(),
  itemFind: vi.fn(),
  itemFindMany: vi.fn(),
  contextArgs: [] as unknown[],
}));

vi.mock("@/lib/prisma", () => ({ prisma: { brand: { findUnique: mocks.brandFind } } }));
vi.mock("@/lib/tenancy/context", () => ({
  createBrandDataContext: (input: unknown) => {
    mocks.contextArgs.push(input);
    return input;
  },
  withBrandDataTransaction: (_context: unknown, operation: (t: unknown) => unknown) =>
    operation({
      pipeline: { findUnique: mocks.pipelineFind, create: mocks.pipelineCreate },
      pipelineStage: { findMany: mocks.stageFindMany, create: mocks.stageCreate },
      meetingLead: { findUnique: mocks.leadFind, create: mocks.leadCreate, update: mocks.leadUpdate },
      contact: { findFirst: mocks.contactFind },
      customerAccount: { findFirst: mocks.accountFind },
      leadContact: { upsert: mocks.linkUpsert },
      pipelineItem: { upsert: mocks.itemUpsert, findUniqueOrThrow: mocks.itemFind, findMany: mocks.itemFindMany },
    }),
}));

import { PipeBrandError } from "./contacts";
import { LEAD_STEPS, listPipeDeals, parsePipeDealInput, upsertPipeDeal } from "./deals";

const STAGES = [
  { id: "s1", key: "prospect" },
  { id: "s2", key: "lead" },
  { id: "s3", key: "talking" },
  { id: "s4", key: "proposed" },
  { id: "s5", key: "won" },
  { id: "s6", key: "lost" },
];

const item = (over = {}) => ({
  baseValueUsd: 0,
  stage: { key: "lead" },
  lead: {
    id: "l1",
    pipeId: "7",
    name: "johnny fortunado",
    company: "wrapstars",
    email: null,
    customerAccountId: null,
    nextAction: "get the owner's yes",
    nextDue: null,
    amount: 950,
    amountKind: "offer",
    invoiceRef: null,
    invoiceDate: null,
    yesContactId: null,
    leadStep: null,
    updatedAt: new Date("2026-10-19T12:00:00Z"),
    contacts: [{ contactId: "c1" }],
  },
  ...over,
});

beforeEach(() => {
  for (const mock of Object.values(mocks)) {
    if (Array.isArray(mock)) mock.length = 0;
    else (mock as { mockReset(): void }).mockReset();
  }
  mocks.brandFind.mockResolvedValue({ id: "brand-1", slug: "bookkeeping-conroe", status: "ACTIVE", deletedAt: null });
  mocks.pipelineFind.mockResolvedValue({ id: "p1" });
  mocks.stageFindMany.mockResolvedValue(STAGES);
});

describe("parsePipeDealInput", () => {
  it("requires a brand, a pipe id, and a name", () => {
    expect(() => parsePipeDealInput({ pipe_id: "7", name: "x" })).toThrow("brand is required");
    expect(() => parsePipeDealInput({ brand: "b", name: "x" })).toThrow("pipe_id is required");
    expect(() => parsePipeDealInput({ brand: "b", pipe_id: "7" })).toThrow("name is required");
    expect(() => parsePipeDealInput(null)).toThrow(RangeError);
  });
  it("rejects an unknown stage, kind, email, or amount", () => {
    const base = { brand: "b", pipe_id: "7", name: "x" };
    expect(() => parsePipeDealInput({ ...base, stage: "chatting" })).toThrow("stage must be one of");
    expect(() => parsePipeDealInput({ ...base, kind: "debt" })).toThrow("kind must be one of");
    expect(() => parsePipeDealInput({ ...base, email: "nope" })).toThrow("email is not valid");
    expect(() => parsePipeDealInput({ ...base, amount: "lots" })).toThrow("amount must be a number");
  });
  it("defaults the stage to prospect and reads either casing", () => {
    expect(parsePipeDealInput({ brand: "b", pipe_id: "7", name: "x" }).stage).toBe("prospect");
    const parsed = parsePipeDealInput({
      brand: "b", pipeId: "7", name: "x", stage: "lead",
      next_action: "call", nextDue: "2026-10-24", value_monthly: "500",
      amount: "950", kind: "offer", invoice_ref: "INV-1", yes_contact: "c9",
    });
    expect(parsed).toMatchObject({
      nextAction: "call", nextDue: "2026-10-24", valueMonthly: 500,
      amount: 950, amountKind: "offer", invoiceRef: "INV-1", yesContact: "c9",
    });
  });

  it("accepts each lead step only with its matching pipe stage", () => {
    const stageFor = { reach: "lead", qb: "talking", book: "talking", call: "talking", quote: "proposed", nurture: "proposed" } as const;
    for (const leadStep of LEAD_STEPS) {
      expect(parsePipeDealInput({ brand: "b", pipe_id: "7", name: "x", stage: stageFor[leadStep], lead_step: leadStep }).leadStep)
        .toBe(leadStep);
    }
    expect(parsePipeDealInput({ brand: "b", pipe_id: "7", name: "x", stage: "lead", leadStep: null }).leadStep).toBeNull();
    expect(parsePipeDealInput({ brand: "b", pipe_id: "7", name: "x" }).leadStep).toBeUndefined();
    expect(() => parsePipeDealInput({ brand: "b", pipe_id: "7", name: "x", stage: "talking", lead_step: "reach" })).toThrow("belongs to stage lead");
  });

  it("rejects unknown and non-string lead steps", () => {
    const base = { brand: "b", pipe_id: "7", name: "x", stage: "talking" };
    expect(() => parsePipeDealInput({ ...base, lead_step: "review" })).toThrow("lead_step must be one of");
    expect(() => parsePipeDealInput({ ...base, lead_step: 1 })).toThrow("lead_step must be one of");
  });
});

describe("upsertPipeDeal", () => {
  const input = {
    brand: "bookkeeping-conroe",
    pipeId: "7",
    name: "johnny fortunado",
    stage: "lead" as const,
    company: "wrapstars",
    phone: null,
    email: null,
    contact: "c1",
    business: null,
    nextAction: "get the owner's yes",
    nextDue: null,
    valueMonthly: null,
    amount: 950,
    amountKind: "offer",
    invoiceRef: null,
    invoiceDate: null,
    yesContact: null,
    leadStep: undefined,
  };

  beforeEach(() => {
    mocks.leadFind.mockResolvedValue(null);
    mocks.leadCreate.mockResolvedValue({ id: "l1" });
    mocks.contactFind.mockResolvedValue({ id: "c1" });
    mocks.itemFind.mockResolvedValue(item());
  });

  it("creates the pipeline, the lead, its links, and the item on first sight", async () => {
    const result = await upsertPipeDeal({ actorUserId: "user-1", input });
    expect(result.created).toBe(true);
    expect(result.deal).toMatchObject({ pipeId: "7", stage: "lead", amount: 950, amountKind: "offer" });
    expect(mocks.pipelineFind).toHaveBeenCalledWith(
      expect.objectContaining({ where: { brandId_key: { brandId: "brand-1", key: "pipe-prospects" } } }),
    );
    expect(mocks.leadCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ brandId: "brand-1", pipeId: "7", kind: "PROSPECT", amount: 950, leadStep: null }),
      }),
    );
    expect(mocks.itemUpsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { pipelineId_leadId: { pipelineId: "p1", leadId: "l1" } },
        create: expect.objectContaining({ stageId: "s2" }),
      }),
    );
  });

  it("creates the pipe pipeline with pipe's stages when the brand has none", async () => {
    mocks.pipelineFind.mockResolvedValue(null);
    mocks.pipelineCreate.mockResolvedValue({ id: "p9" });
    mocks.stageFindMany.mockResolvedValue([]);
    mocks.stageCreate.mockImplementation((args: { data: { key: string } }) => ({
      id: `s-${args.data.key}`,
      key: args.data.key,
    }));
    await upsertPipeDeal({ actorUserId: "user-1", input });
    expect(mocks.pipelineCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ key: "pipe-prospects", name: "Pipe Prospects" }),
      }),
    );
    expect(mocks.stageCreate).toHaveBeenCalledTimes(6);
  });

  it("moves the stage and updates the working fields on later pushes", async () => {
    mocks.leadFind.mockResolvedValue({ id: "l1", leadStep: "reach" });
    mocks.leadUpdate.mockResolvedValue({ id: "l1" });
    mocks.itemFind.mockResolvedValue(item({ stage: { key: "proposed" } }));
    const result = await upsertPipeDeal({
      actorUserId: "user-1",
      input: { ...input, stage: "proposed", nextAction: "send the invoice" },
    });
    expect(result.created).toBe(false);
    expect(mocks.leadUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ nextAction: "send the invoice" }) }),
    );
    expect(mocks.itemUpsert).toHaveBeenCalledWith(
      expect.objectContaining({ update: expect.objectContaining({ stageId: "s4" }) }),
    );
    expect(result.deal.stage).toBe("proposed");
  });

  it("stores, returns, preserves, clears, and drops a step when its stage changes", async () => {
    mocks.leadCreate.mockResolvedValue({ id: "l1", leadStep: "reach" });
    mocks.itemFind.mockResolvedValue(item({ lead: { ...item().lead, leadStep: "reach" } }));
    const created = await upsertPipeDeal({ actorUserId: "user-1", input: { ...input, leadStep: "reach" } });
    expect(mocks.leadCreate).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ leadStep: "reach" }) }));
    expect(created.deal.leadStep).toBe("reach");

    mocks.leadFind.mockResolvedValue({ id: "l1", leadStep: "qb" });
    await upsertPipeDeal({ actorUserId: "user-1", input: { ...input, stage: "talking", leadStep: undefined } });
    expect(mocks.leadUpdate).toHaveBeenLastCalledWith(expect.objectContaining({ data: expect.objectContaining({ leadStep: "qb" }) }));

    mocks.leadFind.mockResolvedValue({ id: "l1", leadStep: "qb" });
    await upsertPipeDeal({ actorUserId: "user-1", input: { ...input, stage: "proposed", leadStep: undefined } });
    expect(mocks.leadUpdate).toHaveBeenLastCalledWith(expect.objectContaining({ data: expect.objectContaining({ leadStep: null }) }));

    mocks.leadFind.mockResolvedValue({ id: "l1", leadStep: "qb" });
    await upsertPipeDeal({ actorUserId: "user-1", input: { ...input, stage: "talking", leadStep: null } });
    expect(mocks.leadUpdate).toHaveBeenLastCalledWith(expect.objectContaining({ data: expect.objectContaining({ leadStep: null }) }));
  });

  it("ignores unknown contact and business ids instead of creating anyone", async () => {
    mocks.contactFind.mockResolvedValue(null);
    mocks.accountFind.mockResolvedValue(null);
    const result = await upsertPipeDeal({
      actorUserId: "user-1",
      input: { ...input, contact: "c9", business: "a9", yesContact: "c9" },
    });
    expect(mocks.linkUpsert).not.toHaveBeenCalled();
    expect(mocks.leadCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ customerAccountId: null, yesContactId: null }),
      }),
    );
    expect(result.skipped).toEqual([
      { field: "contact", id: "c9", reason: "unknown id" },
      { field: "business", id: "a9", reason: "unknown id" },
      { field: "yesContact", id: "c9", reason: "unknown id" },
    ]);
  });

  it("refuses an unknown brand before touching data", async () => {
    mocks.brandFind.mockResolvedValue(null);
    await expect(upsertPipeDeal({ actorUserId: "u", input })).rejects.toBeInstanceOf(PipeBrandError);
    expect(mocks.leadCreate).not.toHaveBeenCalled();
  });
});

describe("listPipeDeals", () => {
  it("lists the brand's pipe pipeline items and searches names", async () => {
    mocks.itemFindMany.mockResolvedValue([item({ lead: { ...item().lead, leadStep: "reach" } })]);
    const result = await listPipeDeals({ actorUserId: "u", brand: "bookkeeping-conroe", query: "johnny" });
    expect(result[0]).toMatchObject({ pipeId: "7", stage: "lead", contact: "c1", leadStep: "reach" });
    expect(mocks.itemFindMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ pipelineId: "p1" }) }),
    );
  });
  it("lists nothing when the brand has no pipe pipeline yet", async () => {
    mocks.pipelineFind.mockResolvedValue(null);
    await expect(listPipeDeals({ actorUserId: "u", brand: "bookkeeping-conroe" })).resolves.toEqual([]);
    expect(mocks.itemFindMany).not.toHaveBeenCalled();
  });
});
