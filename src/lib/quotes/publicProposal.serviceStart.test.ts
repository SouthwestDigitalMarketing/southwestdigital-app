import { describe, expect, it } from "vitest";
import {
  publicCreditCarryoverForCheckout,
  publicFirstPaymentCreditReasonForSnapshot,
  publicServiceStartMonthForSnapshot,
  toPublicBookkeepingProposal,
} from "./publicProposal";

const pricing = { maintain: { monthly: 500 }, improve: { monthly: 600 }, grow: { monthly: 750 } };

describe("spec 06 public whitelist", () => {
  it("publishes the start month and credit reason", () => {
    expect(publicServiceStartMonthForSnapshot({
      assessment: { serviceStartMonth: "2026-12" }, pricing,
    })).toBe("2026-12");
    expect(publicFirstPaymentCreditReasonForSnapshot({
      assessment: { firstPaymentCreditReason: "  Credit for October work already paid  " }, pricing,
    })).toBe("Credit for October work already paid");
    const result = toPublicBookkeepingProposal({
      assessment: {
        serviceStartMonth: "2026-12",
        firstPaymentCredit: 1500,
        firstPaymentCreditReason: "Credit for October work already paid",
      },
      pricing,
    });
    expect(result.assessment).toMatchObject({
      serviceStartMonth: "2026-12",
      firstPaymentCredit: 1500,
      firstPaymentCreditReason: "Credit for October work already paid",
    });
  });

  it("publishes nothing for legacy snapshots and strips junk", () => {
    expect(publicServiceStartMonthForSnapshot({ assessment: {}, pricing })).toBeNull();
    expect(publicServiceStartMonthForSnapshot({ assessment: { serviceStartMonth: "October" }, pricing })).toBeNull();
    expect(publicFirstPaymentCreditReasonForSnapshot({ assessment: {}, pricing })).toBeNull();
    expect(publicFirstPaymentCreditReasonForSnapshot({ assessment: { firstPaymentCreditReason: "   " }, pricing })).toBeNull();
    const result = toPublicBookkeepingProposal({
      assessment: { serviceStartMonth: "October", firstPaymentCreditReason: 7 },
      pricing,
    });
    expect(result.assessment).not.toHaveProperty("serviceStartMonth");
    expect(result.assessment).not.toHaveProperty("firstPaymentCreditReason");
    expect(JSON.stringify(result)).not.toContain("October");
  });

  it("exposes only the remaining-credit amount and reason from a stored checkout", () => {
    expect(publicCreditCarryoverForCheckout({
      creditApplied: 1100,
      amountDueBeforeCredit: 1100,
      amountDueNow: 0,
      creditRemaining: 400,
      creditRemainingReason: "Credit for October work already paid",
    })).toEqual({
      creditRemaining: 400,
      creditRemainingReason: "Credit for October work already paid",
    });
    // Nothing internal crosses — and nothing at all without a remainder.
    expect(publicCreditCarryoverForCheckout({ creditApplied: 300, amountDueNow: 800 })).toBeNull();
    expect(publicCreditCarryoverForCheckout(null)).toBeNull();
  });
});
