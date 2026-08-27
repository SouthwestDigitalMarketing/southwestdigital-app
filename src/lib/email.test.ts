import { describe, expect, it } from "vitest";
import { isValidEmail, normalizeEmailInput, parseEmailOrThrow } from "./email";

describe("normalizeEmailInput", () => {
  it("trims, lowercases, and strips mailto and spaces", () => {
    expect(normalizeEmailInput("  mailto:Jane.Doe@Company.com ")).toBe("jane.doe@company.com");
    expect(normalizeEmailInput("jane doe@company.com")).toBe("janedoe@company.com");
  });
});

describe("isValidEmail", () => {
  it("accepts normal and plus-tagged addresses", () => {
    expect(isValidEmail("name@company.com")).toBe(true);
    expect(isValidEmail("user+tag@gmail.com")).toBe(true);
  });

  it("rejects common mistakes", () => {
    expect(isValidEmail("name@company")).toBe(false);
    expect(isValidEmail("name@@company.com")).toBe(false);
    expect(isValidEmail("name@company..com")).toBe(false);
    expect(isValidEmail("name@.com")).toBe(false);
  });
});

describe("parseEmailOrThrow", () => {
  it("returns null for empty", () => {
    expect(parseEmailOrThrow("  ")).toBeNull();
  });

  it("throws for invalid", () => {
    expect(() => parseEmailOrThrow("not-an-email")).toThrow(/valid email/);
  });
});
