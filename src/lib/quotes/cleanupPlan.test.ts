import { describe, expect, it } from "vitest";
import { proposalPaymentSchedule } from "./paymentSchedule";
import {
  addDaysIso,
  buildCleanupInstallments,
  caughtUpThroughFromSelectedKeys,
  cleanupExtensionClauseText,
  cleanupMonthsFromSelectedPeriods,
  cleanupPaymentPlanText,
  cleanupWrapUpLengthText,
  cleanupWrapUpText,
  cleanupWeeksBetween,
  defaultWrapUpDate,
  monthlyStartLengthText,
  monthlyStartText,
  monthsBetween,
  normalizeCleanupPlan,
  readCleanupInstallments,
  readCleanupPlan,
  refreshCleanupPlanAtSelection,
  type CleanupPlan,
} from "./cleanupPlan";

const PLAN: CleanupPlan = {
  caughtUpThrough: "2026-06",
  startDate: "2026-01-15",
  wrapUpDate: "2026-04-15",
  wrapUpSource: "default",
  paymentPlan: "monthly",
};

describe("defaultWrapUpDate", () => {
  it("takes the later of 30 days vs ceil(backlog / 3) months", () => {
    // Jan 15 + 1 calendar month (Feb 15) beats +30 days (Feb 14).
    expect(defaultWrapUpDate("2026-01-15", 2)).toBe("2026-02-15");
    // Zero backlog: 0 months loses to +30 days.
    expect(defaultWrapUpDate("2026-01-15", 0)).toBe("2026-02-14");
    // Feb 1 + 1 calendar month (Mar 1) loses to +30 days (Mar 3).
    expect(defaultWrapUpDate("2026-02-01", 2)).toBe("2026-03-03");
  });
  it("uses ceil(backlog / 3) calendar months for larger backlogs", () => {
    expect(defaultWrapUpDate("2026-01-15", 6)).toBe("2026-03-15");
    expect(defaultWrapUpDate("2026-01-15", 7)).toBe("2026-04-15");
    expect(defaultWrapUpDate("2026-01-15", 12)).toBe("2026-05-15");
  });
  it("takes the later of 30 days vs calendar months", () => {
    // 1 calendar month from Feb 1 is Feb 28 (27 days) — 30 days wins.
    expect(defaultWrapUpDate("2026-02-01", 3)).toBe("2026-03-03");
  });
  it("is month-end safe", () => {
    expect(defaultWrapUpDate("2026-01-31", 3)).toBe("2026-03-02");
    // Leap year: Jan 31 + 1 month -> Feb 29, but 30 days is later.
    expect(defaultWrapUpDate("2024-01-31", 3)).toBe("2024-03-01");
  });
});

describe("normalizeCleanupPlan", () => {
  it("derives start from proposal date + 14 days and defaults the wrap-up", () => {
    const plan = normalizeCleanupPlan(null, { backlogMonths: 6, proposalDate: "2026-01-01" });
    expect(plan).toEqual({
      caughtUpThrough: "",
      startDate: "2026-01-15",
      wrapUpDate: "2026-03-15",
      wrapUpSource: "default",
      paymentPlan: "monthly",
    });
  });
  it("keeps a valid override on or after the start", () => {
    const plan = normalizeCleanupPlan(
      { caughtUpThrough: "2026-06", wrapUpDate: "2026-05-01", paymentPlan: "split_50_50" },
      { backlogMonths: 6, proposalDate: "2026-01-01" },
    );
    expect(plan.wrapUpDate).toBe("2026-05-01");
    expect(plan.wrapUpSource).toBe("override");
    expect(plan.paymentPlan).toBe("split_50_50");
    expect(plan.caughtUpThrough).toBe("2026-06");
  });
  it("rejects overrides before the start and junk payment plans", () => {
    const plan = normalizeCleanupPlan(
      { wrapUpDate: "2026-01-10", paymentPlan: "weekly", caughtUpThrough: "June" },
      { backlogMonths: 6, proposalDate: "2026-01-01" },
    );
    expect(plan.wrapUpDate).toBe("2026-03-15");
    expect(plan.wrapUpSource).toBe("default");
    expect(plan.paymentPlan).toBe("monthly");
    expect(plan.caughtUpThrough).toBe("");
  });
  it("prefers an explicit approval date over proposal + 14", () => {
    const plan = normalizeCleanupPlan(null, {
      backlogMonths: 0,
      proposalDate: "2026-01-01",
      approvalDate: "2026-02-10",
    });
    expect(plan.startDate).toBe("2026-02-10");
    expect(plan.wrapUpDate).toBe("2026-03-12");
  });
});

