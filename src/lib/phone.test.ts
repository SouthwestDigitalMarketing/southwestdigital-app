import { describe, expect, it } from "vitest";
import {
  formatNationalNumber,
  parseSubmittedPhone,
  splitStoredPhone,
  toE164,
} from "./phone";

describe("formatNationalNumber", () => {
  it("formats US numbers as they are typed", () => {
    expect(formatNationalNumber("+1", "555")).toBe("555");
    expect(formatNationalNumber("+1", "555123")).toBe("(555) 123");
    expect(formatNationalNumber("+1", "5551234567")).toBe("(555) 123-4567");
    expect(formatNationalNumber("+1", "15551234567")).toBe("(555) 123-4567");
  });
});

describe("toE164", () => {
  it("builds US E.164 from a formatted national number", () => {
    expect(toE164("+1", "(555) 123-4567")).toBe("+15551234567");
  });

  it("returns null when national is empty", () => {
    expect(toE164("+1", "")).toBeNull();
  });

  it("rejects a short US number", () => {
    expect(() => toE164("+1", "(555) 123")).toThrow(/10-digit/);
  });
});

describe("splitStoredPhone", () => {
  it("splits a stored US E.164 into country and national", () => {
    expect(splitStoredPhone("+15551234567")).toEqual({
      countryCode: "+1",
      national: "(555) 123-4567",
    });
  });
});

describe("parseSubmittedPhone", () => {
  it("accepts already-normalized E.164", () => {
    expect(parseSubmittedPhone("+15551234567")).toBe("+15551234567");
  });
});
