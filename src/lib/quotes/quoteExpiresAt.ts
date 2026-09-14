import { pickActiveCatalogOffer, type DiscountTimingInput } from "@/lib/discounts/eligibility";
import {
  getUrgencyExpiresAt,
  normalizeUrgencyOffer,
} from "@/app/(app)/offers/builder/urgencyOffer";

export function quoteExpiresAtForPublish(input: {
  publishedAt: Date;
  catalogOfferExpiresAt: Date | null | undefined;
  snapshotUrgency: unknown;
}): Date | null {
  if (input.catalogOfferExpiresAt) return input.catalogOfferExpiresAt;
  return getUrgencyExpiresAt(
    normalizeUrgencyOffer(input.snapshotUrgency),
    input.publishedAt,
    input.publishedAt,
  );
}

export function snapshotUrgencyFromSnapshot(snapshot: unknown): unknown {
  if (!snapshot || typeof snapshot !== "object" || Array.isArray(snapshot)) return null;
  const record = snapshot as Record<string, unknown>;
  const assessment =
    record.assessment && typeof record.assessment === "object" && !Array.isArray(record.assessment)
      ? (record.assessment as Record<string, unknown>)
      : null;
  return assessment?.urgencyOffer ?? record.urgencyOffer ?? null;
}

export function catalogDiscountWhereForQuote(input: {
  brandId: string;
  quoteId: string;
  contactId: string | null;
}) {
  return {
    brandId: input.brandId,
    active: true,
    OR: [
      { contactId: null },
      ...(input.contactId ? [{ contactId: input.contactId }] : []),
      { offerAssignments: { some: { quoteId: input.quoteId, brandId: input.brandId } } },
    ],
  };
}

function discountTimingFromRow(discount: {
  kind: string;
  percent: number;
  amount: unknown;
  title: string;
  details: string;
  activationMode: string;
  activationDelayDays: number;
  deadlineMode: string;
  durationDays: number;
  deadlineDate: Date | string | null;
  presentedAt?: Date | string | null;
}): DiscountTimingInput {
  return {
    kind: discount.kind,
    percent: discount.percent,
    amount: Number(discount.amount),
    title: discount.title,
    details: discount.details,
    activationMode: discount.activationMode,
    activationDelayDays: discount.activationDelayDays,
    deadlineMode: discount.deadlineMode,
    durationDays: discount.durationDays,
    deadlineDate: discount.deadlineDate,
    presentedAt: discount.presentedAt,
  };
}

export function expiresAtForQuotePublish(input: {
  publishedAt: Date;
  discounts: Parameters<typeof discountTimingFromRow>[0][];
  snapshot: unknown;
}): Date | null {
  const catalogOffer = pickActiveCatalogOffer(
    input.discounts.map(discountTimingFromRow),
    { publishedAt: input.publishedAt, converted: false },
  );
  return quoteExpiresAtForPublish({
    publishedAt: input.publishedAt,
    catalogOfferExpiresAt: catalogOffer?.expiresAt ?? null,
    snapshotUrgency: snapshotUrgencyFromSnapshot(input.snapshot),
  });
}
