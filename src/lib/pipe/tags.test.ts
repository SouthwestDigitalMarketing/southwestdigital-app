import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  contactFind: vi.fn(),
  tagFind: vi.fn(),
  tagCreate: vi.fn(),
  tagUpdate: vi.fn(),
  linkFind: vi.fn(),
  linkCreate: vi.fn(),
  linkDelete: vi.fn(),
  linkMany: vi.fn(),
  automation: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/pipe/contacts", () => ({
  PipeBrandError: class extends Error {},
  resolveBrand: async () => ({ id: "brand-1", slug: "b" }),
}));
vi.mock("@/lib/contacts/automation", () => ({ applyTagPipelineAutomation: mocks.automation }));
vi.mock("@/lib/tenancy/context", () => ({
  createBrandDataContext: (c: unknown) => c,
  withBrandDataTransaction: async (_c: unknown, run: (t: unknown) => unknown) =>
    run({
      contact: { findFirst: mocks.contactFind },
      contactTag: { findUnique: mocks.tagFind, create: mocks.tagCreate, update: mocks.tagUpdate },
      contactTagLink: {
        findUnique: mocks.linkFind,
        create: mocks.linkCreate,
        deleteMany: mocks.linkDelete,
        findMany: mocks.linkMany,
      },
    }),
}));

import { applyPipeTag, listPipeContactTags, parsePipeTagInput } from "./tags";

const input = { brand: "b", contactId: "c1", tag: "reviews", action: "add" as const };

beforeEach(() => {
  Object.values(mocks).forEach((m) => m.mockReset());
  mocks.contactFind.mockResolvedValue({ id: "c1" });
});

describe("parsePipeTagInput", () => {
  it("accepts a good body and lowercases the tag", () => {
    expect(parsePipeTagInput({ brand: "b", contact_id: "c1", tag: "Reviews", action: "add" })).toMatchObject({
      contactId: "c1",
      tag: "reviews",
    });
  });
  it("rejects missing brand, contact, bad tag, bad action, bad kind", () => {
    const ok = { brand: "b", contactId: "c1", tag: "x", action: "add" };
    expect(() => parsePipeTagInput({ ...ok, brand: "" })).toThrow(RangeError);
    expect(() => parsePipeTagInput({ ...ok, contactId: "" })).toThrow(RangeError);
    expect(() => parsePipeTagInput({ ...ok, tag: "a b" })).toThrow(RangeError);
    expect(() => parsePipeTagInput({ ...ok, action: "toggle" })).toThrow(RangeError);
    expect(() => parsePipeTagInput({ ...ok, kind: "NOPE" })).toThrow(RangeError);
  });
});

describe("applyPipeTag", () => {
  it("add links the tag and runs the automation", async () => {
    mocks.tagFind.mockResolvedValue({ id: "t1", isActive: true });
    mocks.linkFind.mockResolvedValue(null);
    const result = await applyPipeTag({ actorUserId: "u1", input });
    expect(result).toMatchObject({ changed: true, tagCreated: false });
    expect(mocks.linkCreate).toHaveBeenCalledWith({ data: { contactId: "c1", tagId: "t1" } });
    expect(mocks.automation).toHaveBeenCalledWith({
      brandId: "brand-1",
      actorUserId: "u1",
      contactId: "c1",
      tagId: "t1",
    });
  });
  it("add on an existing link changes nothing but still runs the idempotent automation", async () => {
    mocks.tagFind.mockResolvedValue({ id: "t1", isActive: true });
    mocks.linkFind.mockResolvedValue({ id: "l1" });
    const result = await applyPipeTag({ actorUserId: "u1", input });
    expect(result.changed).toBe(false);
    expect(mocks.linkCreate).not.toHaveBeenCalled();
    expect(mocks.automation).toHaveBeenCalledTimes(1);
  });
  it("creates a missing tag with the given kind and label", async () => {
    mocks.tagFind.mockResolvedValue(null);
    mocks.tagCreate.mockResolvedValue({ id: "t2", isActive: true });
    mocks.linkFind.mockResolvedValue(null);
    const result = await applyPipeTag({
      actorUserId: "u1",
      input: { ...input, label: "Reviews", kind: "CUSTOM" as never },
    });
    expect(result.tagCreated).toBe(true);
    expect(mocks.tagCreate).toHaveBeenCalledWith({
      data: { brandId: "brand-1", key: "reviews", label: "Reviews", kind: "CUSTOM" },
      select: { id: true, isActive: true },
    });
  });
  it("reactivates an inactive tag", async () => {
    mocks.tagFind.mockResolvedValue({ id: "t1", isActive: false });
    mocks.tagUpdate.mockResolvedValue({ id: "t1", isActive: true });
    mocks.linkFind.mockResolvedValue(null);
    await applyPipeTag({ actorUserId: "u1", input });
    expect(mocks.tagUpdate).toHaveBeenCalled();
  });
  it("remove deletes only the link and never runs the automation", async () => {
    mocks.tagFind.mockResolvedValue({ id: "t1", isActive: true });
    mocks.linkDelete.mockResolvedValue({ count: 1 });
    const result = await applyPipeTag({ actorUserId: "u1", input: { ...input, action: "remove" } });
    expect(result).toMatchObject({ changed: true, action: "remove" });
    expect(mocks.linkDelete).toHaveBeenCalledWith({ where: { contactId: "c1", tagId: "t1" } });
    expect(mocks.automation).not.toHaveBeenCalled();
  });
  it("remove of an unknown tag is a quiet no-op", async () => {
    mocks.tagFind.mockResolvedValue(null);
    const result = await applyPipeTag({ actorUserId: "u1", input: { ...input, action: "remove" } });
    expect(result.changed).toBe(false);
    expect(mocks.tagCreate).not.toHaveBeenCalled();
  });
  it("an unknown contact is an error", async () => {
    mocks.contactFind.mockResolvedValue(null);
    await expect(applyPipeTag({ actorUserId: "u1", input })).rejects.toThrow("unknown contact");
  });
});

describe("listPipeContactTags", () => {
  it("returns the keys", async () => {
    mocks.linkMany.mockResolvedValue([{ tag: { key: "lead" } }, { tag: { key: "reviews" } }]);
    expect(await listPipeContactTags({ actorUserId: "u1", brand: "b", contactId: "c1" })).toEqual(["lead", "reviews"]);
  });
});
