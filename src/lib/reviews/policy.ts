import { ReviewOutcome } from "@prisma/client";

export const REVIEW_SMS_COOLDOWN_MS = 24 * 60 * 60 * 1000;
export const REVIEW_DAILY_SMS_CAP = 30;
export const REVIEW_NAME_MAX = 80;
export const REVIEW_FEEDBACK_TEXT_MAX = 2000;

export function reviewAlreadyResponded(request: {
  clickedAt: Date | null;
  outcome: ReviewOutcome | null;
}): boolean {
  return Boolean(
    request.clickedAt ||
      request.outcome === ReviewOutcome.FEEDBACK ||
      request.outcome === ReviewOutcome.FIVE_STAR,
  );
}

export function reviewSmsCooldownActive(
  request: { sentAt: Date; lastReminderAt: Date | null },
  now = Date.now(),
): boolean {
  const lastSmsAt = request.lastReminderAt ?? request.sentAt;
  return now - lastSmsAt.getTime() < REVIEW_SMS_COOLDOWN_MS;
}

export function canSendReviewReminder(
  request: {
    sentAt: Date;
    lastReminderAt: Date | null;
    clickedAt: Date | null;
    outcome: ReviewOutcome | null;
  },
  now = Date.now(),
): boolean {
  return !reviewAlreadyResponded(request) && !reviewSmsCooldownActive(request, now);
}
