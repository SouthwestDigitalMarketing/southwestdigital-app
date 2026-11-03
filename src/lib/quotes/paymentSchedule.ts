// Shared by card previews and server checkout. Estimates are never added to
// today's payment.
//
// A 12-month agreement is prepaid: today's payment covers the whole year of
// recurring service at the discounted rate, not one month of it. The caller
// passes the already-discounted effective monthly rate (base plus recurring
// add-ons), and this decides whether today buys 1 month or 12.
//
// Cleanup is the exception: when there is cleanup, recurring service has not
// started yet, so no service is charged today on either term.
export const ANNUAL_PREPAID_MONTHS = 12;

export function proposalPaymentSchedule(input: {
  cleanupMonths: number;
  cleanupMonthlyRate: number;
  onboardingFee: number;
  recurringMonthlyTotal: number;
  additionalOneTimeTotal: number;
  /** A 12-month agreement; today's payment prepays the year of recurring service. */
  annualPrepay?: boolean;
  /** Dollars already paid (e.g. a paid first day) credited against today's payment; never takes it below 0. */
  creditApplied?: number;
}) {
  const money = (value: number) => Math.round(Math.max(0, value) * 100) / 100;
  const hasCleanup = input.cleanupMonths > 0;
  const prepaidMonths = input.annualPrepay ? ANNUAL_PREPAID_MONTHS : 1;
  const recurringDueNow = hasCleanup ? 0 : money(input.recurringMonthlyTotal * prepaidMonths);
  const oneTimeTotal = money(input.onboardingFee + input.additionalOneTimeTotal);
  const amountDueBeforeCredit = money(oneTimeTotal + recurringDueNow);
  const creditApplied = Math.min(money(input.creditApplied ?? 0), amountDueBeforeCredit);
  return {
    hasCleanup,
    prepaidMonths,
    cleanupTotal: money(input.cleanupMonthlyRate * input.cleanupMonths),
    oneTimeTotal,
    /** Recurring service charged today: one month, or the prepaid year. */
    recurringDueNow,
    /** Kept for callers that label a single month; equals recurringDueNow on monthly terms. */
    firstMonthDueNow: recurringDueNow,
    amountDueBeforeCredit,
    creditApplied,
    amountDueNow: money(amountDueBeforeCredit - creditApplied),
    annualTotal: money(money(input.recurringMonthlyTotal) * ANNUAL_PREPAID_MONTHS),
  };
}

export const CLEANUP_APPROVAL_TEXT = "After discovery, we confirm the cleanup scope, price, and payment milestones for your written approval before cleanup begins. The cleanup estimate is not charged today.";
export const CLEANUP_MONTHLY_START_TEXT = "Monthly service and billing begin on the start date confirmed with you after approved cleanup is complete. Your first monthly payment is not due today.";
export const NO_CLEANUP_MONTHLY_START_TEXT = "Today's payment includes your first month. We confirm your service start date during onboarding; the next monthly payment is due one month after that date.";
export const ANNUAL_PREPAID_START_TEXT = "Today's payment covers your first 12 months of service in full. We confirm your service start date during onboarding; your next payment is due 12 months after that date.";
export const ANNUAL_PREPAID_CLEANUP_START_TEXT = "Your 12 months of service are billed on the start date confirmed with you after approved cleanup is complete. The annual service payment is not due today.";
