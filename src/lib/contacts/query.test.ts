import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const { contactSearchWhere } = await import("./query");

const base = {
  brandId: "b1",
  q: "",
  status: "all" as const,
  tagIds: [] as string[],
};

describe("contactSearchWhere relationship", () => {
  it("does not constrain people when relationship is all", () => {
    expect(contactSearchWhere({ ...base, relationship: "all" })).toEqual({ brandId: "b1" });
  });

  it("filters family and friend groups by tag key", () => {
    expect(contactSearchWhere({ ...base, relationship: "close-family" }).AND).toEqual([
      { tagLinks: { some: { tag: { key: "close-family" } } } },
    ]);
    expect(contactSearchWhere({ ...base, relationship: "family" }).AND).toEqual([
      { tagLinks: { some: { tag: { key: "family" } } } },
    ]);
    expect(contactSearchWhere({ ...base, relationship: "close-friend" }).AND).toEqual([
      { tagLinks: { some: { tag: { key: "close-friend" } } } },
    ]);
    expect(contactSearchWhere({ ...base, relationship: "friend" }).AND).toEqual([
      { tagLinks: { some: { tag: { key: "friend" } } } },
    ]);
  });

  it("treats Client as the client tag, active-client tag, or a company link", () => {
    expect(contactSearchWhere({ ...base, relationship: "client" }).AND).toEqual([
      {
        OR: [
          { tagLinks: { some: { tag: { key: { in: ["client", "active-client"] } } } } },
          { clientLinks: { some: {} } },
        ],
      },
    ]);
  });

  it("keeps search and relationship as separate AND clauses", () => {
    const where = contactSearchWhere({ ...base, q: "Amy", relationship: "friend" });
    const and = where.AND;
    expect(Array.isArray(and)).toBe(true);
    expect(and).toHaveLength(2);
    expect(Array.isArray(and) ? and[1] : and).toEqual({
      tagLinks: { some: { tag: { key: "friend" } } },
    });
  });
});
