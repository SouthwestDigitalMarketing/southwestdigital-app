import { describe, expect, it } from "vitest";
import { privacyCovers, privacyOn } from ".";

describe("privacyOn", () => {
  it("is on only for the value 1", () => {
    expect(privacyOn("1")).toBe(true);
    expect(privacyOn("0")).toBe(false);
    expect(privacyOn(undefined)).toBe(false);
  });
});

describe("privacyCovers", () => {
  it("covers listed pages and their children, nothing else", () => {
    expect(privacyCovers("/scorecard")).toBe(true);
    expect(privacyCovers("/reports")).toBe(true);
    expect(privacyCovers("/reports/x")).toBe(true);
    expect(privacyCovers("/scorecards")).toBe(false);
    expect(privacyCovers("/dashboard")).toBe(false);
    expect(privacyCovers("/contacts/abc")).toBe(false);
  });
});
