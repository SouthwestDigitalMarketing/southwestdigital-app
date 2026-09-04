import { NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getStripeClient } from "@/lib/stripe";
import { getChargeableConnectedAccountId } from "@/lib/stripe/connect";
import { destinationPaymentIntentParams } from "@/lib/stripe/paymentIntentParams";
import { resolveOnboardingWaiverForEngagement } from "@/lib/discounts/resolveOnboardingWaiver";
import {
  parseStoredProposalCheckout,
  resolveAmountDueNow,
} from "@/lib/engagements/proposalCheckout";
import { markEngagementDepositPaid } from "@/lib/engagements/fromOffer";
import { hasPublicProposalAccess, publicProposalNotFound } from "@/lib/engagements/publicProposalAccess";

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ engagementId: string }> },
) {
  const { engagementId } = await params;
  if (!await hasPublicProposalAccess(request, engagementId)) return publicProposalNotFound();

  const engagement = await prisma.engagement.findUnique({
    where: { id: engagementId },
    select: { brandId: true, onboardingFeeStatus: true, onboardingData: true, agreementManagerStatus: true, isTestProposal: true, signedAt: true },
  });
  if (!engagement) return NextResponse.json({ error: "Engagement not found" }, { status: 404 });
  if (engagement.agreementManagerStatus === "VOIDED" || engagement.agreementManagerStatus === "VOIDED_BEFORE_SIGNATURE" || engagement.agreementManagerStatus === "CANCELLATION_REQUESTED" || engagement.agreementManagerStatus === "TERMINATED_AFTER_SIGNATURE") {
    return NextResponse.json({ error: "Payment is unavailable for this agreement." }, { status: 409 });
  }

  if (!engagement.signedAt) {
    return NextResponse.json({ error: "The agreement must be signed before payment." }, { status: 409 });
  }
  const onboardingData = isRecord(engagement.onboardingData) ? engagement.onboardingData : {};
  const existingState = isRecord(onboardingData.proposalBuilderState) ? onboardingData.proposalBuilderState : {};
  const existingServices = isRecord(existingState.services) ? existingState.services : {};
  const checkout = parseStoredProposalCheckout(existingServices);
  if (!checkout) {
    return NextResponse.json({ error: "Select a valid published pricing option before payment." }, { status: 409 });
  }
  const invoiceEmail = typeof existingServices.invoiceEmail === "string" ? existingServices.invoiceEmail : undefined;
  const existingPaymentIntentId = typeof existingServices.stripePaymentIntentId === "string" ? existingServices.stripePaymentIntentId : null;
  const waiverActive = engagement.onboardingFeeStatus === "WAIVED"
    || await resolveOnboardingWaiverForEngagement(engagementId);

  if (engagement.onboardingFeeStatus === "PAID") {
    return NextResponse.json({ alreadyResolved: true });
  }

  const chargeAmount = resolveAmountDueNow({
    checkout,
    onboardingWaived: waiverActive,
    isTestProposal: engagement.isTestProposal,
  });

  if (chargeAmount <= 0) {
    await prisma.engagement.update({
      where: { id: engagementId },
      data: { onboardingFeeStatus: "WAIVED", status: "DEPOSIT_PAID" },
    });
    return NextResponse.json({ waived: true });
  }

  const chargeKind = engagement.isTestProposal ? "test_proposal" : checkout.chargeKind;

  const amountInCents = Math.round(chargeAmount * 100);
  const connectedAccountId = await getChargeableConnectedAccountId(engagement.brandId);
  const baseIntentParams = destinationPaymentIntentParams({
    amountInCents,
    engagementId,
    brandId: engagement.brandId,
    connectedAccountId,
    receiptEmail: invoiceEmail,
  });
  const intentParams = {
    ...baseIntentParams,
    metadata: { ...baseIntentParams.metadata, chargeKind },
  };

  let clientSecret: string | null;
  try {
    const stripe = getStripeClient();
    let createNewIntent = !existingPaymentIntentId;
    if (existingPaymentIntentId) {
      const existing = await stripe.paymentIntents.retrieve(existingPaymentIntentId);
      if (existing.status === "succeeded") {
        await markEngagementDepositPaid(engagementId, engagement.brandId, {
          provider: "stripe",
          reference: existing.id,
          amount: existing.amount_received / 100,
          currency: existing.currency.toUpperCase(),
        });
        return NextResponse.json({ alreadyResolved: true, amountDueNow: existing.amount_received / 100 });
      }
      if (existing.status === "requires_payment_method" || existing.status === "requires_confirmation") {
        const updated = await stripe.paymentIntents.update(existingPaymentIntentId, {
          amount: intentParams.amount,
          ...(invoiceEmail ? { receipt_email: invoiceEmail } : {}),
        });
        clientSecret = updated.client_secret;
      } else if (existing.status === "canceled") {
        createNewIntent = true;
        clientSecret = null;
      } else {
        clientSecret = existing.client_secret;
      }
    } else {
      clientSecret = null;
    }

    if (createNewIntent) {
      const previousAttempt = typeof existingServices.stripePaymentAttempt === "number"
        ? existingServices.stripePaymentAttempt
        : 0;
      const paymentAttempt = previousAttempt + 1;
      let created;
      try {
        created = await stripe.paymentIntents.create(intentParams, {
          idempotencyKey: `proposal:${engagementId}:${checkout.selectionHash}:${paymentAttempt}`,
        });
      } catch (destinationError) {
        // A stale/mismatched Connect account must not prevent the lead from
        // paying. Retry on the platform account while retaining payment
        // metadata so the engagement can still be reconciled.
        if (!connectedAccountId) throw destinationError;
        console.error("[payment-intent] Connected-account charge failed; retrying on platform:", destinationError);
        const platformParams = destinationPaymentIntentParams({
          amountInCents,
          engagementId,
          brandId: engagement.brandId,
          connectedAccountId: null,
          receiptEmail: invoiceEmail,
        });
        created = await stripe.paymentIntents.create(
          {
            ...platformParams,
            metadata: { ...platformParams.metadata, chargeKind, paymentRouting: "platform-fallback" },
          },
          { idempotencyKey: `proposal:${engagementId}:${checkout.selectionHash}:${paymentAttempt}:platform` },
        );
      }
      clientSecret = created.client_secret;
      const proposalBuilderState = {
        ...existingState,
        services: { ...existingServices, stripePaymentIntentId: created.id, stripePaymentAttempt: paymentAttempt },
        version: 1,
        updatedAt: new Date().toISOString(),
      };
      await prisma.engagement.update({
        where: { id: engagementId },
        data: { onboardingData: { ...onboardingData, proposalBuilderState } as Prisma.InputJsonValue },
      });
    }
  } catch (error) {
    console.error("[payment-intent] Failed to create/update PaymentIntent:", error);
    return NextResponse.json({ error: "We couldn't start the payment form. Please try again shortly." }, { status: 500 });
  }

  return NextResponse.json({ clientSecret, amountDueNow: chargeAmount, chargeKind });
}
