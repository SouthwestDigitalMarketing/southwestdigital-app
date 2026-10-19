import { createHash } from "node:crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  brandFind: vi.fn(),
  contactFindFirst: vi.fn(),
  contactFindMany: vi.fn(),
  contactCreate: vi.fn(),
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
      contact: {
        findFirst: mocks.contactFindFirst,
        findMany: mocks.contactFindMany,
        create: mocks.contactCreate,
      },
    }),
}));

import {
  PipeBrandError,
  authenticatePipeRequest,
  listPipeContacts,
  parsePipeContactInput,
  toE164,
  upsertPipeContact,
} from "./contacts";

const token = "s3cret-token";
const env = {
  PIPE_API_TOKEN_SHA256: createHash("sha256").update(token).digest("hex"),
  PIPE_API_ACTOR_USER_ID: "user-1",
};
const row = (over = {}) => ({
  id: "c1",
  name: "Dana Reyes",
  company: "Conroe Realty",
  email: "dana@example.com",
  phoneNumber: "(936) 555-1234",
  phoneE164: "+19365551234",
  updatedAt: new Date("2026-10-19T12:00:00Z"),
  ...over,
});

beforeEach(() => {
  for (const mock of [mocks.brandFind, mocks.contactFindFirst, mocks.contactFindMany, mocks.contactCreate]) {
    mock.mockReset();
  }
  mocks.contextArgs.length = 0;
  mocks.brandFind.mockResolvedValue({ id: "brand-1", slug: "melbourne-cfo", status: "ACTIVE", deletedAt: null });
});

describe("authenticatePipeRequest", () => {
  it("accepts the right bearer token and names the actor", () => {
    expect(authenticatePipeRequest(`Bearer ${token}`, env)).toEqual({ ok: true, actorUserId: "user-1" });
  });
  it("rejects a wrong, missing or malformed token", () => {
    for (const header of ["Bearer nope", null, "", "Basic abc", `Bearer ${token} extra`]) {
      expect(authenticatePipeRequest(header, env)).toEqual({ ok: false, status: 401 });
    }
  });
  it("is disabled, not open, when it is not configured", () => {
    expect(authenticatePipeRequest(`Bearer ${token}`, {})).toEqual({ ok: false, status: 503 });
    expect(authenticatePipeRequest(`Bearer ${token}`, { ...env, PIPE_API_TOKEN_SHA256: "abc" })).toEqual({ ok: false, status: 503 });
    expect(authenticatePipeRequest(`Bearer ${token}`, { ...env, PIPE_API_ACTOR_USER_ID: "" })).toEqual({ ok: false, status: 503 });
  });
});

describe("toE164", () => {
  it.each([
    ["(936) 555-1234", "+19365551234"],
    ["936-555-1234", "+19365551234"],
    ["1 936 555 1234", "+19365551234"],
    ["+1 936 555 1234", "+19365551234"],
    ["+44 20 7946 0958", "+442079460958"],
  ])("%s -> %s", (raw, expected) => expect(toE164(raw)).toBe(expected));
  it.each(["", "555-1234", "abc", null, undefined, "+12"])("%s -> null", (raw) =>
    expect(toE164(raw as string | null | undefined)).toBeNull(),
  );
});

describe("parsePipeContactInput", () => {
  it("trims, lowercases the email and drops empty fields", () => {
    expect(parsePipeContactInput({ brand: " melbourne-cfo ", name: " Dana ", email: " Dana@Example.COM ", company: " " })).toEqual({
      brand: "melbourne-cfo", name: "Dana", company: null, email: "dana@example.com", phone: null,
    });
  });
  it("requires a brand and a name and a valid email", () => {
    expect(() => parsePipeContactInput({ name: "x" })).toThrow("brand is required");
    expect(() => parsePipeContactInput({ brand: "b" })).toThrow("name is required");
    expect(() => parsePipeContactInput({ brand: "b", name: "x", email: "nope" })).toThrow("email is not valid");
    expect(() => parsePipeContactInput(null)).toThrow(RangeError);
  });
});