describe("monthsBetween", () => {
  it("counts ceil calendar months with a floor of 1", () => {
    expect(monthsBetween("2026-01-15", "2026-01-15")).toBe(1);
    expect(monthsBetween("2026-01-15", "2026-02-14")).toBe(1);
    expect(monthsBetween("2026-01-15", "2026-02-16")).toBe(2);
    expect(monthsBetween("2026-01-15", "2026-04-15")).toBe(3);
    expect(monthsBetween("2026-04-15", "2026-01-15")).toBe(1);
  });
});

describe("buildCleanupInstallments", () => {
  it("splits monthly into equal parts with the last absorbing cents", () => {
    const parts = buildCleanupInstallments(1000, PLAN);
    expect(parts).toHaveLength(3);
    expect(parts.map((p) => p.amountCents)).toEqual([333, 333, 334]);
    expect(parts.reduce((sum, p) => sum + p.amountCents, 0)).toBe(1000);
    expect(parts.map((p) => p.due)).toEqual(["monthly", "monthly", "monthly"]);
    expect(parts.map((p) => p.dueDate)).toEqual(["2026-01-15", "2026-02-15", "2026-03-15"]);
  });
  it("handles the 1-month case as a single installment", () => {
    const parts = buildCleanupInstallments(900, { ...PLAN, paymentPlan: "monthly", wrapUpDate: "2026-01-20" });
    expect(parts).toEqual([
      { label: "Cleanup installment 1 of 1", amountCents: 900, due: "monthly", dueDate: "2026-01-15" },
    ]);
  });
  it("pays in full with one at-approval installment", () => {
    expect(buildCleanupInstallments(1000, { ...PLAN, paymentPlan: "full" })).toEqual([
      { label: "Cleanup payment in full", amountCents: 1000, due: "at-approval", dueDate: "2026-01-15" },
    ]);
  });
  it("splits 50/50 rounding the first half down", () => {
    const parts = buildCleanupInstallments(1001, { ...PLAN, paymentPlan: "split_50_50" });
    expect(parts.map((p) => p.amountCents)).toEqual([500, 501]);
    expect(parts.map((p) => p.due)).toEqual(["at-approval", "at-completion"]);
    expect(parts.reduce((sum, p) => sum + p.amountCents, 0)).toBe(1001);
  });
});

describe("texts", () => {
  it("builds the wrap-up sentence", () => {
    expect(cleanupWrapUpText(PLAN)).toBe(
      "We will have your books caught up through June 2026 by April 15, 2026.",
    );
  });
  it("builds the monthly start rule and the 12-month variant", () => {
    expect(monthlyStartText({ hasCleanup: true, plan: PLAN })).toBe(
      "Monthly service and billing begin on April 15, 2026 or when cleanup is complete, whichever comes first.",
    );
    expect(monthlyStartText({ hasCleanup: true, plan: PLAN, prepaidAnnual: true })).toBe(
      "Your 12 months of service begin on April 15, 2026 or when cleanup is complete, whichever comes first.",
    );
  });
  it("describes each payment plan", () => {
    expect(cleanupPaymentPlanText(PLAN, buildCleanupInstallments(1000, PLAN))).toBe(
      "Cleanup is paid in 3 monthly installments of $3.33, with a final installment of $3.34.",
    );
    expect(cleanupPaymentPlanText({ ...PLAN, paymentPlan: "full" }, buildCleanupInstallments(1000, { ...PLAN, paymentPlan: "full" }))).toBe(
      "Cleanup is paid in full at approval: $10.00 due when cleanup is approved.",
    );
    expect(
      cleanupPaymentPlanText({ ...PLAN, paymentPlan: "split_50_50" }, buildCleanupInstallments(1000, { ...PLAN, paymentPlan: "split_50_50" })),
    ).toBe("Cleanup is split into two payments: $5.00 due at approval and $5.00 due when cleanup is complete.");
  });
  it("covers both delay directions and the no-stacking rule in one clause", () => {
    const clause = cleanupExtensionClauseText({ monthlyRate: 300, brandName: "Acme Books" });
    expect(clause).toContain("each month past the wrap-up date is billed at the monthly service rate");
    expect(clause).toContain("replaces the $150 file-maintenance fee");
    expect(clause).toContain("never charged together for the same month");
    expect(clause).toContain("If the delay is caused by Acme Books, there is no extra charge and the wrap-up date moves.");
  });
});

