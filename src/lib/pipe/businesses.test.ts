import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  brandFind: vi.fn(),
  accountFindFirst: vi.fn(),
  accountFindUnique: vi.fn(),
  accountFindMany: vi.fn(),
  accountCreate: vi.fn(),
  contactFindFirst: vi.fn(),
  linkUpsert: vi.fn(),
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
      customerAccount: {
        findFirst: mocks.accountFindFirst,
        findUniqueOrThrow: mocks.accountFindUnique,
        findMany: mocks.accountFindMany,
        create: mocks.accountCreate,
      },
      contact: { findFirst: mocks.contactFindFirst },
      customerContact: { upsert: mocks.linkUpsert },
    }),
}));

import { PipeBrandError } from "./contacts";
import {
  parsePipeBusinessInput,
  upsertPipeBusiness,
  listPipeBusinesses,
} from "./businesses";

const account = (over = {}) => ({
  id: "a1",
  name: "ARI Warehouse",
  legalName: "ARI Warehouse Solutions",
  primaryPhone: "+19366507460",
  communicationEmail: null,
  websiteUrl: null,
  updatedAt: new Date("2026-10-19T12:00:00Z"),
  contacts: [
    {
      contactId: "c3",
      relationship: "owner",
      isPrimary: true,
      canDecide: true,
      contact: { name: "Mr. Lopez" },
    },
  ],
  ...over,
});

beforeEach(() => {
  for (const mock of [
    mocks.brandFind, mocks.accountFindFirst, mocks.accountFindUnique,
    mocks.accountFindMany, mocks.accountCreate, mocks.contactFindFirst, mocks.linkUpsert,
  ]) {
    mock.mockReset();
  }
  mocks.contextArgs.length = 0;
  mocks.brandFind.mockResolvedValue({ id: "brand-1", slug: "bookkeeping-conroe", status: "ACTIVE", deletedAt: null });
});

describe("parsePipeBusinessInput", () => {
  it("requires a brand and a name and a valid email", () => {
    expect(() => parsePipeBusinessInput({ name: "x" })).toThrow("brand is required");
    expect(() => parsePipeBusinessInput({ brand: "b" })).toThrow("name is required");
    expect(() => parsePipeBusinessInput({ brand: "b", name: "x", email: "nope" })).toThrow("email is not valid");
    expect(() => parsePipeBusinessInput(null)).toThrow(RangeError);
  });
  it("rejects an unknown role and a person without a contact", () => {
    expect(() => parsePipeBusinessInput({ brand: "b", name: "x", people: [{ contact: "c1", role: "ceo" }] })).toThrow(
      "role must be one of",
    );
    expect(() => parsePipeBusinessInput({ brand: "b", name: "x", people: [{ role: "owner" }] })).toThrow(
      "every person needs a contact id",
    );
  });
  it("defaults a missing role to contact and reads either casing", () => {
    expect(parsePipeBusinessInput({ brand: "b", name: "x", people: [{ contact: "c1" }] }).people).toEqual([
      { contact: "c1", role: "contact", canDecide: null, primary: false },
    ]);
    expect(
      parsePipeBusinessInput({
        brand: "b", name: "x", legal_name: "LLC",
        people: [{ contact: "c1", role: "owner", can_decide: false, is_primary: true }],
      }),
    ).toMatchObject({ legalName: "LLC" });
  });
});

describe("upsertPipeBusiness", () => {
  const input = {
    brand: "bookkeeping-conroe",
    name: "ARI Warehouse",
    legalName: null,
    phone: "+19366507460",
    email: null,
    website: null,
    people: [{ contact: "c3", role: "owner" as const, canDecide: null as boolean | null, primary: true }],
  };

  it("creates the account and links its people", async () => {
    mocks.accountFindFirst.mockResolvedValue(null);
    mocks.accountCreate.mockResolvedValue(account({ contacts: [] }));
    mocks.contactFindFirst.mockResolvedValue({ id: "c3" });
    mocks.linkUpsert.mockResolvedValue({ id: "l1" });
    mocks.accountFindUnique.mockResolvedValue(account());
    const result = await upsertPipeBusiness({ actorUserId: "user-1", input });
    expect(result.created).toBe(true);
    expect(result.linked).toBe(1);
    expect(result.skipped).toEqual([]);
    expect(result.business.people).toMatchObject([
      { contactId: "c3", role: "owner", canDecide: true, primary: true },
    ]);
    expect(mocks.accountCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ brandId: "brand-1", name: "ARI Warehouse", status: "PROSPECT" }),
      }),
    );
    // Owners decide unless said otherwise.
    expect(mocks.linkUpsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({ relationship: "owner", isPrimary: true, canDecide: true }),
      }),
    );
  });

  it("keeps an existing account and still applies new links", async () => {
    mocks.accountFindFirst.mockResolvedValue(account({ contacts: [] }));
    mocks.contactFindFirst.mockResolvedValue({ id: "c2" });
    mocks.accountFindUnique.mockResolvedValue(account());
    const result = await upsertPipeBusiness({
      actorUserId: "user-1",
      input: { ...input, people: [{ contact: "c2", role: "rep", canDecide: true, primary: false }] },
    });
    expect(result.created).toBe(false);
    expect(mocks.accountCreate).not.toHaveBeenCalled();
    expect(result.linked).toBe(1);
    expect(mocks.linkUpsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({ relationship: "rep", canDecide: true }),
      }),
    );
  });

  it("skips unknown contacts and reports them", async () => {
    mocks.accountFindFirst.mockResolvedValue(account({ contacts: [] }));
    mocks.contactFindFirst.mockResolvedValue(null);
    const result = await upsertPipeBusiness({ actorUserId: "user-1", input });
    expect(result.linked).toBe(0);
    expect(result.skipped).toEqual([{ contact: "c3", reason: "unknown contact" }]);
    expect(mocks.linkUpsert).not.toHaveBeenCalled();
  });

  it("refuses an unknown brand before touching data", async () => {
    mocks.brandFind.mockResolvedValue(null);
    await expect(upsertPipeBusiness({ actorUserId: "u", input })).rejects.toBeInstanceOf(PipeBrandError);
    expect(mocks.accountCreate).not.toHaveBeenCalled();
  });
});

describe("listPipeBusinesses", () => {
  it("lists one brand's businesses with their people", async () => {
    mocks.accountFindMany.mockResolvedValue([account()]);
    const result = await listPipeBusinesses({ actorUserId: "u", brand: "bookkeeping-conroe", query: "ARI" });
    expect(result[0]).toMatchObject({ name: "ARI Warehouse", brand: "bookkeeping-conroe" });
    expect(result[0].people).toMatchObject([{ contactId: "c3", canDecide: true }]);
    const where = mocks.accountFindMany.mock.calls[0][0].where;
    expect(where.brandId).toBe("brand-1");
    expect(where.OR).toHaveLength(2);
  });
});
