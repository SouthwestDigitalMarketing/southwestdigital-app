import { describe, expect, it } from "vitest";
import { isQuoteFrozen } from "./isQuoteFrozen";

describe("isQuoteFrozen", () => {
  it.each([
    { status: "accepted" }, { status: "SIGNED" }, { status: "PAID" },
    { engagement: { signedAt: new Date() } }, { engagement: { status: "SIGNED" } },
    { engagement: { onboardingFeeStatus: "PAID" } },
    { status: "sent", engagement: { onboardingData: { proposalAcceptance: { signedAt: "old" } } } },
  ])("freezes each independent acceptance signal: %j", (value) => expect(isQuoteFrozen(value)).toBe(true));
  it.each([null, {}, { engagement: { onboardingFeeStatus: "WAIVED" } }, { status: "draft" }, { status: "sent", engagement: { signedAt: null, onboardingFeeStatus: "REQUIRED" } }])(
    "leaves unaccepted offers available: %j", (value) => expect(isQuoteFrozen(value)).toBe(false),
  );
});