describe("cleanup length wording (pre-selection)", () => {
  it("rounds weeks up with a floor of 1", () => {
    expect(cleanupWeeksBetween("2026-01-15", "2026-01-15")).toBe(1);
    expect(cleanupWeeksBetween("2026-01-15", "2026-01-22")).toBe(1);
    expect(cleanupWeeksBetween("2026-01-15", "2026-01-23")).toBe(2);
    // Jan 15 -> Apr 15 is 90 days; Feb 14 -> May 14 is 89 days.
    expect(cleanupWeeksBetween("2026-01-15", "2026-04-15")).toBe(13);
    expect(cleanupWeeksBetween("2026-02-14", "2026-05-14")).toBe(13);
    // Junk and inverted ranges never read as zero weeks.
    expect(cleanupWeeksBetween("2026-05-14", "2026-02-14")).toBe(1);
    expect(cleanupWeeksBetween("nope", "2026-05-14")).toBe(1);
  });

  it("builds the wrap-up length sentence with the month and no calendar date", () => {
    expect(cleanupWrapUpLengthText(PLAN)).toBe(
      "We will have your books caught up through June 2026 about 13 weeks after you accept.",
    );
    expect(cleanupWrapUpLengthText({ ...PLAN, caughtUpThrough: "" })).toBe(
      "We will have your books caught up about 13 weeks after you accept.",
    );
  });

  it("uses the singular week for a short cleanup", () => {
    expect(cleanupWrapUpLengthText({ ...PLAN, startDate: "2026-01-15", wrapUpDate: "2026-01-18" })).toBe(
      "We will have your books caught up through June 2026 about 1 week after you accept.",
    );
  });

  it("builds the monthly start length rule for both terms", () => {
    expect(monthlyStartLengthText({ hasCleanup: true, plan: PLAN })).toBe(
      "Monthly service and billing begin about 13 weeks after you accept, or when cleanup is complete, whichever comes first.",
    );
    expect(monthlyStartLengthText({ hasCleanup: true, plan: PLAN, prepaidAnnual: true })).toBe(
      "Your 12 months of service begin about 13 weeks after you accept, or when cleanup is complete, whichever comes first.",
    );
  });

  it("reuses the legacy wording when no plan is present", () => {
    expect(monthlyStartLengthText({ hasCleanup: true })).toBe(monthlyStartText({ hasCleanup: true }));
    expect(monthlyStartLengthText({ hasCleanup: true, prepaidAnnual: true })).toBe(
      monthlyStartText({ hasCleanup: true, prepaidAnnual: true }),
    );
    expect(monthlyStartLengthText({ hasCleanup: false })).toBe(monthlyStartText({ hasCleanup: false }));
  });
});

describe("cleanupMonthsFromSelectedPeriods", () => {
  const periods = [
    { id: "a", year: 2025, startMonth: 1, endMonth: 3 },
    { id: "b", year: 2025, startMonth: 4, endMonth: 12 },
  ];
  it("sums selected periods inclusively", () => {
    expect(cleanupMonthsFromSelectedPeriods(periods, ["2025-1-3", "2025-4-12"])).toBe(12);
    expect(cleanupMonthsFromSelectedPeriods(periods, ["2025-1-3"])).toBe(3);
    expect(cleanupMonthsFromSelectedPeriods(periods, [])).toBe(0);
  });
  it("ignores unknown keys and invalid periods", () => {
    expect(cleanupMonthsFromSelectedPeriods(periods, ["nope"])).toBe(0);
    expect(
      cleanupMonthsFromSelectedPeriods([{ id: "x", year: 2025, startMonth: 9, endMonth: 5 }], ["x"]),
    ).toBe(0);
  });
});

describe("paymentSchedule with a cleanupPlan", () => {
  it("exposes the new start text and installments without changing the math", () => {
    const base = {
      cleanupMonths: 3,
      cleanupMonthlyRate: 300,
      onboardingFee: 560,
      recurringMonthlyTotal: 360,
      additionalOneTimeTotal: 65,
    };
    const withPlan = proposalPaymentSchedule({ ...base, cleanupPlan: PLAN });
    if (!("cleanupInstallments" in withPlan)) throw new Error("expected installments with a cleanupPlan");
    expect(withPlan.monthlyStartText).toBe(
      "Monthly service and billing begin on April 15, 2026 or when cleanup is complete, whichever comes first.",
    );
    expect(withPlan.cleanupInstallments.map((p) => p.amountCents)).toEqual([30000, 30000, 30000]);
    const { monthlyStartText, cleanupInstallments, ...rest } = withPlan;
    expect({ monthlyStartText, cleanupInstallments }).toBeDefined();
    expect(rest).toEqual(proposalPaymentSchedule(base));
  });
});

