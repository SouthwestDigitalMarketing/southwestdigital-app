import "server-only";

import { prisma } from "@/lib/prisma";
import { quoteContactSummaryFromSnapshot } from "./clientInfo";
import { assertQuoteNotFrozen, type QuoteFreezeState } from "./isQuoteFrozen";
import {
  catalogDiscountWhereForQuote,
  expiresAtForQuotePublish,
  resolveQuoteExpiresAtForWrite,
} from "./quoteExpiresAt";
import { snapshotWithPromoStamp } from "./proposalValidity";

/**
 * Shared send/re-send expiry (Spec 08 fix round 2: BLOCKER-1 + MINOR-5).
 *
 * Every send stamps `expiresAt = min(sentAt + validityDays, promoDeadline)`
 * and NEVER caps by the old `expiresAt`: expire-now then re-send revives the
 * quote with a fresh future expiry. The promotion deadline is re-resolved
 * from the live discounts at send time and restamped onto
 * `snapshot.proposalPromoExpiresAt` (cleared when no promotion is active),
 * so a promo deleted after publish stops capping later sends.
 *
 * Relative catalog/urgency deadlines are anchored at the quote's publish
 * time (`publishedAt ?? now`), matching the publish stamp, so re-sends do
 * not stretch a promotion that was presented with the original publish.
 *
 * Validity source of truth: the live `snapshotJson` (the same source the
 * staff validity control writes and the public self-heal reads). The
 * published snapshot copy is left alone by sends.
 *
 * Freeze rule (Spec 00): never call for frozen (accepted/signed/paid)
 * quotes. Callers assert first; this helper asserts again so no send path
 * can stamp an expiry onto a frozen quote.
 */
export async function resolveSendExpiry(input: {
  brandId: string;
  quoteId: string;
  quote: QuoteFreezeState;
  snapshot: unknown;
  publishedAt: Date | null;
  at: Date;
}): Promise<{ expiresAt: Date; snapshot: Record<string, unknown> }> {
  assertQuoteNotFrozen(input.quote);
  const discounts = await prisma.brandDiscount.findMany({
    where: catalogDiscountWhereForQuote({
      brandId: input.brandId,
      quoteId: input.quoteId,
      contactId: quoteContactSummaryFromSnapshot(input.snapshot).contactId,
    }),
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
  });
  const base =
    input.snapshot && typeof input.snapshot === "object" && !Array.isArray(input.snapshot)
      ? (input.snapshot as Record<string, unknown>)
      : {};
  const promoDeadline = expiresAtForQuotePublish({
    publishedAt: input.publishedAt ?? input.at,
    discounts,
    snapshot: input.snapshot,
  });
  const snapshot = snapshotWithPromoStamp(base, promoDeadline);
  return {
    expiresAt: resolveQuoteExpiresAtForWrite({ at: input.at, snapshot, promoDeadline }),
    snapshot,
  };
}
