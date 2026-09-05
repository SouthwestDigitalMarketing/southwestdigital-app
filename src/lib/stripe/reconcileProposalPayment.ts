import "server-only";
import type Stripe from "stripe";
import { prisma } from "@/lib/prisma";
import { markEngagementDepositPaid } from "@/lib/engagements/fromOffer";
import { readAcceptedPayment, readStripePaymentExpectation, type AcceptedPayment, type StripePaymentExpectation } from "@/lib/engagements/acceptedPayment";

export class PaymentReconciliationError extends Error {
  constructor() { super("This payment needs review before it can be applied to the proposal."); }
}

export type ProposalPaymentIntent = Pick<Stripe.PaymentIntent,
  "id" | "status" | "amount" | "amount_received" | "currency" | "metadata" | "transfer_data" | "livemode" | "latest_charge"
>;

export function matchesProposalPayment(
  intent: Pick<Stripe.PaymentIntent, "id" | "status" | "amount" | "amount_received" | "currency" | "metadata" | "transfer_data" | "livemode">,
  expected: StripePaymentExpectation,
  accepted: AcceptedPayment,
  settled = true,
) {
  const destination = intent.transfer_data?.destination;
  const destinationId = typeof destination === "string" ? destination : destination?.id;
  return (!settled || (intent.status === "succeeded" && intent.amount_received === accepted.amountInCents)) &&
    intent.id === expected.intentId && intent.amount === accepted.amountInCents &&
    expected.amountInCents === accepted.amountInCents && intent.currency === accepted.currency &&
    expected.currency === accepted.currency && expected.selectionHash === accepted.selectionHash &&
    expected.isTestProposal === accepted.isTestProposal && expected.chargeKind === accepted.chargeKind &&
    intent.livemode === expected.livemode && destinationId === expected.connectedAccountId &&
    intent.metadata.brandId === expected.brandId && intent.metadata.engagementId === expected.engagementId &&
    intent.metadata.selectionHash === expected.selectionHash &&
    intent.metadata.connectedAccountId === expected.connectedAccountId && intent.metadata.chargeKind === expected.chargeKind;
}

/** All successful Stripe paths use this same check, including signed webhooks. */
export async function reconcileProposalPayment(intent: ProposalPaymentIntent, engagementId: string, brandId: string) {
  if (!brandId || !engagementId) throw new PaymentReconciliationError();
  const engagement = await prisma.engagement.findFirst({
    where: { id: engagementId, brandId },
    select: { onboardingData: true, signedAt: true },
  });
  const accepted = readAcceptedPayment(engagement?.onboardingData);
  const expected = readStripePaymentExpectation(engagement?.onboardingData);
  if (!engagement?.signedAt || !accepted || !expected || expected.brandId !== brandId ||
      expected.engagementId !== engagementId || !matchesProposalPayment(intent, expected, accepted)) {
    throw new PaymentReconciliationError();
  }
  const latestCharge = typeof intent.latest_charge === "object" ? intent.latest_charge : null;
  await markEngagementDepositPaid(engagementId, brandId, {
    provider: "stripe", reference: intent.id, amount: intent.amount_received / 100,
    currency: intent.currency.toUpperCase(), receiptUrl: latestCharge?.receipt_url ?? null,
  });
}
