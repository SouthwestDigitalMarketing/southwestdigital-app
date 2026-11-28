import type { Prisma } from "@prisma/client";
import { isQuoteFrozen, quoteFreezeSelect } from "./isQuoteFrozen";

/** Default proposal validity in days, stamped as snapshot `proposalValidityDays`. */
export const DEFAULT_PROPOSAL_VALIDITY_DAYS = 30;

/** Upper bound accepted by the staff validity control. */
export const MAX_PROPOSAL_VALIDITY_DAYS = 365;

const DAY_MS = 24 * 60 * 60 * 1000;

/** Editable per-proposal validity window in days. Falls back to the default. */
export function proposalValidityDaysFromSnapshot(snapshot: unknown): number {
  if (!snapshot || typeof snapshot !== "object" || Array.isArray(snapshot)) {
    return DEFAULT_PROPOSAL_VALIDITY_DAYS;
  }
  const raw = (snapshot as Record<string, unknown>).proposalValidityDays;
  const days = typeof raw === "string" && raw.trim() !== "" ? Number(raw) : raw;
  if (typeof days !== "number" || !Number.isFinite(days)) return DEFAULT_PROPOSAL_VALIDITY_DAYS;
  const rounded = Math.floor(days);
  if (rounded < 1) return DEFAULT_PROPOSAL_VALIDITY_DAYS;
  return Math.min(rounded, MAX_PROPOSAL_VALIDITY_DAYS);
}

/** `from + validityDays`, the proposal default expiry before promotion minima. */
export function defaultProposalExpiryAt(from: Date, snapshot: unknown): Date {
  return new Date(from.getTime() + proposalValidityDaysFromSnapshot(snapshot) * DAY_MS);
}

/** Earliest of the given deadlines; null only when every input is null. */
export function minExpiresAt(...candidates: Array<Date | null | undefined>): Date | null {
  let earliest: Date | null = null;
  for (const candidate of candidates) {
    if (!candidate) continue;
    if (!earliest || candidate.getTime() < earliest.getTime()) earliest = candidate;
  }
  return earliest;
}

/**
 * Promotion deadline captured at publish (ISO string, snapshot
 * `proposalPromoExpiresAt`). Send writes reuse it so a later send keeps the
 * earlier catalog/urgency deadline without re-querying discounts.
 */
export function promoDeadlineFromSnapshot(snapshot: unknown): Date | null {
  if (!snapshot || typeof snapshot !== "object" || Array.isArray(snapshot)) return null;
  const raw = (snapshot as Record<string, unknown>).proposalPromoExpiresAt;
  if (typeof raw !== "string" || raw.trim() === "") return null;
  const parsed = new Date(raw);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

/** Snapshot copy stamped with the publish-time promotion deadline. */
export function snapshotWithPromoStamp<T extends Record<string, unknown>>(
  snapshot: T,
  promoDeadline: Date | null | undefined,
): T {
  return {
    ...snapshot,
    proposalPromoExpiresAt: promoDeadline ? promoDeadline.toISOString() : null,
  };
}

/** Id of the quote this draft replaces (snapshot on the replacement). */
export function replacesQuoteIdFromSnapshot(snapshot: unknown): string | null {
  if (!snapshot || typeof snapshot !== "object" || Array.isArray(snapshot)) return null;
  const raw = (snapshot as Record<string, unknown>).replacesQuoteId;
  return typeof raw === "string" && raw.trim() !== "" ? raw : null;
}

/** Id of the quote that replaced this one (snapshot on the superseded quote). */
export function replacedByQuoteIdFromSnapshot(snapshot: unknown): string | null {
  if (!snapshot || typeof snapshot !== "object" || Array.isArray(snapshot)) return null;
  const raw = (snapshot as Record<string, unknown>).replacedByQuoteId;
  return typeof raw === "string" && raw.trim() !== "" ? raw : null;
}

export type ExpiredPublicNotice =
  | { kind: "replaced"; publicPath: string }
  | { kind: "expired" };

/**
 * Which notice an unreadable public proposal page shows. A replaced quote
 * links to the new public link only when it is published; otherwise (and for
 * plain expiry) the client sees the expired message. Unsigned withdrawn
 * quotes that are neither expired nor replaced keep the 404.
 */
export function expiredPublicNoticeKind(input: {
  expired: boolean;
  replacedByPublicToken: string | null;
}): ExpiredPublicNotice | null {
  if (input.replacedByPublicToken) {
    return { kind: "replaced", publicPath: `/proposal/${input.replacedByPublicToken}` };
  }
  if (input.expired) return { kind: "expired" };
  return null;
}

export type SupersedeResult = "expired" | "skipped-frozen" | "skipped-missing";

/**
 * Expire a replaced quote now that its replacement was published or sent.
 * Stamps `expiresAt = now` plus `replacedByQuoteId` on the snapshot so the
 * old public page can link forward. Sends nothing. Frozen (accepted, signed,
 * paid) old quotes are never touched — the replacement must not have been
 * created from them in the first place.
 */
export async function supersedeReplacedQuote(
  tx: Prisma.TransactionClient,
  brandId: string,
  input: { oldQuoteId: string; newQuoteId: string; now?: Date },
): Promise<SupersedeResult> {
  const old = await tx.quote.findFirst({
    where: { id: input.oldQuoteId, brandId },
    select: { id: true, ...quoteFreezeSelect, snapshotJson: true },
  });
  if (!old) return "skipped-missing";
  if (isQuoteFrozen(old)) return "skipped-frozen";
  const now = input.now ?? new Date();
  const snapshot =
    old.snapshotJson && typeof old.snapshotJson === "object" && !Array.isArray(old.snapshotJson)
      ? (old.snapshotJson as Record<string, unknown>)
      : {};
  await tx.quote.update({
    where: { id: old.id },
    data: {
      expiresAt: now,
      lastActivityAt: now,
      snapshotJson: { ...snapshot, replacedByQuoteId: input.newQuoteId },
    },
  });
  return "expired";
}
