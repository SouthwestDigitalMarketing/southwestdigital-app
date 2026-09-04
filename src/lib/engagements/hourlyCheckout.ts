import { createHash } from "node:crypto";

// Hourly-offer checkout is intentionally much simpler than the bookkeeping
// summary in proposalCheckout.ts: one catalog service, a quantity (# of
// sessions or hours), a unit price, and an optional one-time intake fee.
// The full total is due upfront — no cleanup, no first-month vs. onboarding
// split, no tiered packages.

export type HourlyOfferKind = "consulting" | "coaching";

export type HourlyCheckoutSelection = {
  kind: HourlyOfferKind;
  catalogItemId: string;
  catalogItemLabel: string;
  quantity: number;
  unitPrice: number;
  intakeFee: number;
};

export type HourlyCheckoutSummary = HourlyCheckoutSelection & {
  subtotal: number;
  total: number;
  amountDueNow: number;
  chargeKind: "hourly_consulting" | "hourly_coaching";
  selectionHash: string;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function money(value: number) {
  return Math.round(Math.max(0, value) * 100) / 100;
}

function isFiniteNonNegative(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0;
}

function isHourlyKind(value: unknown): value is HourlyOfferKind {
  return value === "consulting" || value === "coaching";
}

export function parseHourlyCheckoutSelection(value: unknown): HourlyCheckoutSelection | null {
  if (!isRecord(value)) return null;
  if (!isHourlyKind(value.kind)) return null;
  if (typeof value.catalogItemId !== "string" || value.catalogItemId.length === 0) return null;
  if (typeof value.catalogItemLabel !== "string" || value.catalogItemLabel.length === 0) return null;
  if (!isFiniteNonNegative(value.quantity) || value.quantity <= 0) return null;
  if (!isFiniteNonNegative(value.unitPrice)) return null;
  const intakeFee = isFiniteNonNegative(value.intakeFee) ? value.intakeFee : 0;
  return {
    kind: value.kind,
    catalogItemId: value.catalogItemId,
    catalogItemLabel: value.catalogItemLabel,
    quantity: value.quantity,
    unitPrice: value.unitPrice,
    intakeFee,
  };
}

export function buildHourlyCheckoutSummary(selection: HourlyCheckoutSelection): HourlyCheckoutSummary {
  const subtotal = money(selection.quantity * selection.unitPrice);
  const intakeFee = money(selection.intakeFee);
  const total = money(subtotal + intakeFee);
  const chargeKind: HourlyCheckoutSummary["chargeKind"] =
    selection.kind === "consulting" ? "hourly_consulting" : "hourly_coaching";
  const normalized = {
    kind: selection.kind,
    catalogItemId: selection.catalogItemId,
    catalogItemLabel: selection.catalogItemLabel,
    quantity: selection.quantity,
    unitPrice: money(selection.unitPrice),
    intakeFee,
    subtotal,
    total,
    amountDueNow: total,
    chargeKind,
  };
  const selectionHash = createHash("sha256").update(JSON.stringify(normalized)).digest("hex");
  return { ...normalized, selectionHash };
}

export function parseStoredHourlyCheckout(value: unknown): HourlyCheckoutSummary | null {
  if (!isRecord(value)) return null;
  const selection = parseHourlyCheckoutSelection(value);
  if (!selection) return null;
  if (typeof value.selectionHash !== "string") return null;
  const numericKeys = ["subtotal", "total", "amountDueNow"] as const;
  if (numericKeys.some((key) => !isFiniteNonNegative(value[key]))) return null;
  const chargeKind = value.chargeKind;
  if (chargeKind !== "hourly_consulting" && chargeKind !== "hourly_coaching") return null;
  return {
    ...selection,
    subtotal: value.subtotal as number,
    total: value.total as number,
    amountDueNow: value.amountDueNow as number,
    chargeKind,
    selectionHash: value.selectionHash,
  };
}

// Hourly proposals charge the full total upfront. Test proposals still
// collect $1 so live checkout can be exercised end-to-end without moving
// real money.
export function resolveHourlyAmountDueNow(input: {
  checkout: Pick<HourlyCheckoutSummary, "amountDueNow">;
  isTestProposal: boolean;
}) {
  if (input.isTestProposal) return 1;
  return money(input.checkout.amountDueNow);
}
