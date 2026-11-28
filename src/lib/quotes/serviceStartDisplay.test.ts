import { describe, expect, it } from "vitest";
import {
  CREDIT_APPLIED_DEFAULT_LABEL,
  creditAppliedLabel,
  remainingCreditLine,
  resolveDisplayServiceStartMonth,
  staffCreditLine,
} from "./serviceStartDisplay";

describe("serviceStartDisplay", () => {
  it("resolves the frozen checkout month over the staff month", () => {
    expect(resolveDisplayServiceStartMonth("2026-03", "2026-05")).toBe("2026-03");
  });

  it("falls back to the explicit staff month", () => {
    expect(resolveDisplayServiceStartMonth(null, "2026-05")).toBe("2026-05");
    expect(resolveDisplayServiceStartMonth(undefined, "2026-05")).toBe("2026-05");
  });

  it("reads junk and absence as no month (legacy surfaces unchanged)", () => {
    expect(resolveDisplayServiceStartMonth(null, null)).toBeNull();
    expect(resolveDisplayServiceStartMonth(undefined, "")).toBeNull();
    expect(resolveDisplayServiceStartMonth("next month", "soon")).toBeNull();
    expect(resolveDisplayServiceStartMonth("2026-13", "2026-00")).toBeNull();
  });

  it("labels the applied credit with the reason when set", () => {
    expect(creditAppliedLabel("Credit for October work already paid")).toBe(
      "Credit for October work already paid",
    );
    expect(creditAppliedLabel("  padded  ")).toBe("padded");
  });

  it("falls back to the default credit label", () => {
    for (const reason of [undefined, null, "", "   ", 42, {}]) {
      expect(creditAppliedLabel(reason)).toBe(CREDIT_APPLIED_DEFAULT_LABEL);
    }
    expect(CREDIT_APPLIED_DEFAULT_LABEL).toBe("Credit for work already paid");
  });

  it.each([
    [{ remaining: 400, reason: "Credit for October" }, "Remaining credit of $400.00 (Credit for October) will be applied to your next invoice."],
    [{ remaining: 49.5, reason: "" }, "Remaining credit of $49.50 will be applied to your next invoice."],
    [{ remaining: 49.5, reason: "   " }, "Remaining credit of $49.50 will be applied to your next invoice."],
    [{ remaining: 49.5, reason: null }, "Remaining credit of $49.50 will be applied to your next invoice."],
  ])("writes the client remainder line for %j", (input, expected) => {
    expect(remainingCreditLine(input.remaining, input.reason)).toBe(expected);
  });

  it.each([
    [{ remaining: 400, reason: "Credit for October" }, "Credit to apply on next invoice: $400.00 — Credit for October"],
    [{ remaining: 400, reason: "" }, "Credit to apply on next invoice: $400.00"],
  ])("writes the staff remainder line for %j", (input, expected) => {
    expect(staffCreditLine(input.remaining, input.reason)).toBe(expected);
  });

  it.each([[0], [-5], [null], [undefined], ["400"], [Number.NaN]])(
    "reads %j as no remainder on every surface",
    (remaining) => {
      expect(remainingCreditLine(remaining, "Credit for October")).toBeNull();
      expect(staffCreditLine(remaining, "Credit for October")).toBeNull();
    },
  );
});
