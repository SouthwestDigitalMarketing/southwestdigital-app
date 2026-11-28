import { describe, expect, it } from "vitest";
import { buildCleanupInstallments } from "@/lib/quotes/cleanupPlan";
import {
  buildProposalCheckoutSummary,
  parseStoredProposalCheckout,
} from "./proposalCheckout";

const periods = [
  { year: 2026, startMonth: 1, endMonth: 3 },
  { year: 2025, startMonth: 11, endMonth: 12 },
];

const snapshot = {
  assessment: {
    annualSavingsPercent: 20,
    waiveOnboardingFee: false,
    onboardingFeeOverride: null,
    historicalCleanupPeriods: periods,
    additionalOptions: [],
  },
  pricing: {
    maintain: { monthly: 300 },
    improve: { monthly: 450 },
    grow: { monthly: 600 },
  },
};

const storedPlan = {
  caughtUpThrough: "2026-03",
  startDate: "2026-02-14",
  wrapUpDate: "2026-05-14",
  wrapUpSource: "default",
  paymentPlan: "monthly",
} as const;

function snapshotWithPlan(paymentPlan: string = "monthly") {
  return {
    ...snapshot,
    assessment: {
      ...snapshot.assessment,
      cleanupPlan: { ...storedPlan, paymentPlan },
    },
  };
}

const selection = {
  tier: "improve" as const,
  hasTwelveMonthAgreement: false,
  selectedCleanupPeriodKeys: ["2026-1-3", "2025-11-12"],
  selectedAdditionalOptionIds: [] as string[],
};

