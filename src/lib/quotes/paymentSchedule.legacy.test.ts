// Legacy freeze: quotes without assessment.cleanupPlan read EXACTLY as today.
// Captured before any Spec 04 edit to paymentSchedule.ts; must pass unchanged after.
import { describe, expect, it } from "vitest";
import {
  ANNUAL_PREPAID_CLEANUP_START_TEXT,
  ANNUAL_PREPAID_START_TEXT,
  CLEANUP_APPROVAL_TEXT,
  CLEANUP_MONTHLY_START_TEXT,
  NO_CLEANUP_MONTHLY_START_TEXT,
  proposalPaymentSchedule,
} from "./paymentSchedule";

describe("payment schedule legacy freeze (no cleanupPlan)", () => {
  it("keeps every text byte-identical", () => {
    expect(CLEANUP_APPROVAL_TEXT).toBe(
      "After discovery, we confirm the cleanup scope, price, and payment milestones for your written approval before cleanup begins. The cleanup estimate is not charged today.",
    );
    expect(CLEANUP_MONTHLY_START_TEXT).toBe(
      "Monthly service and billing begin on the start date confirmed with you after approved cleanup is complete. Your first monthly payment is not due today.",
    );
    expect(NO_CLEANUP_MONTHLY_START_TEXT).toBe(
      "Today's payment includes your first month. We confirm your service start date during onboarding; the next monthly payment is due one month after that date.",
    );
    expect(ANNUAL_PREPAID_START_TEXT).toBe(
      "Today's payment covers your first 12 months of service in full. We confirm your service start date during onboarding; your next payment is due 12 months after that date.",
    );
    expect(ANNUAL_PREPAID_CLEANUP_START_TEXT).toBe(
      "Your 12 months of service are billed on the start date confirmed with you after approved cleanup is complete. The annual service payment is not due today.",
    );
  });

  it("keeps math byte-identical across a matrix of inputs", () => {
    const base = {
      cleanupMonths: 3,
      cleanupMonthlyRate: 300,
      onboardingFee: 560,
      recurringMonthlyTotal: 360,
      additionalOneTimeTotal: 65,
    };
    expect(proposalPaymentSchedule(base)).toEqual({
      hasCleanup: true,
      prepaidMonths: 1,
      cleanupTotal: 900,
      oneTimeTotal: 625,
      recurringDueNow: 0,
      firstMonthDueNow: 0,
      amountDueBeforeCredit: 625,
      creditApplied: 0,
      amountDueNow: 625,
      annualTotal: 4320,
    });
    expect(JSON.stringify(proposalPaymentSchedule(base))).toBe(
      '{"hasCleanup":true,"prepaidMonths":1,"cleanupTotal":900,"oneTimeTotal":625,"recurringDueNow":0,"firstMonthDueNow":0,"amountDueBeforeCredit":625,"creditApplied":0,"amountDueNow":625,"annualTotal":4320}',
    );
    expect(proposalPaymentSchedule({ ...base, cleanupMonths: 0, onboardingFee: 500 })).toEqual({
      hasCleanup: false,
      prepaidMonths: 1,
      cleanupTotal: 0,
      oneTimeTotal: 565,
      recurringDueNow: 360,
      firstMonthDueNow: 360,
      amountDueBeforeCredit: 925,
      creditApplied: 0,
      amountDueNow: 925,
      annualTotal: 4320,
    });
    expect(
      proposalPaymentSchedule({ ...base, cleanupMonths: 0, onboardingFee: 500, annualPrepay: true }),
    ).toMatchObject({ prepaidMonths: 12, recurringDueNow: 4320, amountDueNow: 4885 });
    expect(proposalPaymentSchedule({ ...base, creditApplied: 9999 })).toMatchObject({
      creditApplied: 625,
      amountDueNow: 0,
    });
    // Fractional rates: exact cents behavior pinned.
    expect(proposalPaymentSchedule({ ...base, cleanupMonthlyRate: 333.333, cleanupMonths: 3 })).toMatchObject({
      cleanupTotal: 1000,
    });
    expect(proposalPaymentSchedule({ ...base, recurringMonthlyTotal: 333.333 })).toMatchObject({
      annualTotal: 3999.96,
    });
  });
});
