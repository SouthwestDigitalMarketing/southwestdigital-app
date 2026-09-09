// Shared by card previews and server checkout. Estimates are never added to
// today's payment; selecting an annual term still means monthly payments.
export function proposalPaymentSchedule(input: {
  cleanupMonths: number;
  cleanupMonthlyRate: number;
  onboardingFee: number;
  recurringMonthlyTotal: number;
  additionalOneTimeTotal: number;
}) {
  const money = (value: number) => Math.round(Math.max(0, value) * 100) / 100;
  const hasCleanup = input.cleanupMonths > 0;
  const firstMonthDueNow = hasCleanup ? 0 : money(input.recurringMonthlyTotal);
  const oneTimeTotal = money(input.onboardingFee + input.additionalOneTimeTotal);
  return {
    hasCleanup,
    cleanupTotal: money(input.cleanupMonthlyRate * input.cleanupMonths),
    oneTimeTotal,
    firstMonthDueNow,
    amountDueNow: money(oneTimeTotal + firstMonthDueNow),
    annualTotal: money(money(input.recurringMonthlyTotal) * 12),
  };
}

export const CLEANUP_APPROVAL_TEXT = "After discovery, we confirm the cleanup scope, price, and payment milestones for your written approval before cleanup begins. The cleanup estimate is not charged today.";
export const CLEANUP_MONTHLY_START_TEXT = "Monthly service and billing begin on the start date confirmed with you after approved cleanup is complete. Your first monthly payment is not due today.";
export const NO_CLEANUP_MONTHLY_START_TEXT = "Today's payment includes your first month. We confirm your service start date during onboarding; the next monthly payment is due one month after that date.";
