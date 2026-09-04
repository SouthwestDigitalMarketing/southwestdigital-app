import { describe, expect, it } from "vitest";
import {
  daysSince,
  deriveLifecycleStage,
  deriveWaitingOn,
  FOLLOW_UP_COOLDOWN_DAYS,
  isStale,
  nextStaffAction,
  STALE_THRESHOLD_DAYS,
  type LifecycleInput,
} from "./lifecycle";

const now = new Date("2026-09-10T12:00:00Z");
const daysAgo = (d: number) => new Date(now.getTime() - d * 24 * 60 * 60 * 1000);

const baseInput = (overrides: Partial<LifecycleInput> = {}): LifecycleInput => ({
  status: "draft",
  publishedAt: null,
  firstSentAt: null,
  firstViewedAt: null,
  engagement: null,
  ...overrides,
});

describe("deriveLifecycleStage", () => {
  it("returns DRAFT when nothing has been published yet", () => {
    expect(deriveLifecycleStage(baseInput())).toBe("DRAFT");
  });

  it("returns READY once published but before staff has sent or client has viewed", () => {
    expect(
      deriveLifecycleStage(baseInput({ publishedAt: daysAgo(1) })),
    ).toBe("READY");
  });

  it("returns SENT once firstSentAt is stamped (via connected mailbox or manual mark)", () => {
    expect(
      deriveLifecycleStage(
        baseInput({ publishedAt: daysAgo(2), firstSentAt: daysAgo(1) }),
      ),
    ).toBe("SENT");
  });

  it("returns CLOSED for archived quotes regardless of other state", () => {
    expect(
      deriveLifecycleStage(baseInput({ status: "archived", publishedAt: daysAgo(3) })),
    ).toBe("CLOSED");
  });

  it("returns VIEWED when the client has opened the proposal", () => {
    expect(
      deriveLifecycleStage(
        baseInput({
          publishedAt: daysAgo(2),
          firstSentAt: daysAgo(2),
          firstViewedAt: daysAgo(1),
          engagement: { signedAt: null, onboardingFeeStatus: "REQUIRED" },
        }),
      ),
    ).toBe("VIEWED");
  });

  it("returns VIEWED even when firstSentAt is null — self-heal for leaked/out-of-band URLs", () => {
    expect(
      deriveLifecycleStage(
        baseInput({
          publishedAt: daysAgo(2),
          firstSentAt: null,
          firstViewedAt: daysAgo(1),
        }),
      ),
    ).toBe("VIEWED");
  });

  it("returns SIGNED when the engagement is signed but unpaid", () => {
    expect(
      deriveLifecycleStage(
        baseInput({
          status: "accepted",
          publishedAt: daysAgo(4),
          firstSentAt: daysAgo(3),
          firstViewedAt: daysAgo(2),
          engagement: { signedAt: daysAgo(1), onboardingFeeStatus: "INVOICED" },
        }),
      ),
    ).toBe("SIGNED");
  });

  it("returns PAID once onboarding fee is PAID", () => {
    expect(
      deriveLifecycleStage(
        baseInput({
          status: "completed",
          publishedAt: daysAgo(5),
          firstSentAt: daysAgo(4),
          firstViewedAt: daysAgo(3),
          engagement: { signedAt: daysAgo(2), onboardingFeeStatus: "PAID" },
        }),
      ),
    ).toBe("PAID");
  });

  it("treats WAIVED as PAID (nothing owed = deal is done)", () => {
    expect(
      deriveLifecycleStage(
        baseInput({
          status: "accepted",
          publishedAt: daysAgo(3),
          firstSentAt: daysAgo(3),
          firstViewedAt: daysAgo(2),
          engagement: { signedAt: daysAgo(1), onboardingFeeStatus: "WAIVED" },
        }),
      ),
    ).toBe("PAID");
  });
});

describe("deriveWaitingOn", () => {
  it("puts DRAFT and READY on staff (they need to finish or send it)", () => {
    expect(deriveWaitingOn("DRAFT")).toBe("STAFF");
    expect(deriveWaitingOn("READY")).toBe("STAFF");
  });

  it("puts in-flight stages on client", () => {
    expect(deriveWaitingOn("SENT")).toBe("CLIENT");
    expect(deriveWaitingOn("VIEWED")).toBe("CLIENT");
    expect(deriveWaitingOn("SIGNED")).toBe("CLIENT");
  });

  it("puts terminal stages on nobody", () => {
    expect(deriveWaitingOn("PAID")).toBe("NONE");
    expect(deriveWaitingOn("CLOSED")).toBe("NONE");
  });
});

