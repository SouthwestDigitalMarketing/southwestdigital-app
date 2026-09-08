import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  ASSESSMENT_STORAGE_KEY,
  CONTACT_INFO_STORAGE_KEY,
  assessmentStorageKey,
  contactInfoStorageKey,
} from "./ProposalBuilderStorage";

// The builder tab and the live preview tab derive their storage keys from the
// same URL params. If these two derivations ever disagree the preview silently
// renders a different draft, so pin the exact precedence.
function withSearch(search: string) {
  vi.stubGlobal("window", { location: { search } });
}

beforeEach(() => {
  withSearch("");
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("assessmentStorageKey", () => {
  it("falls back to the bare key with no scope at all", () => {
    expect(assessmentStorageKey()).toBe(ASSESSMENT_STORAGE_KEY);
  });

  it("prefers an explicit engagement id over every URL param", () => {
    withSearch("?engagementId=url-eng&offer=off&contacts=con");
    expect(assessmentStorageKey({ engagementId: "explicit" })).toBe(
      `${ASSESSMENT_STORAGE_KEY}:explicit`,
    );
  });

  it("prefers the engagementId param over the audience params", () => {
    withSearch("?offer=off&engagementId=url-eng");
    expect(assessmentStorageKey()).toBe(`${ASSESSMENT_STORAGE_KEY}:url-eng`);
  });

  it("orders the audience params offer, then contacts, then contact", () => {
    withSearch("?contact=c&contacts=cs&offer=o");
    expect(assessmentStorageKey()).toBe(`${ASSESSMENT_STORAGE_KEY}:o`);
    withSearch("?contact=c&contacts=cs");
    expect(assessmentStorageKey()).toBe(`${ASSESSMENT_STORAGE_KEY}:cs`);
    withSearch("?contact=c");
    expect(assessmentStorageKey()).toBe(`${ASSESSMENT_STORAGE_KEY}:c`);
  });
});

describe("contactInfoStorageKey", () => {
  it("falls back to the bare key with no scope at all", () => {
    expect(contactInfoStorageKey()).toBe(CONTACT_INFO_STORAGE_KEY);
  });

  it("scopes to the CRM audience ahead of any engagement id", () => {
    withSearch("?offer=off&engagementId=url-eng");
    expect(contactInfoStorageKey({ engagementId: "explicit" })).toBe(
      `${CONTACT_INFO_STORAGE_KEY}:crm:off`,
    );
  });

  it("uses the engagement id only when no audience param is present", () => {
    withSearch("?engagementId=url-eng");
    expect(contactInfoStorageKey()).toBe(`${CONTACT_INFO_STORAGE_KEY}:url-eng`);
    withSearch("");
    expect(contactInfoStorageKey({ engagementId: "explicit" })).toBe(
      `${CONTACT_INFO_STORAGE_KEY}:explicit`,
    );
  });
});

describe("builder and preview tabs agree", () => {
  // The preview tab is opened with the builder's params minus `preview`, so the
  // same search string must produce the same keys on both sides.
  it("derives identical keys from the forwarded query", () => {
    const builderSearch = "?offer=offer-123&preview=fullscreen";
    const forwarded = new URLSearchParams(builderSearch);
    forwarded.delete("preview");

    withSearch(builderSearch);
    const builderKeys = [assessmentStorageKey(), contactInfoStorageKey()];

    withSearch(`?${forwarded.toString()}`);
    const previewKeys = [assessmentStorageKey(), contactInfoStorageKey()];

    expect(previewKeys).toEqual(builderKeys);
    expect(previewKeys).toEqual([
      `${ASSESSMENT_STORAGE_KEY}:offer-123`,
      `${CONTACT_INFO_STORAGE_KEY}:crm:offer-123`,
    ]);
  });
});
