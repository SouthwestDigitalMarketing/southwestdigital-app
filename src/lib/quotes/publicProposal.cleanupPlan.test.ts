import { describe, expect, it } from "vitest";
import {
  publicCleanupPlanForSnapshot,
  storedCleanupPlanInputForSnapshot,
  storedComplexityCleanupPerMonthForSnapshot,
  toPublicBookkeepingProposal,
} from "./publicProposal";

const pricing = { maintain: { monthly: 300 }, improve: { monthly: 450 }, grow: { monthly: 600 } };

const planSnapshot = {
  assessment: {
    historicalCleanupPeriods: [
      { id: "2026", year: 2026, startMonth: 1, endMonth: 3 },
      { id: "2025", year: 2025, startMonth: 11, endMonth: 12 },
    ],
    cleanupPlan: {
      caughtUpThrough: "2026-03",
      startDate: "2026-02-14",
      wrapUpDate: "2026-05-14",
      wrapUpSource: "default",
      paymentPlan: "monthly",
    },
  },
  pricing,
};

describe("spec 04 public cleanup plan", () => {
  it("publishes only the whitelisted plan shape", () => {
    expect(publicCleanupPlanForSnapshot(planSnapshot)).toEqual({
      caughtUpThrough: "2026-03",
      wrapUpDate: "2026-05-14",
      // Feb 14 -> May 14 is 89 days, rounded up to whole weeks.
      wrapUpWeeks: 13,
      paymentPlan: "monthly",
      installments: [
        { label: "Cleanup installment 1 of 3", amountCents: 50000, due: "monthly" },
        { label: "Cleanup installment 2 of 3", amountCents: 50000, due: "monthly" },
        { label: "Cleanup installment 3 of 3", amountCents: 50000, due: "monthly" },
      ],
    });
  });

  it("keeps every internal field out of the published payload", () => {
    const result = toPublicBookkeepingProposal(planSnapshot);
    const serialized = JSON.stringify(result);
    expect(serialized).not.toContain("startDate");
    expect(serialized).not.toContain("wrapUpSource");
    expect(serialized).not.toContain("dueDate");
    expect(serialized).not.toContain("2026-02-14");
    expect(result).toHaveProperty("cleanupPlan");
  });

  it("returns null for snapshots without a plan and adds no key", () => {
    expect(publicCleanupPlanForSnapshot({ assessment: {}, pricing })).toBeNull();
    expect(publicCleanupPlanForSnapshot({ assessment: { cleanupPlan: "monthly" }, pricing })).toBeNull();
    const result = toPublicBookkeepingProposal({ assessment: {}, pricing });
    expect(result).not.toHaveProperty("cleanupPlan");
  });

  it("scales the installment preview with the complexity add", () => {
    const result = publicCleanupPlanForSnapshot({
      assessment: planSnapshot.assessment,
      pricing: {
        maintain: {
          monthly: 300,
          complexity: { lines: [], monthlyTotal: 0, cleanupPerMonthTotal: 65, cleanupTotal: 325 },
        },
        improve: { monthly: 450 },
        grow: { monthly: 600 },
      },
    });
    const sum = (result?.installments ?? []).reduce((total, item) => total + item.amountCents, 0);
    // 5 months x (300 + 65).
    expect(sum).toBe(182500);
  });

  it("previews pay-in-full and 50-50 plans", () => {
    const full = publicCleanupPlanForSnapshot({
      assessment: { ...planSnapshot.assessment, cleanupPlan: { ...planSnapshot.assessment.cleanupPlan, paymentPlan: "full" } },
      pricing,
    });
    expect(full?.installments).toHaveLength(1);
    expect(full?.installments[0]).toMatchObject({ amountCents: 150000, due: "at-approval" });

    const split = publicCleanupPlanForSnapshot({
      assessment: { ...planSnapshot.assessment, cleanupPlan: { ...planSnapshot.assessment.cleanupPlan, paymentPlan: "split_50_50" } },
      pricing,
    });
    expect(split?.installments).toHaveLength(2);
    const sum = (split?.installments ?? []).reduce((total, item) => total + item.amountCents, 0);
    expect(sum).toBe(150000);
  });
});

describe("select reconstruction whitelists", () => {
  it("carries the five plan fields and nothing else", () => {
    expect(storedCleanupPlanInputForSnapshot(planSnapshot)).toEqual({
      caughtUpThrough: "2026-03",
      startDate: "2026-02-14",
      wrapUpDate: "2026-05-14",
      wrapUpSource: "default",
      paymentPlan: "monthly",
    });
    expect(storedCleanupPlanInputForSnapshot({ assessment: {}, pricing })).toBeNull();
    expect(storedCleanupPlanInputForSnapshot({ assessment: { cleanupPlan: "monthly" }, pricing })).toBeNull();
  });

  it("carries the complexity cleanup rate or zero", () => {
    expect(storedComplexityCleanupPerMonthForSnapshot({
      assessment: planSnapshot.assessment,
      pricing: {
        maintain: { monthly: 300, complexity: { lines: [], monthlyTotal: 0, cleanupPerMonthTotal: 65, cleanupTotal: 325 } },
        improve: { monthly: 450 },
        grow: { monthly: 600 },
      },
    })).toBe(65);
    expect(storedComplexityCleanupPerMonthForSnapshot(planSnapshot)).toBe(0);
    expect(storedComplexityCleanupPerMonthForSnapshot({})).toBe(0);
  });

  it("never publishes the staff-only adjustment flag", () => {
    const flagged = {
      assessment: {
        ...planSnapshot.assessment,
        cleanupPlan: { ...planSnapshot.assessment.cleanupPlan, wrapUpAdjustedAtSelection: true },
      },
      pricing,
    };
    const serialized = JSON.stringify(toPublicBookkeepingProposal(flagged));
    expect(serialized).not.toContain("wrapUpAdjustedAtSelection");
  });
});
