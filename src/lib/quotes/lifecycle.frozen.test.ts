import type { PrismaClient } from "@prisma/client";
import { describe, expect, it, vi } from "vitest";
import { bumpQuoteActivity, deriveLifecycleStage, markQuoteFollowUpSent, nextStaffAction } from "./lifecycle";

describe("frozen lifecycle", () => {
  it.each([bumpQuoteActivity, markQuoteFollowUpSent])("does not stamp activity/follow-up on accepted, signed or paid quotes", async (fn) => {
    for (const state of [{ status: "accepted" }, { status: "sent", engagement: { signedAt: new Date() } }, { status: "sent", engagement: { onboardingFeeStatus: "PAID" } }]) {
      const client = { quote: { findUnique: vi.fn().mockResolvedValue(state), updateMany: vi.fn() } };
      await fn("quote", client as unknown as Pick<PrismaClient, "quote">);
      expect(client.quote.updateMany).not.toHaveBeenCalled();
    }
  });
  it("accepted legacy quotes never surface a client nudge even without a signature timestamp", () => {
    const stage = deriveLifecycleStage({ status: "accepted", publishedAt: new Date(0), firstViewedAt: null, firstSentAt: null, engagement: null });
    expect(stage).toBe("SIGNED");
    expect(nextStaffAction({ stage, lastActivityAt: new Date(0), lastFollowUpAt: null })).toBe("NONE");
  });
});
