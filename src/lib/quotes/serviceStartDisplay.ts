// Spec 06 surface display helpers (single source for every surface B owns).
//
// Staleness rule (decided for Brief B item 2): before selection, a surface
// shows the service-start month only when it cannot go stale —
//   * the frozen checkout month (post-selection, exact), or
//   * an explicit staff month on a proposal without a cleanup plan.
// With a cleanup plan, pre-selection surfaces keep only the Spec 04 length
// wording ("about N weeks after you accept") with no month line: the
// wrap-up-derived month would go stale, and a staff override could
// contradict the wrap-up rule. Post-selection the checkout carries the
// wrap-up-derived month frozen, so the month line appears next to the
// wrap-up rule — the same month, never a contradiction. A live "1st of next
// month" default is never shown on proposal/agreement/receipt surfaces (it
// would go stale if the client selects later, and legacy quotes without a
// stored month must stay byte-identical); the builder input is the only
// place that previews the resolved default. The cleanup/length suppression
// lives in the renderers (template, payment plan); this module only picks
// the candidate month.
import { isServiceStartMonth } from "./serviceStart";

const usd = (value: number) =>
  value.toLocaleString("en-US", { style: "currency", currency: "USD" });

/** Default applied-credit fee label when no client-readable reason is stored. */
export const CREDIT_APPLIED_DEFAULT_LABEL = "Credit for work already paid";

/** Fee label for the applied credit: the stored reason when set, else the default. */
export function creditAppliedLabel(reason: unknown): string {
  return typeof reason === "string" && reason.trim() ? reason.trim() : CREDIT_APPLIED_DEFAULT_LABEL;
}

function positiveMoney(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) && value > 0
    ? Math.round(value * 100) / 100
    : 0;
}

function trimmedReason(reason: unknown): string {
  return typeof reason === "string" ? reason.trim() : "";
}

/**
 * Client-facing remainder line for the proposal, the agreement fee lines and
 * the receipt. Null unless a remainder above zero exists (so legacy surfaces
 * without one render byte-identical).
 */
export function remainingCreditLine(remaining: unknown, reason: unknown): string | null {
  const amount = positiveMoney(remaining);
  if (amount <= 0) return null;
  const why = trimmedReason(reason);
  return why
    ? `Remaining credit of ${usd(amount)} (${why}) will be applied to your next invoice.`
    : `Remaining credit of ${usd(amount)} will be applied to your next invoice.`;
}

/**
 * Staff-facing remainder line for the staff offer page and the engagement
 * view, so whoever sends the next invoice applies it. Null unless a
 * remainder above zero exists.
 */
export function staffCreditLine(remaining: unknown, reason: unknown): string | null {
  const amount = positiveMoney(remaining);
  if (amount <= 0) return null;
  const why = trimmedReason(reason);
  return why
    ? `Credit to apply on next invoice: ${usd(amount)} — ${why}`
    : `Credit to apply on next invoice: ${usd(amount)}`;
}

/**
 * Which service-start month a surface shows: the frozen checkout month wins,
 * then the explicit staff month. Anything else (including a live default)
 * reads as no month, so legacy quotes stay byte-identical.
 */
export function resolveDisplayServiceStartMonth(
  checkoutMonth: unknown,
  staffMonth: unknown,
): string | null {
  if (isServiceStartMonth(checkoutMonth)) return checkoutMonth;
  if (isServiceStartMonth(staffMonth)) return staffMonth;
  return null;
}
