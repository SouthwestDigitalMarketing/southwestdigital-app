import { describe, expect, it } from "vitest";
import { resolvePreviewCleanupDisplay } from "./previewCleanupPlan";

const staffPlan = {
  caughtUpThrough: "2026-03",
  startDate: "2026-02-14",
  wrapUpDate: "2026-05-14",
  wrapUpSource: "default",
  paymentPlan: "monthly",
} as const;

const storedInstallments = [
  { label: "Cleanup installment 1 of 2", amountCents: 75000, due: "monthly" as const },
  { label: "Cleanup installment 2 of 2", amountCents: 75000, due: "monthly" as const },
];

const base = {
  hasCleanup: true,
  livePublic: false,
  staffCleanupPlan: staffPlan,
  selectedCleanupMonths: 5,
  selectedCleanupTotal: 1500,
};

describe("spec 04 preview cleanup display", () => {
  it("stays legacy without cleanup or without any plan", () => {
    expect(resolvePreviewCleanupDisplay({ ...base, hasCleanup: false })).toEqual({ plan: null, installments: [], isEstimate: false });
    expect(resolvePreviewCleanupDisplay({ ...base, staffCleanupPlan: null })).toEqual({ plan: null, installments: [], isEstimate: false });
    expect(resolvePreviewCleanupDisplay({ ...base, staffCleanupPlan: "monthly" })).toEqual({ plan: null, installments: [], isEstimate: false });
  });

  it("normalizes the staff snapshot plan and cuts installments from the displayed total", () => {
    const result = resolvePreviewCleanupDisplay(base);
    expect(result.isEstimate).toBe(false);
    expect(result.plan).toMatchObject({ caughtUpThrough: "2026-03", wrapUpDate: "2026-05-14", paymentPlan: "monthly" });
    expect(result.installments).toHaveLength(3);
    const sum = result.installments.reduce((total, item) => total + item.amountCents, 0);
    expect(sum).toBe(150000);
  });

  it("prefers the stored checkout plan and its frozen installments", () => {
    const checkoutPlan = { ...staffPlan, paymentPlan: "full" as const };
    const result = resolvePreviewCleanupDisplay({
      ...base,
      checkoutCleanupPlan: checkoutPlan,
      checkoutInstallments: [{ label: "Cleanup payment in full", amountCents: 150000, due: "at-approval" as const }],
    });
    expect(result.plan?.paymentPlan).toBe("full");
    expect(result.installments).toEqual([
      { label: "Cleanup payment in full", amountCents: 150000, due: "at-approval" },
    ]);
  });

  it("falls back to the frozen installments only with a plan present", () => {
    // Stored installments without a stored plan still resolve against the
    // staff plan (both are written together); nothing fabricates a plan.
    const withStaff = resolvePreviewCleanupDisplay({
      ...base,
      checkoutInstallments: storedInstallments,
    });
    expect(withStaff.plan?.paymentPlan).toBe("monthly");
    expect(withStaff.installments).toEqual(storedInstallments);

    const withoutAny = resolvePreviewCleanupDisplay({
      ...base,
      staffCleanupPlan: null,
      checkoutInstallments: storedInstallments,
    });
    expect(withoutAny).toEqual({ plan: null, installments: [], isEstimate: false });
  });

  it("builds the public display from the whitelisted plan without a start date", () => {
    const result = resolvePreviewCleanupDisplay({
      hasCleanup: true,
      livePublic: true,
      staffCleanupPlan: staffPlan,
      publicCleanupPlan: {
        caughtUpThrough: "2026-03",
        wrapUpDate: "2026-05-14",
        wrapUpWeeks: 13,
        paymentPlan: "split_50_50",
        installments: [
          { label: "one", amountCents: 75000, due: "at-approval" },
          { label: "two", amountCents: 75000, due: "at-completion" },
        ],
      },
      selectedCleanupMonths: 5,
      selectedCleanupTotal: 1500,
    });
    // The staff plan is invisible on the public page; the public plan wins.
    expect(result.plan).toMatchObject({ paymentPlan: "split_50_50", wrapUpDate: "2026-05-14" });
    // Pre-selection the public full-scope terms are labelled as an estimate.
    expect(result.isEstimate).toBe(true);
    expect(result.installments).toEqual([
      { label: "one", amountCents: 75000, due: "at-approval" },
      { label: "two", amountCents: 75000, due: "at-completion" },
    ]);
  });

  it("ignores the public plan on the staff preview and vice versa", () => {
    const staffOnly = resolvePreviewCleanupDisplay({ ...base, publicCleanupPlan: null });
    expect(staffOnly.plan?.paymentPlan).toBe("monthly");

    const publicOnly = resolvePreviewCleanupDisplay({
      ...base,
      livePublic: true,
      publicCleanupPlan: null,
    });
    expect(publicOnly).toEqual({ plan: null, installments: [], isEstimate: false });
  });
});
