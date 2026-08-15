import { describe, expect, it } from "vitest";
import { normalizeEmail } from "./normalize";

describe("normalizeEmail", () => {
  it("trims, normalizes, and lowercases email identities", () => {
    expect(normalizeEmail("  DagnyMotor@GMAIL.com  ")).toBe("dagnymotor@gmail.com");
  });
});

