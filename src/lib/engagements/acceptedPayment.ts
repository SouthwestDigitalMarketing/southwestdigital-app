import { z } from "zod";
import { parseStoredHourlyCheckout } from "./hourlyCheckout";
import { parseStoredProposalCheckout } from "./proposalCheckout";

export const acceptedPaymentSchema = z.object({
  amountInCents: z.number().int().min(0).max(99_999_999),
  currency: z.literal("usd"),
  selectionHash: z.string().min(1),
  chargeKind: z.string().min(1),
  isTestProposal: z.boolean(),
});
export type AcceptedPayment = z.infer<typeof acceptedPaymentSchema>;

export function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

/** Run at signature time. Later discounts or draft edits cannot change this. */
export function buildAcceptedPayment(servicesValue: unknown, isTestProposal: boolean): AcceptedPayment | null {
  const services = asRecord(servicesValue);
  const checkout = parseStoredHourlyCheckout(services.hourlyCheckout) ?? parseStoredProposalCheckout(services);
  if (!checkout) return null;
  const result = acceptedPaymentSchema.safeParse({
    amountInCents: Math.round((isTestProposal ? 1 : checkout.amountDueNow) * 100),
    currency: "usd",
    selectionHash: checkout.selectionHash,
    chargeKind: isTestProposal ? "test_proposal" : checkout.chargeKind,
    isTestProposal,
  });
  return result.success ? result.data : null;
}

export function readAcceptedPayment(onboardingData: unknown): AcceptedPayment | null {
  const acceptance = asRecord(asRecord(onboardingData).proposalAcceptance);
  const result = acceptedPaymentSchema.safeParse(acceptance.paymentObligation);
  return result.success ? result.data : null;
}

export const stripeExpectationSchema = acceptedPaymentSchema.extend({
  intentId: z.string().min(1),
  brandId: z.string().min(1),
  engagementId: z.string().min(1),
  connectedAccountId: z.string().min(1),
  livemode: z.boolean(),
});
export type StripePaymentExpectation = z.infer<typeof stripeExpectationSchema>;

export function readStripePaymentExpectation(onboardingData: unknown): StripePaymentExpectation | null {
  const services = asRecord(asRecord(asRecord(onboardingData).proposalBuilderState).services);
  const parsed = stripeExpectationSchema.safeParse(services.stripePaymentExpectation);
  return parsed.success ? parsed.data : null;
}

/** Signed displays must never fall back to today's mutable builder services. */
export function readAcceptedSelection(onboardingData: unknown) {
  const acceptance = asRecord(asRecord(onboardingData).proposalAcceptance);
  const services = asRecord(acceptance.selection);
  const hourly = parseStoredHourlyCheckout(services.hourlyCheckout);
  const bookkeeping = hourly ? null : parseStoredProposalCheckout(services);
  return { services, hourly, bookkeeping };
}
