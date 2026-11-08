export type HourlyOfferKindForPresentation = "consulting" | "coaching";

export type HourlyCheckoutPresentationInput = {
  kind: HourlyOfferKindForPresentation;
  catalogItemId: string;
  catalogItemLabel: string;
  quantity: number;
  unitPrice: number;
  intakeFee: number;
};

/** Browser-safe totals for the live offer form. The signed payment hash is
 * still built by hourlyCheckout.ts on the server. */
export function buildHourlyCheckoutPresentation(input: HourlyCheckoutPresentationInput) {
  const subtotal = Math.round(Math.max(0, input.quantity * input.unitPrice) * 100) / 100;
  const intakeFee = Math.round(Math.max(0, input.intakeFee) * 100) / 100;
  const total = Math.round((subtotal + intakeFee) * 100) / 100;
  return {
    ...input,
    subtotal,
    total,
    amountDueNow: total,
    chargeKind: input.kind === "consulting" ? "hourly_consulting" as const : "hourly_coaching" as const,
  };
}
