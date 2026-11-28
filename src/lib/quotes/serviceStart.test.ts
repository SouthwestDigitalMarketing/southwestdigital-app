import { describe, expect, it } from "vitest";
import {
  annualServiceStartText,
  creditCarryover,
  firstMonthFullText,
  formatServiceStartMonth,
  isServiceStartMonth,
  normalizeServiceStartMonth,
  readCreditCarryover,
  resolveServiceStartMonth,
  serviceStartMonthForPlan,
  serviceStartText,
} from "./serviceStart";
import { proposalPaymentSchedule } from "./paymentSchedule";

const plan = {
  caughtUpThrough: "2026-03",
  startDate: "2026-02-14",
  wrapUpDate: "2026-05-14",
  wrapUpSource: "default",
  paymentPlan: "monthly",
} as const;

describe("service start month", () => {
  it("accepts only YYYY-MM with a real month", () => {
    expect(isServiceStartMonth("2026-10")).toBe(true);
    expect(isServiceStartMonth("2026-01")).toBe(true);
    for (const junk of [null, undefined, 202610, "", "Oct 2026", "2026-13", "2026-00", "2026-1", "26-10", "2026/10", "2026-10-01"]) {
      expect(isServiceStartMonth(junk)).toBe(false);
    }
  });

  it("defaults to the 1st of next month, rolling December to January", () => {
    expect(normalizeServiceStartMonth(undefined, { todayISO: "2026-11-27" })).toBe("2026-12");
    expect(normalizeServiceStartMonth(null, { todayISO: "2026-12-15" })).toBe("2027-01");
    expect(normalizeServiceStartMonth("", { todayISO: "2027-01-05" })).toBe("2027-02");
    expect(normalizeServiceStartMonth("junk", { todayISO: "2026-12-31" })).toBe("2027-01");
    // A valid stored month passes through untouched.
    expect(normalizeServiceStartMonth("2027-03", { todayISO: "2026-11-27" })).toBe("2027-03");
  });

  it("derives the cleanup start from the wrap-up month", () => {
    expect(serviceStartMonthForPlan({ ...plan })).toBe("2026-05");
  });

  it("resolves cleanup to the wrap-up month even when staff set one explicitly", () => {
    expect(resolveServiceStartMonth(
      { hasCleanup: true, plan: { ...plan }, startMonth: null }, { todayISO: "2026-02-01" },
    )).toBe("2026-05");
    // An explicit month on a cleanup proposal is ignored — the wrap-up month
    // always wins, so display and agreement can never disagree.
    expect(resolveServiceStartMonth(
      { hasCleanup: true, plan: { ...plan }, startMonth: "2026-09" }, { todayISO: "2026-02-01" },
    )).toBe("2026-05");
  });

  it("resolves no-cleanup to the stored month or the default", () => {
    expect(resolveServiceStartMonth(
      { hasCleanup: false, plan: null, startMonth: "2027-02" }, { todayISO: "2026-11-27" },
    )).toBe("2027-02");
    expect(resolveServiceStartMonth(
      { hasCleanup: false, plan: null, startMonth: null }, { todayISO: "2026-11-27" },
    )).toBe("2026-12");
    // Cleanup without a plan has no wrap-up to derive from: stored or default.
    expect(resolveServiceStartMonth(
      { hasCleanup: true, plan: null, startMonth: null }, { todayISO: "2026-11-27" },
    )).toBe("2026-12");
  });
});

describe("service start texts", () => {
  it("formats the month for staff", () => {
    expect(formatServiceStartMonth("2026-10")).toBe("October 2026");
    expect(() => formatServiceStartMonth("junk")).toThrow();
  });

  it("states the exact start and billing rule", () => {
    expect(serviceStartText("2026-10")).toBe(
      "Service starts October 1, 2026. Billing is on the 1st of each month after.",
    );
  });

  it("states the annual variant from the start month", () => {
    expect(annualServiceStartText("2026-10")).toBe("Your 12 months run from October 1, 2026.");
  });

  it("states the full-first-month rule in one line", () => {
    expect(firstMonthFullText()).toBe(
      "The first month is billed in full, even if work starts mid-month, because it includes setup and account access.",
    );
  });
});

describe("credit carry-over math", () => {
  it("applies the whole credit when it is smaller than the amount due", () => {
    expect(creditCarryover({ firstPaymentCredit: 300, amountDueBeforeCredit: 800, reason: "Credit" })).toEqual({
      creditApplied: 300,
      creditRemaining: 0,
      creditRemainingReason: "Credit",
    });
  });

  it("carries nothing when the credit exactly covers the amount due", () => {
    expect(creditCarryover({ firstPaymentCredit: 800, amountDueBeforeCredit: 800, reason: "Credit" })).toEqual({
      creditApplied: 800,
      creditRemaining: 0,
      creditRemainingReason: "Credit",
    });
  });

  it("carries the excess when the credit exceeds the amount due", () => {
    expect(creditCarryover({
      firstPaymentCredit: 1000,
      amountDueBeforeCredit: 800,
      reason: "  Credit for October work already paid  ",
    })).toEqual({
      creditApplied: 800,
      creditRemaining: 200,
      creditRemainingReason: "Credit for October work already paid",
    });
  });

  it("rounds to cents and tolerates a missing reason", () => {
    expect(creditCarryover({ firstPaymentCredit: 100.005, amountDueBeforeCredit: 50 })).toMatchObject({
      creditApplied: 50,
      creditRemainingReason: "",
    });
  });
});

describe("readCreditCarryover (strict)", () => {
  it("reads a stored remainder", () => {
    expect(readCreditCarryover({ creditRemaining: 200, creditRemainingReason: "Credit" })).toEqual({
      creditRemaining: 200,
      creditRemainingReason: "Credit",
    });
  });

  it("reads junk as no carry-over", () => {
    expect(readCreditCarryover({ creditRemaining: 200 })).toEqual({
      creditRemaining: 200,
      creditRemainingReason: "",
    });
    for (const junk of [null, undefined, "200", [], {}, { creditRemaining: 0, creditRemainingReason: "x" },
      { creditRemaining: -5, creditRemainingReason: "x" },
      { creditRemaining: 200, creditRemainingReason: 7 }, { creditRemaining: Number.NaN, creditRemainingReason: "x" }]) {
      expect(readCreditCarryover(junk)).toBeNull();
    }
  });
});

describe("payment schedule service-start passthrough", () => {
  const base = {
    cleanupMonths: 0,
    cleanupMonthlyRate: 300,
    onboardingFee: 500,
    recurringMonthlyTotal: 360,
    additionalOneTimeTotal: 65,
  };
  it("passes a valid start month through without touching the math", () => {
    expect(proposalPaymentSchedule({ ...base, serviceStartMonth: "2026-12" })).toEqual({
      ...proposalPaymentSchedule(base),
      serviceStartMonth: "2026-12",
    });
  });

  it("leaves the result byte-identical without a start month", () => {
    expect(proposalPaymentSchedule(base)).toEqual({
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
    expect(JSON.stringify(proposalPaymentSchedule({ ...base, serviceStartMonth: "junk" }))).toBe(
      JSON.stringify(proposalPaymentSchedule(base)),
    );
  });
});