describe("daysSince", () => {
  it("returns Infinity for null", () => {
    expect(daysSince(null, now)).toBe(Number.POSITIVE_INFINITY);
  });

  it("returns fractional days for recent activity", () => {
    expect(daysSince(daysAgo(0.5), now)).toBeCloseTo(0.5, 5);
  });

  it("clamps future dates to 0", () => {
    const future = new Date(now.getTime() + 60_000);
    expect(daysSince(future, now)).toBe(0);
  });
});

describe("isStale", () => {
  it("is not stale when the activity clock is fresh", () => {
    expect(
      isStale({ stage: "SENT", lastActivityAt: daysAgo(1), lastFollowUpAt: null }, now),
    ).toBe(false);
  });

  it("becomes stale once past the per-stage threshold", () => {
    const days = STALE_THRESHOLD_DAYS.SENT + 1;
    expect(
      isStale({ stage: "SENT", lastActivityAt: daysAgo(days), lastFollowUpAt: null }, now),
    ).toBe(true);
  });

  it("respects the follow-up cooldown so we don't nag", () => {
    const staleAge = STALE_THRESHOLD_DAYS.SENT + 5;
    expect(
      isStale(
        {
          stage: "SENT",
          lastActivityAt: daysAgo(staleAge),
          lastFollowUpAt: daysAgo(FOLLOW_UP_COOLDOWN_DAYS - 1),
        },
        now,
      ),
    ).toBe(false);
  });

  it("re-enters stale after the cooldown expires", () => {
    const staleAge = STALE_THRESHOLD_DAYS.SENT + 5;
    expect(
      isStale(
        {
          stage: "SENT",
          lastActivityAt: daysAgo(staleAge),
          lastFollowUpAt: daysAgo(FOLLOW_UP_COOLDOWN_DAYS + 1),
        },
        now,
      ),
    ).toBe(true);
  });

  it("treats null lastActivityAt as not-stale (fresh row with no tracked activity)", () => {
    expect(
      isStale({ stage: "SENT", lastActivityAt: null, lastFollowUpAt: null }, now),
    ).toBe(false);
  });

  it("never marks DRAFT, PAID, or CLOSED stale", () => {
    expect(
      isStale({ stage: "DRAFT", lastActivityAt: daysAgo(365), lastFollowUpAt: null }, now),
    ).toBe(false);
    expect(
      isStale({ stage: "PAID", lastActivityAt: daysAgo(365), lastFollowUpAt: null }, now),
    ).toBe(false);
    expect(
      isStale({ stage: "CLOSED", lastActivityAt: daysAgo(365), lastFollowUpAt: null }, now),
    ).toBe(false);
  });
});

describe("nextStaffAction", () => {
  it("recommends EDIT_DRAFT for a draft (no publishedAt yet)", () => {
    expect(
      nextStaffAction({ stage: "DRAFT", lastActivityAt: null, lastFollowUpAt: null }, now),
    ).toBe("EDIT_DRAFT");
  });

  it("recommends SEND_READY immediately on a published-but-not-yet-sent offer", () => {
    expect(
      nextStaffAction({ stage: "READY", lastActivityAt: daysAgo(0), lastFollowUpAt: null }, now),
    ).toBe("SEND_READY");
  });

  it("nothing to do when the client just viewed", () => {
    expect(
      nextStaffAction(
        { stage: "VIEWED", lastActivityAt: daysAgo(1), lastFollowUpAt: null },
        now,
      ),
    ).toBe("NONE");
  });

  it("recommends nudging unsigned proposals that have gone cold", () => {
    const days = STALE_THRESHOLD_DAYS.VIEWED + 1;
    expect(
      nextStaffAction(
        { stage: "VIEWED", lastActivityAt: daysAgo(days), lastFollowUpAt: null },
        now,
      ),
    ).toBe("NUDGE_UNSIGNED");
  });

  it("recommends nudging signed-but-unpaid proposals that have gone cold", () => {
    const days = STALE_THRESHOLD_DAYS.SIGNED + 1;
    expect(
      nextStaffAction(
        { stage: "SIGNED", lastActivityAt: daysAgo(days), lastFollowUpAt: null },
        now,
      ),
    ).toBe("NUDGE_UNPAID");
  });

  it("nothing to do once the deal is paid", () => {
    expect(
      nextStaffAction(
        { stage: "PAID", lastActivityAt: daysAgo(30), lastFollowUpAt: null },
        now,
      ),
    ).toBe("NONE");
  });
});