describe("spec 04 checkout cleanup plan", () => {
  it("stores no plan keys without a snapshot plan, even with cleanup selected", () => {
    const result = buildProposalCheckoutSummary(snapshot, selection);
    expect(result.cleanupMonths).toBe(5);
    expect(result).not.toHaveProperty("cleanupPlan");
    expect(result).not.toHaveProperty("cleanupInstallments");
  });

  it("stores the plan and installments summing to the cleanup total", () => {
    const result = buildProposalCheckoutSummary(snapshotWithPlan(), selection, { todayISO: "2026-02-01" });
    expect(result.cleanupMonths).toBe(5);
    expect(result.cleanupTotal).toBe(1500);
    expect(result.cleanupPlan).toEqual({
      caughtUpThrough: "2026-03",
      startDate: "2026-02-15",
      wrapUpDate: "2026-04-15",
      wrapUpSource: "default",
      paymentPlan: "monthly",
    });
    expect(result.cleanupInstallments).toEqual(
      buildCleanupInstallments(150000, result.cleanupPlan!),
    );
    const sum = (result.cleanupInstallments ?? []).reduce((total, item) => total + item.amountCents, 0);
    expect(sum).toBe(150000);
    // Installment due dates follow the refreshed start, not the stale builder start.
    expect(result.cleanupInstallments?.[0]).toMatchObject({ dueDate: "2026-02-15" });
  });

  it("recomputes caught-up-through from a partial selection", () => {
    const result = buildProposalCheckoutSummary(snapshotWithPlan(), {
      ...selection,
      selectedCleanupPeriodKeys: ["2025-11-12"],
    }, { todayISO: "2026-02-01" });
    expect(result.cleanupMonths).toBe(2);
    // The snapshot claims March; the client only selected Nov-Dec.
    expect(result.cleanupPlan).toMatchObject({ caughtUpThrough: "2025-12" });
  });

  it("keeps a far-future override and resets a stale one with the flag", () => {
    const kept = buildProposalCheckoutSummary(snapshotWithPlan(), selection, { todayISO: "2026-02-01" });
    expect(kept.cleanupPlan).toMatchObject({ wrapUpSource: "default" });
    expect(kept.cleanupPlan).not.toHaveProperty("wrapUpAdjustedAtSelection");

    const overrideSnap = {
      ...snapshotWithPlan(),
      assessment: {
        ...snapshotWithPlan().assessment,
        cleanupPlan: {
          caughtUpThrough: "2026-03",
          startDate: "2026-02-14",
          wrapUpDate: "2026-03-01",
          wrapUpSource: "override",
          paymentPlan: "monthly",
        },
      },
    };
    // An override this close to the new start (2026-02-15 + 30 days) is
    // stale, so it resets to the default and is flagged for staff.
    const reset = buildProposalCheckoutSummary(overrideSnap, selection, { todayISO: "2026-02-01" });
    expect(reset.cleanupPlan).toMatchObject({
      startDate: "2026-02-15",
      wrapUpSource: "default",
      wrapUpAdjustedAtSelection: true,
    });
    expect(reset.cleanupPlan?.wrapUpDate).toBe("2026-04-15");

    // An override past new start + 30 days survives the selection.
    const farSnap = {
      ...snapshotWithPlan(),
      assessment: {
        ...snapshotWithPlan().assessment,
        cleanupPlan: {
          caughtUpThrough: "2026-03",
          startDate: "2026-02-14",
          wrapUpDate: "2026-09-01",
          wrapUpSource: "override",
          paymentPlan: "monthly",
        },
      },
    };
    const far = buildProposalCheckoutSummary(farSnap, selection, { todayISO: "2026-02-01" });
    expect(far.cleanupPlan).toMatchObject({
      startDate: "2026-02-15",
      wrapUpDate: "2026-09-01",
      wrapUpSource: "override",
    });
    expect(far.cleanupPlan).not.toHaveProperty("wrapUpAdjustedAtSelection");
  });

  it("keeps amountDueNow identical with and without a plan", () => {
    const without = buildProposalCheckoutSummary(snapshot, selection);
    const withPlan = buildProposalCheckoutSummary(snapshotWithPlan(), selection);
    expect(withPlan.amountDueNow).toBe(without.amountDueNow);
    expect(withPlan.oneTimeTotal).toBe(without.oneTimeTotal);
    expect(withPlan.chargeKind).toBe(without.chargeKind);
  });

  it("stores no plan keys when no cleanup months are selected", () => {
    const result = buildProposalCheckoutSummary(snapshotWithPlan(), { ...selection, selectedCleanupPeriodKeys: [] });
    expect(result.cleanupMonths).toBe(0);
    expect(result).not.toHaveProperty("cleanupPlan");
    expect(result).not.toHaveProperty("cleanupInstallments");
  });

  it("counts only selected periods under a plan", () => {
    const result = buildProposalCheckoutSummary(snapshotWithPlan(), {
      ...selection,
      selectedCleanupPeriodKeys: ["2025-11-12"],
    });
    expect(result.cleanupMonths).toBe(2);
    expect(result.cleanupTotal).toBe(600);
    const sum = (result.cleanupInstallments ?? []).reduce((total, item) => total + item.amountCents, 0);
    expect(sum).toBe(60000);
  });

  it("cuts pay-in-full and 50-50 schedules from the same total", () => {
    const full = buildProposalCheckoutSummary(snapshotWithPlan("full"), selection);
    expect(full.cleanupInstallments).toHaveLength(1);
    expect(full.cleanupInstallments?.[0]).toMatchObject({ amountCents: 150000, due: "at-approval" });

    const split = buildProposalCheckoutSummary(snapshotWithPlan("split_50_50"), selection);
    expect(split.cleanupInstallments).toHaveLength(2);
    const sum = (split.cleanupInstallments ?? []).reduce((total, item) => total + item.amountCents, 0);
    expect(sum).toBe(150000);
    expect(split.cleanupInstallments?.[1].due).toBe("at-completion");
  });

  it("folds the complexity cleanup add into the stored installments", () => {
    const complex = {
      ...snapshotWithPlan(),
      assessment: { ...snapshotWithPlan().assessment },
      pricing: {
        maintain: {
          monthly: 300,
          complexity: { lines: [], monthlyTotal: 0, cleanupPerMonthTotal: 65, cleanupTotal: 325 },
        },
        improve: { monthly: 450 },
        grow: { monthly: 600 },
      },
    };
    const result = buildProposalCheckoutSummary(complex, {
      ...selection,
      selectedCleanupPeriodKeys: ["2026-1-3"],
    });
    expect(result.cleanupTotal).toBe(900 + 195);
    const sum = (result.cleanupInstallments ?? []).reduce((total, item) => total + item.amountCents, 0);
    expect(sum).toBe(109500);
  });

  it("round-trips the stored plan through parseStoredProposalCheckout", () => {
    const result = buildProposalCheckoutSummary(snapshotWithPlan(), selection);
    expect(parseStoredProposalCheckout(JSON.parse(JSON.stringify(result)))).toEqual(result);
  });

  it("drops a malformed stored plan but keeps the checkout", () => {
    const result = buildProposalCheckoutSummary(snapshotWithPlan(), selection);
    const stored = JSON.parse(JSON.stringify(result)) as Record<string, unknown>;
    stored.cleanupPlan = { ...storedPlan, paymentPlan: "weekly" };
    const parsed = parseStoredProposalCheckout(stored);
    expect(parsed?.cleanupTotal).toBe(1500);
    expect(parsed).not.toHaveProperty("cleanupPlan");
    expect(parsed).not.toHaveProperty("cleanupInstallments");
  });

  it("drops malformed stored installments but keeps the checkout", () => {
    const result = buildProposalCheckoutSummary(snapshotWithPlan(), selection);
    const stored = JSON.parse(JSON.stringify(result)) as Record<string, unknown>;
    stored.cleanupInstallments = [{ label: "x", amountCents: -5, due: "monthly" }];
    const parsed = parseStoredProposalCheckout(stored);
    expect(parsed?.cleanupTotal).toBe(1500);
    expect(parsed).not.toHaveProperty("cleanupInstallments");
  });

  it("leaves legacy stored checkouts without plan keys untouched", () => {
    const saved = {
      tier: "improve", tierLabel: "Improve", hasTwelveMonthAgreement: false,
      selectedCleanupPeriodKeys: ["2026-1-3"], selectedAdditionalOptionIds: [],
      baseMonthlyTotal: 450, recurringMonthlyTotal: 450, cleanupTotal: 900,
      onboardingFee: 560, oneTimeTotal: 560, amountDueNow: 560,
      chargeKind: "onboarding_and_discovery", selectionHash: "legacy-hash",
      paymentScheduleVersion: 2, cleanupMonths: 3, cleanupMonthlyRate: 300,
      additionalOneTimeTotal: 0, prepaidMonths: 1, includedServices: [],
    };
    expect(parseStoredProposalCheckout(saved)).toEqual(saved);
  });
});
