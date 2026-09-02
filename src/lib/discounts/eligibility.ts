import {
  getUrgencyOfferDisplay,
  type UrgencyKind,
  type UrgencyOfferDisplay,
} from "@/app/(app)/offers/builder/urgencyOffer";
import { isDiscountKind, type DiscountDeadlineMode } from "./kinds";

export type DiscountTimingInput = {
  kind: string;
  percent: number;
  amount: number;
  title: string;
  details: string;
  activationMode: string;
  activationDelayDays: number;
  deadlineMode: string;
  durationDays: number;
  deadlineDate: Date | string | null;
  presentedAt?: Date | string | null;
};

function asDate(value: Date | string | null | undefined) {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function laterDate(a: Date | null, b: Date | null) {
  if (!a) return b;
  if (!b) return a;
  return a.getTime() >= b.getTime() ? a : b;
}

export function getDiscountAvailableFrom(
  discount: Pick<DiscountTimingInput, "activationMode" | "presentedAt">,
  publishedAt: Date | string | null,
) {
  if (discount.activationMode !== "immediate") return null;
  return laterDate(asDate(publishedAt), asDate(discount.presentedAt ?? null));
}

export function evaluateDiscountOffer(
  discount: DiscountTimingInput,
  context: {
    now?: Date;
    publishedAt?: Date | string | null;
    firstViewedAt?: Date | string | null;
    converted?: boolean;
  },
): UrgencyOfferDisplay | null {
  if (context.converted) return null;
  const now = context.now ?? new Date();
  const availableFrom = getDiscountAvailableFrom(discount, context.publishedAt ?? null);
  if (!availableFrom || now.getTime() < availableFrom.getTime()) return null;

  const kind: UrgencyKind = isDiscountKind(discount.kind) ? discount.kind : "custom";
  const deadlineMode: DiscountDeadlineMode =
    discount.deadlineMode === "date" ? "date" : "relative";
  const deadlineDate =
    discount.deadlineDate instanceof Date
      ? discount.deadlineDate.toISOString().slice(0, 10)
      : typeof discount.deadlineDate === "string"
        ? discount.deadlineDate.slice(0, 10)
        : "";

  const display = getUrgencyOfferDisplay(
    {
      enabled: true,
      deadlineMode,
      durationDays: discount.durationDays,
      deadlineDate,
      kind,
      percent: discount.percent,
      amount: discount.amount,
      title: discount.title,
      details: discount.details,
    },
    now,
    availableFrom,
  );

  return display.active ? display : null;
}

const CONVERTED_QUOTE_STATUSES = new Set(["accepted", "completed"]);
const CONVERTED_ENGAGEMENT_STATUSES = new Set([
  "SIGNED",
  "DEPOSIT_PAID",
  "ONBOARDING_PAID",
  "ONBOARDING_STARTED",
  "ACTIVE",
  "COMPLETED",
  "INVOICE_SENT",
]);

export function isLeadConvertedForDiscount(input: {
  quoteStatus?: string | null;
  engagementStatus?: string | null;
}) {
  if (input.quoteStatus && CONVERTED_QUOTE_STATUSES.has(input.quoteStatus)) return true;
  if (input.engagementStatus && CONVERTED_ENGAGEMENT_STATUSES.has(input.engagementStatus)) return true;
  return false;
}

export function pickActiveCatalogOffer(
  discounts: DiscountTimingInput[],
  context: {
    now?: Date;
    publishedAt?: Date | string | null;
    firstViewedAt?: Date | string | null;
    converted?: boolean;
  },
) {
  for (const discount of discounts) {
    const offer = evaluateDiscountOffer(discount, context);
    if (offer) return offer;
  }
  return null;
}
