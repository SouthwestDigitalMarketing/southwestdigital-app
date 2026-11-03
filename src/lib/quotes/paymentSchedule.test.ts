import { describe, expect, it } from "vitest";
import { proposalPaymentSchedule } from "./paymentSchedule";

describe("proposal payment schedule", () => {
  const input = { cleanupMonths: 3, cleanupMonthlyRate: 300, onboardingFee: 560, recurringMonthlyTotal: 360, additionalOneTimeTotal: 65 };
  it("keeps cleanup estimates separate from initial charges", () => {
    expect(proposalPaymentSchedule(input)).toEqual({
      hasCleanup: true, prepaidMonths: 1, cleanupTotal: 900, oneTimeTotal: 625,
      recurringDueNow: 0, firstMonthDueNow: 0, amountDueBeforeCredit: 625, creditApplied: 0, amountDueNow: 625, annualTotal: 4320,
    });
  });
  it("deducts a credit from today's payment and floors it at zero", () => {
    expect(proposalPaymentSchedule({ ...input, creditApplied: 100 })).toMatchObject({ creditApplied: 100, amountDueNow: 525 });
    expect(proposalPaymentSchedule({ ...input, creditApplied: 9999 })).toMatchObject({ creditApplied: 625, amountDueNow: 0 });
  });
  it("charges a single month on a month-to-month term", () => {
    expect(proposalPaymentSchedule({ ...input, cleanupMonths: 0, onboardingFee: 500 })).toMatchObject({
      prepaidMonths: 1, recurringDueNow: 360, amountDueNow: 925, cleanupTotal: 0, annualTotal: 4320,
    });
  });
  it("prepays the full year on a 12-month term", () => {
    expect(proposalPaymentSchedule({ ...input, cleanupMonths: 0, onboardingFee: 500, annualPrepay: true })).toMatchObject({
      prepaidMonths: 12,
      recurringDueNow: 4320,
      // onboarding 500 + one-time 65 + twelve months 4320
      amountDueNow: 4885,
    });
  });
  it("charges no service up front on an annual term when cleanup comes first", () => {
    expect(proposalPaymentSchedule({ ...input, annualPrepay: true })).toMatchObject({
      hasCleanup: true, prepaidMonths: 12, recurringDueNow: 0, amountDueNow: 625,
    });
  });
  it("uses the rounded monthly bill for all twelve months", () => {
    expect(proposalPaymentSchedule({ ...input, recurringMonthlyTotal: 333.333 })).toMatchObject({ annualTotal: 3999.96 });
  });
});
