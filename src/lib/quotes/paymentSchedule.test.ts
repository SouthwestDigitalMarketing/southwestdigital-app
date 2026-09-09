import { describe, expect, it } from "vitest";
import { proposalPaymentSchedule } from "./paymentSchedule";

describe("proposal payment schedule", () => {
  const input = { cleanupMonths: 3, cleanupMonthlyRate: 300, onboardingFee: 560, recurringMonthlyTotal: 360, additionalOneTimeTotal: 65 };
  it("keeps cleanup estimates separate from initial charges", () => {
    expect(proposalPaymentSchedule(input)).toEqual({
      hasCleanup: true, cleanupTotal: 900, oneTimeTotal: 625,
      firstMonthDueNow: 0, amountDueNow: 625, annualTotal: 4320,
    });
  });
  it("includes the first month without charging the entire annual commitment", () => {
    expect(proposalPaymentSchedule({ ...input, cleanupMonths: 0, onboardingFee: 500 })).toMatchObject({
      firstMonthDueNow: 360, amountDueNow: 925, cleanupTotal: 0, annualTotal: 4320,
    });
  });
  it("uses the rounded monthly bill for all twelve months", () => {
    expect(proposalPaymentSchedule({ ...input, recurringMonthlyTotal: 333.333 })).toMatchObject({ annualTotal: 3999.96 });
  });
});
