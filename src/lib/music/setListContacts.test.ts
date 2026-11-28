import { describe, expect, it } from "vitest";
import { SET_LIST_CONTACTS, SET_LIST_GROUPS } from "./setListContacts";

describe("set list contacts", () => {
  it("puts every contact in a known group", () => {
    const groups = new Set<string>(SET_LIST_GROUPS);
    expect(SET_LIST_CONTACTS.every((c) => groups.has(c.group))).toBe(true);
  });

  it("has no duplicate name and city", () => {
    const keys = SET_LIST_CONTACTS.map((c) => `${c.name}|${c.city}`);
    expect(new Set(keys).size).toBe(keys.length);
  });
});
