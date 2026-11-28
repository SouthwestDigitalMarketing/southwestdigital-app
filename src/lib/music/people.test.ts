import { describe, expect, it } from "vitest";
import { contactNotes, GROUP_TAGS, websiteFromNotes } from "./people";
import { SET_LIST_CONTACTS, SET_LIST_GROUPS } from "./setListContacts";

describe("music people", () => {
  it("has a tag for every research group", () => {
    expect(SET_LIST_GROUPS.every((group) => GROUP_TAGS[group]?.key)).toBe(true);
  });

  it("keeps the website in the notes and reads it back", () => {
    const notes = contactNotes(SET_LIST_CONTACTS[0]);
    expect(websiteFromNotes(notes)).toBe(SET_LIST_CONTACTS[0].url);
    expect(websiteFromNotes("no site")).toBeNull();
  });
});