describe("readCleanupPlan / readCleanupInstallments (shared strict validators)", () => {
  const stored = {
    caughtUpThrough: "2026-03",
    startDate: "2026-02-15",
    wrapUpDate: "2026-04-15",
    wrapUpSource: "default",
    paymentPlan: "monthly",
  };
  const installments = [
    { label: "Cleanup installment 1 of 2", amountCents: 75000, due: "monthly", dueDate: "2026-02-15" },
    { label: "Cleanup installment 2 of 2", amountCents: 75000, due: "monthly", dueDate: "2026-03-15" },
  ];

  it("reads a well-formed stored plan and schedule", () => {
    expect(readCleanupPlan(stored)).toEqual(stored);
    expect(readCleanupInstallments(installments)).toEqual(installments);
  });

  it("preserves the staff-only adjustment flag but never invents it", () => {
    expect(readCleanupPlan({ ...stored, wrapUpAdjustedAtSelection: true }))
      .toMatchObject({ wrapUpAdjustedAtSelection: true });
    expect(readCleanupPlan({ ...stored, wrapUpAdjustedAtSelection: "yes" }))
      .not.toHaveProperty("wrapUpAdjustedAtSelection");
  });

  it("rejects impossible calendar dates that pass a format check", () => {
    // Feb 30 passes a bare ISO-format regex but is not a real date.
    expect(readCleanupPlan({ ...stored, wrapUpDate: "2026-02-30" })).toBeNull();
    expect(readCleanupPlan({ ...stored, caughtUpThrough: "2026-13" })).toBeNull();
    expect(readCleanupInstallments([{ ...installments[0], dueDate: "2026-02-30" }])).toBeNull();
  });

  it("rejects negative amounts, unknown dues, and non-objects", () => {
    expect(readCleanupPlan({ bogus: true })).toBeNull();
    expect(readCleanupPlan(null)).toBeNull();
    expect(readCleanupInstallments([{ ...installments[0], amountCents: -5 }])).toBeNull();
    expect(readCleanupInstallments([{ ...installments[0], due: "weekly" }])).toBeNull();
    expect(readCleanupInstallments([])).toBeNull();
    expect(readCleanupInstallments(["nope"])).toBeNull();
  });
});

describe("caughtUpThroughFromSelectedKeys", () => {
  it("takes the end month of the latest selected period", () => {
    expect(caughtUpThroughFromSelectedKeys(["2026-1-3", "2025-11-12"])).toBe("2026-03");
    expect(caughtUpThroughFromSelectedKeys(["2025-11-12"])).toBe("2025-12");
    expect(caughtUpThroughFromSelectedKeys([])).toBe("");
    expect(caughtUpThroughFromSelectedKeys(["junk", "2025-13-40"])).toBe("");
  });
});

describe("refreshCleanupPlanAtSelection", () => {
  const stored = {
    caughtUpThrough: "2026-03",
    startDate: "2026-02-14",
    wrapUpDate: "2026-05-14",
    wrapUpSource: "default",
    paymentPlan: "monthly",
  };

  it("starts at selection + 14 days and recomputes a default wrap-up", () => {
    const plan = refreshCleanupPlanAtSelection(stored, {
      backlogMonths: 5,
      selectedKeys: ["2026-1-3", "2025-11-12"],
      todayISO: "2026-02-01",
    });
    expect(plan).toEqual({
      caughtUpThrough: "2026-03",
      startDate: addDaysIso("2026-02-01", 14),
      wrapUpDate: defaultWrapUpDate(addDaysIso("2026-02-01", 14), 5),
      wrapUpSource: "default",
      paymentPlan: "monthly",
    });
  });

  it("recomputes caught-up-through from the selected periods", () => {
    const plan = refreshCleanupPlanAtSelection(stored, {
      backlogMonths: 2,
      selectedKeys: ["2025-11-12"],
      todayISO: "2026-02-01",
    });
    expect(plan.caughtUpThrough).toBe("2025-12");
  });

  it("keeps an override on/after start + 30 days and resets a stale one flagged", () => {
    const keep = refreshCleanupPlanAtSelection(
      { ...stored, wrapUpSource: "override", wrapUpDate: "2026-09-01" },
      { backlogMonths: 5, selectedKeys: ["2026-1-3"], todayISO: "2026-02-01" },
    );
    expect(keep).toMatchObject({ wrapUpSource: "override", wrapUpDate: "2026-09-01" });
    expect(keep).not.toHaveProperty("wrapUpAdjustedAtSelection");

    const stale = refreshCleanupPlanAtSelection(
      { ...stored, wrapUpSource: "override", wrapUpDate: "2026-03-01" },
      { backlogMonths: 5, selectedKeys: ["2026-1-3"], todayISO: "2026-02-01" },
    );
    expect(stale.wrapUpSource).toBe("default");
    expect(stale.wrapUpDate).toBe(defaultWrapUpDate(addDaysIso("2026-02-01", 14), 5));
    expect(stale.wrapUpAdjustedAtSelection).toBe(true);
  });
});
