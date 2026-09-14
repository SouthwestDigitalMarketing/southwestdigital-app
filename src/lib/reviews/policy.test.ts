import { describe, expect, it } from "vitest";
import { ReviewOutcome } from "@prisma/client";
import {
  REVIEW_SMS_COOLDOWN_MS,
  canSendReviewReminder,
  reviewAlreadyResponded,
  reviewSmsCooldownActive,
} from "./policy";

const sentAt = new Date("2026-09-14T12:00:00.000Z");

function row(
  overrides: {
    lastReminderAt?: Date | null;
    clickedAt?: Date | null;
    outcome?: ReviewOutcome | null;
    sentAt?: Date;
  } = {},
) {
  return {
    sentAt,
    lastReminderAt: null as Date | null,
    clickedAt: null as Date | null,
    outcome: null as ReviewOutcome | null,
    ...overrides,
  };
}

describe("reviewAlreadyResponded", () => {
  it("is false for a sent request with no engagement", () => {
    expect(reviewAlreadyResponded(row())).toBe(false);
  });

  it("is true after a Google click or stored outcome", () => {
    expect(reviewAlreadyResponded(row({ clickedAt: sentAt }))).toBe(true);
    expect(reviewAlreadyResponded(row({ outcome: ReviewOutcome.FEEDBACK }))).toBe(true);
    expect(reviewAlreadyResponded(row({ outcome: ReviewOutcome.FIVE_STAR }))).toBe(true);
  });
});

describe("reviewSmsCooldownActive", () => {
  it("uses sentAt when no reminder has gone out", () => {
    const now = sentAt.getTime() + REVIEW_SMS_COOLDOWN_MS - 1;
    expect(reviewSmsCooldownActive(row(), now)).toBe(true);
    expect(reviewSmsCooldownActive(row(), sentAt.getTime() + REVIEW_SMS_COOLDOWN_MS)).toBe(false);
  });

  it("uses lastReminderAt when present", () => {
    const reminded = new Date(sentAt.getTime() + 60_000);
    expect(reviewSmsCooldownActive(row({ lastReminderAt: reminded }), reminded.getTime() + 1)).toBe(true);
    expect(
      reviewSmsCooldownActive(row({ lastReminderAt: reminded }), reminded.getTime() + REVIEW_SMS_COOLDOWN_MS),
    ).toBe(false);
  });
});

describe("canSendReviewReminder", () => {
  it("allows a reminder after the cooldown when the recipient has not responded", () => {
    const now = sentAt.getTime() + REVIEW_SMS_COOLDOWN_MS;
    expect(canSendReviewReminder(row(), now)).toBe(true);
  });

  it("rejects a reminder during cooldown or after a response", () => {
    expect(canSendReviewReminder(row(), sentAt.getTime() + 1)).toBe(false);
    expect(
      canSendReviewReminder(row({ clickedAt: sentAt }), sentAt.getTime() + REVIEW_SMS_COOLDOWN_MS),
    ).toBe(false);
  });
});