describe("upsertPipeContact", () => {
  const input = { brand: "melbourne-cfo", name: "Dana Reyes", company: "Conroe Realty", email: "dana@example.com", phone: "936-555-1234" };

  it("creates inside the brand's context when nobody matches", async () => {
    mocks.contactFindFirst.mockResolvedValue(null);
    mocks.contactCreate.mockResolvedValue(row());
    const result = await upsertPipeContact({ actorUserId: "user-1", input });
    expect(result.created).toBe(true);
    expect(result.contact).toMatchObject({ id: "c1", brand: "melbourne-cfo", phoneE164: "+19365551234" });
    expect(mocks.contextArgs).toEqual([{ brandId: "brand-1", actorUserId: "user-1" }]);
    expect(mocks.contactCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ brandId: "brand-1", name: "Dana Reyes", phoneE164: "+19365551234", phoneNumber: "936-555-1234" }),
      }),
    );
  });

  it("returns the existing contact and writes nothing", async () => {
    mocks.contactFindFirst.mockResolvedValue(row());
    const result = await upsertPipeContact({ actorUserId: "user-1", input });
    expect(result.created).toBe(false);
    expect(mocks.contactCreate).not.toHaveBeenCalled();
  });

  it("matches only inside this brand, by phone or case-insensitive email", async () => {
    mocks.contactFindFirst.mockResolvedValue(null);
    mocks.contactCreate.mockResolvedValue(row());
    await upsertPipeContact({ actorUserId: "user-1", input });
    expect(mocks.contactFindFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          brandId: "brand-1",
          OR: [{ phoneE164: "+19365551234" }, { email: { equals: "dana@example.com", mode: "insensitive" } }],
        },
      }),
    );
  });

  it("with no phone or email there is nothing to match on, so it creates", async () => {
    mocks.contactCreate.mockResolvedValue(row({ email: null, phoneE164: null, phoneNumber: null }));
    const result = await upsertPipeContact({ actorUserId: "user-1", input: { brand: "melbourne-cfo", name: "Dana" } });
    expect(result.created).toBe(true);
    expect(mocks.contactFindFirst).not.toHaveBeenCalled();
  });

  it("refuses an unknown or deleted brand before touching contacts", async () => {
    mocks.brandFind.mockResolvedValue(null);
    await expect(upsertPipeContact({ actorUserId: "u", input })).rejects.toBeInstanceOf(PipeBrandError);
    mocks.brandFind.mockResolvedValue({ id: "b", slug: "x", status: "DELETED", deletedAt: null });
    await expect(upsertPipeContact({ actorUserId: "u", input })).rejects.toBeInstanceOf(PipeBrandError);
    mocks.brandFind.mockResolvedValue({ id: "b", slug: "x", status: "ACTIVE", deletedAt: new Date() });
    await expect(upsertPipeContact({ actorUserId: "u", input })).rejects.toBeInstanceOf(PipeBrandError);
    expect(mocks.contactCreate).not.toHaveBeenCalled();
  });
});

describe("listPipeContacts", () => {
  it("lists active contacts of one brand and searches name, company, email and digits", async () => {
    mocks.contactFindMany.mockResolvedValue([row()]);
    const result = await listPipeContacts({ actorUserId: "u", brand: "melbourne-cfo", query: "936-555" });
    expect(result[0]).toMatchObject({ name: "Dana Reyes", brand: "melbourne-cfo" });
    const where = mocks.contactFindMany.mock.calls[0][0].where;
    expect(where.brandId).toBe("brand-1");
    expect(where.isActive).toBe(true);
    expect(where.OR).toHaveLength(5);
  });
  it("lists everything for the brand without a query", async () => {
    mocks.contactFindMany.mockResolvedValue([]);
    await listPipeContacts({ actorUserId: "u", brand: "melbourne-cfo" });
    expect(mocks.contactFindMany.mock.calls[0][0].where).toEqual({ brandId: "brand-1", isActive: true });
  });
});
