import type { PrismaClient } from "@prisma/client";
import { prisma as defaultPrisma } from "@/lib/prisma";

export const LIFECYCLE_STAGES = [
  "DRAFT",
  "READY",
  "SENT",
  "VIEWED",
  "SIGNED",
  "PAID",
  "CLOSED",
] as const;

export type LifecycleStage = (typeof LIFECYCLE_STAGES)[number];

export type WaitingOn = "STAFF" | "CLIENT" | "NONE";

export type LifecycleInput = {
  status: string;
  publishedAt: Date | null;
  firstSentAt: Date | null;
  firstViewedAt: Date | null;
  engagement: {
    signedAt: Date | null;
    onboardingFeeStatus: string | null;
  } | null;
};

// Lifecycle is derived from event timestamps + settlement state, not from
// the raw Quote.status string (which we only inspect for the archived
// terminal). "Sent" is a staff action — an offer is READY (published but
// not yet delivered) until staff either sends it via the connected mailbox
// (which stamps firstSentAt) or manually marks it as sent. The self-heal
// on first client view (see /proposal/[token]/page.tsx) also stamps
// firstSentAt so a leaked or out-of-band-shared URL still surfaces as SENT.
export function deriveLifecycleStage(input: LifecycleInput): LifecycleStage {
  if (input.status === "archived") return "CLOSED";

  const settled =
    input.engagement?.onboardingFeeStatus === "PAID" ||
    input.engagement?.onboardingFeeStatus === "WAIVED";
  if (settled) return "PAID";

  const signed = Boolean(input.engagement?.signedAt);
  if (signed) return "SIGNED";

  if (input.firstViewedAt) return "VIEWED";
  if (input.firstSentAt) return "SENT";
  if (input.publishedAt) return "READY";
  return "DRAFT";
}

export function deriveWaitingOn(stage: LifecycleStage): WaitingOn {
  if (stage === "DRAFT" || stage === "READY") return "STAFF";
  if (stage === "PAID" || stage === "CLOSED") return "NONE";
  return "CLIENT";
}

// Days until the client is considered "sitting on it too long" and staff
// should nudge. READY has no threshold because SEND_READY is always the
// staff's move — the row goes blue the moment it enters READY. Tuned to
// typical B2B service-buying pace; adjust in one place if we ever expose
// these per brand.
export const STALE_THRESHOLD_DAYS: Record<LifecycleStage, number> = {
  DRAFT: Number.POSITIVE_INFINITY,
  READY: 0,
  SENT: 4,
  VIEWED: 5,
  SIGNED: 7,
  PAID: Number.POSITIVE_INFINITY,
  CLOSED: Number.POSITIVE_INFINITY,
};

// After sending a nudge, wait at least this long before nudging again so
// the client doesn't feel harassed.
export const FOLLOW_UP_COOLDOWN_DAYS = 3;

export function daysSince(date: Date | null | undefined, now: Date = new Date()): number {
  if (!date) return Number.POSITIVE_INFINITY;
  const ms = now.getTime() - date.getTime();
  return Math.max(0, ms / (24 * 60 * 60 * 1000));
}

export type StalenessInput = {
  stage: LifecycleStage;
  lastActivityAt: Date | null;
  lastFollowUpAt: Date | null;
};

export function isStale(input: StalenessInput, now: Date = new Date()): boolean {
  const threshold = STALE_THRESHOLD_DAYS[input.stage];
  if (!Number.isFinite(threshold)) return false;
  // Rows with no tracked activity yet (e.g. a fresh draft) are treated
  // as not-stale — there's nothing to be stale relative to.
  if (!input.lastActivityAt) return false;
  if (daysSince(input.lastActivityAt, now) < threshold) return false;
  if (daysSince(input.lastFollowUpAt, now) < FOLLOW_UP_COOLDOWN_DAYS) return false;
  return true;
}

export type NextActionKey =
  | "EDIT_DRAFT"
  | "SEND_READY"
  | "NUDGE_UNVIEWED"
  | "NUDGE_UNSIGNED"
  | "NUDGE_UNPAID"
  | "NONE";

// The single action a staff member should take right now on this offer,
// or NONE if the ball is legitimately in the client's court and it isn't
// stale yet.
export function nextStaffAction(input: {
  stage: LifecycleStage;
  lastActivityAt: Date | null;
  lastFollowUpAt: Date | null;
}, now: Date = new Date()): NextActionKey {
  if (input.stage === "DRAFT") return "EDIT_DRAFT";
  if (input.stage === "READY") return "SEND_READY";
  if (input.stage === "PAID" || input.stage === "CLOSED") return "NONE";
  const stale = isStale(
    { stage: input.stage, lastActivityAt: input.lastActivityAt, lastFollowUpAt: input.lastFollowUpAt },
    now,
  );
  if (!stale) return "NONE";
  if (input.stage === "SENT") return "NUDGE_UNVIEWED";
  if (input.stage === "VIEWED") return "NUDGE_UNSIGNED";
  if (input.stage === "SIGNED") return "NUDGE_UNPAID";
  return "NONE";
}

type PrismaLike = Pick<PrismaClient, "quote">;

// Bump lastActivityAt to now(). Called from every event that resets the
// "how long has this been sitting" clock: publish, resend, client view,
// sign, pay, follow-up sent. Never throws — activity tracking must never
// break the primary flow it's hooked into.
export async function bumpQuoteActivity(quoteId: string, client: PrismaLike = defaultPrisma): Promise<void> {
  try {
    await client.quote.update({
      where: { id: quoteId },
      data: { lastActivityAt: new Date() },
      select: { id: true },
    });
  } catch (error) {
    console.error("[lifecycle] bumpQuoteActivity failed", { quoteId, error });
  }
}

// Called when staff sends a follow-up nudge. Bumps both timestamps so the
// cooldown starts and the row leaves the "stale" bucket immediately.
export async function markQuoteFollowUpSent(quoteId: string, client: PrismaLike = defaultPrisma): Promise<void> {
  try {
    const now = new Date();
    await client.quote.update({
      where: { id: quoteId },
      data: { lastActivityAt: now, lastFollowUpAt: now },
      select: { id: true },
    });
  } catch (error) {
    console.error("[lifecycle] markQuoteFollowUpSent failed", { quoteId, error });
  }
}
