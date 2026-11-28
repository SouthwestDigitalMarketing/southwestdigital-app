import { describe, expect, it } from "vitest";
import { normalizeCleanupPlan } from "@/lib/quotes/cleanupPlan";
import {
  cleanupBacklogMonths,
  ensureCleanupPlan,
  lastCleanupPeriodEnd,
  nextCleanupPlanOnPeriodsChange,
  refreshCleanupPlanForPeriods,
  resetCleanupWrapUp,
  setCleanupPaymentPlan,
  setCleanupWrapUpOverride,
} from "./cleanupPlanState";

const periods = [
  { year: 2026, startMonth: 1, endMonth: 3 },
  { year: 2025, startMonth: 11, endMonth: 12 },
];

describe("spec 04 builder cleanup plan state", () => {
  it("sums backlog months and reads the last period end", () => {
    expect(cleanupBacklogMonths(periods)).toBe(5);
    expect(lastCleanupPeriodEnd(periods)).toBe("2026-03");
    expect(lastCleanupPeriodEnd([])).toBe("");
    expect(lastCleanupPeriodEnd([{ year: 2026, startMonth: 5, endMonth: 2 }])).toBe("");
  });

  it("creates a plan only for newly configured cleanup", () => {
    // No periods at all: nothing to plan, even when behind.
    expect(nextCleanupPlanOnPeriodsChange(undefined, [], { booksOverTwoMonthsBehind: true })).toBeNull();
    // Periods edited while not behind: still no plan.
    expect(nextCleanupPlanOnPeriodsChange(undefined, periods, { booksOverTwoMonthsBehind: false })).toBeNull();
    // Periods configured while behind: a plan is created.
    const created = nextCleanupPlanOnPeriodsChange(undefined, periods, {
      booksOverTwoMonthsBehind: true,
      todayISO: "2026-02-01",
    });
    expect(created).toEqual(
      normalizeCleanupPlan({ caughtUpThrough: "2026-03" }, { backlogMonths: 5, todayISO: "2026-02-01" }),
    );
    expect(created?.wrapUpSource).toBe("default");
    expect(created?.paymentPlan).toBe("monthly");
  });

  it("never creates or heals a plan on mere refresh", () => {
    expect(refreshCleanupPlanForPeriods(null, periods)).toBeNull();
    expect(refreshCleanupPlanForPeriods(undefined, periods)).toBeNull();
  });

  it("refresh follows the periods and recomputes the default", () => {
    const plan = ensureCleanupPlan(null, periods, { todayISO: "2026-02-01" });
    const before = plan.wrapUpDate;
    const refreshed = refreshCleanupPlanForPeriods(
      plan,
      [...periods, { year: 2024, startMonth: 1, endMonth: 12 }],
      { todayISO: "2026-02-01" },
    );
    expect(refreshed?.caughtUpThrough).toBe("2026-03");
    // 17 months backlog: ceil(17/3) = 6 months beats 30 days.
    expect(refreshed?.wrapUpDate).not.toBe(before);
    expect(refreshed?.wrapUpDate).toBe("2026-08-01");
    expect(refreshed?.wrapUpSource).toBe("default");
  });

  it("refresh keeps a staff override and start date", () => {
    const plan = ensureCleanupPlan(null, periods, { todayISO: "2026-02-01" });
    const overridden = setCleanupWrapUpOverride(plan, "2026-09-30", periods);
    expect(overridden.wrapUpSource).toBe("override");
    const refreshed = refreshCleanupPlanForPeriods(
      overridden,
      [...periods, { year: 2024, startMonth: 1, endMonth: 12 }],
      { todayISO: "2026-02-01" },
    );
    expect(refreshed?.wrapUpDate).toBe("2026-09-30");
    expect(refreshed?.wrapUpSource).toBe("override");
    expect(refreshed?.startDate).toBe(plan.startDate);
  });

  it("drops the plan when the last period is removed", () => {
    const plan = ensureCleanupPlan(null, periods, { todayISO: "2026-02-01" });
    expect(refreshCleanupPlanForPeriods(plan, [])).toBeNull();
    expect(nextCleanupPlanOnPeriodsChange(plan, [], { booksOverTwoMonthsBehind: true })).toBeNull();
  });

  it("commits valid override dates and ignores the rest", () => {
    const plan = ensureCleanupPlan(null, periods, { todayISO: "2026-02-01" });
    expect(setCleanupWrapUpOverride(plan, "2026-09-30", periods).wrapUpDate).toBe("2026-09-30");
    expect(setCleanupWrapUpOverride(plan, "not-a-date", periods)).toBe(plan);
    expect(setCleanupWrapUpOverride(plan, "2026-01-01", periods)).toBe(plan);
  });

  it("resets an override back to the default", () => {
    const plan = ensureCleanupPlan(null, periods, { todayISO: "2026-02-01" });
    const overridden = setCleanupWrapUpOverride(plan, "2026-09-30", periods);
    expect(resetCleanupWrapUp(overridden, periods)).toEqual(plan);
  });

  it("changes the payment plan and keeps unknown values out", () => {
    const plan = ensureCleanupPlan(null, periods, { todayISO: "2026-02-01" });
    expect(setCleanupPaymentPlan(plan, "full", periods).paymentPlan).toBe("full");
    expect(setCleanupPaymentPlan(plan, "split_50_50", periods).paymentPlan).toBe("split_50_50");
    expect(setCleanupPaymentPlan(plan, "weekly", periods)).toBe(plan);
  });
});
