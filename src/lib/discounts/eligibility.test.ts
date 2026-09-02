import { describe, expect, it } from "vitest";
import { evaluateDiscountOffer, isLeadConvertedForDiscount } from "./eligibility";

const heldDiscount = {
  kind: "bonus",
  percent: 10,
  amount: 250,
  title: "First monthly close included",
  details: "We will complete the first monthly close at no extra charge.",
  activationMode: "held",
  activationDelayDays: 0,
  deadlineMode: "relative",
  durationDays: 14,
  deadlineDate: null,
};

const openDiscount = {
  ...heldDiscount,
  activationMode: "immediate",
};

describe("evaluateDiscountOffer", () => {
  it("stays hidden while held, even after they open the proposal", () => {
    expect(
      evaluateDiscountOffer(heldDiscount, {
        now: new Date(2026, 8, 10),
        publishedAt: new Date(2026, 8, 1),
        firstViewedAt: new Date(2026, 8, 2),
      }),
    ).toBeNull();
  });

  it("shows on first open when that is turned on", () => {
    const offer = evaluateDiscountOffer(openDiscount, {
      now: new Date(2026, 8, 1, 12),
      publishedAt: new Date(2026, 8, 1, 9),
      firstViewedAt: new Date(2026, 8, 1, 12),
    });
    expect(offer?.active).toBe(true);
    expect(offer?.headline).toContain("First monthly close included");
  });

  it("shows on first open even before firstViewedAt is stamped", () => {
    const offer = evaluateDiscountOffer(openDiscount, {
      now: new Date(2026, 8, 1, 12),
      publishedAt: new Date(2026, 8, 1, 9),
      firstViewedAt: null,
    });
    expect(offer?.active).toBe(true);
  });

  it("starts the window from present-later, not from the original send date", () => {
    const offer = evaluateDiscountOffer(
      { ...openDiscount, presentedAt: new Date(2026, 8, 20) },
      {
        now: new Date(2026, 8, 21, 12),
        publishedAt: new Date(2026, 8, 1),
      },
    );
    expect(offer?.active).toBe(true);
  });

  it("does not appear after they have converted", () => {
    expect(
      evaluateDiscountOffer(openDiscount, {
        now: new Date(2026, 8, 2),
        publishedAt: new Date(2026, 8, 1),
        converted: true,
      }),
    ).toBeNull();
  });

  it("treats legacy after-view discounts as held", () => {
    expect(
      evaluateDiscountOffer(
        { ...heldDiscount, activationMode: "after-view", activationDelayDays: 7 },
        {
          now: new Date(2026, 8, 20),
          publishedAt: new Date(2026, 8, 1),
          firstViewedAt: new Date(2026, 8, 2),
        },
      ),
    ).toBeNull();
  });
});

describe("isLeadConvertedForDiscount", () => {
  it("treats accepted quotes and signed engagements as converted", () => {
    expect(isLeadConvertedForDiscount({ quoteStatus: "sent" })).toBe(false);
    expect(isLeadConvertedForDiscount({ quoteStatus: "accepted" })).toBe(true);
    expect(isLeadConvertedForDiscount({ engagementStatus: "SENT_TO_CLIENT" })).toBe(false);
    expect(isLeadConvertedForDiscount({ engagementStatus: "SIGNED" })).toBe(true);
    expect(isLeadConvertedForDiscount({ engagementStatus: "DEPOSIT_PAID" })).toBe(true);
  });
});
