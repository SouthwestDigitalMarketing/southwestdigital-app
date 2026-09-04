import { NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getStripeClient } from "@/lib/stripe";
import { getChargeableConnectedAccountId } from "@/lib/stripe/connect";
import { destinationPaymentIntentParams } from "@/lib/stripe/paymentIntentParams";
import { planConnectedPaymentIntent } from "@/lib/stripe/connectPaymentPlan";
import { resolveOnboardingWaiverForEngagement } from "@/lib/discounts/resolveOnboardingWaiver";
import {
  parseStoredProposalCheckout,
  resolveAmountDueNow,
} from "@/lib/engagements/proposalCheckout";
import {
  parseStoredHourlyCheckout,
  resolveHourlyAmountDueNow,
} from "@/lib/engagements/hourlyCheckout";
import { markEngagementDepositPaid } from "@/lib/engagements/fromOffer";
import { hasPublicProposalAccess, publicProposalNotFound } from "@/lib/engagements/publicProposalAccess";

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function extractTransferDestination(intent: { transfer_data?: { destination?: string | { id?: string } | null } | null }): string | null {
  const dest = intent.transfer_data?.destination;
  if (!dest) return null;
  if (typeof dest === "string") return dest;
  if (typeof dest === "object" && typeof dest.id === "string") return dest.id;
  return null;
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ engagementId: string }> },
) {
  const { engagementId } = await params;
  if (!await hasPublicProposalAccess(request, engagementId)) return publicProposalNotFound();

  const engagement = await prisma.engagement.findUnique({
    where: { id: engagementId },
    select: { brandId: true, onboardingFeeStatus: true, onboardingData: true, agreementManagerStatus: true, isTestProposal: true, signedAt: true, productKind: true },
  });
  if (!engagement) return NextResponse.json({ error: "Engagement not found" }, { status: 404 });
  if (engagement.agreementManagerStatus === "VOIDED" || engagement.agreementManagerStatus === "VOIDED_BEFORE_SIGNATURE" || engagement.agreementManagerStatus === "CANCELLATION_REQUESTED" || engagement.agreementManagerStatus === "TERMINATED_AFTER_SIGNATURE") {
    return NextResponse.json({ error: "Payment is unavailable for this agreement." }, { status: 409 });
  }

  if (!engagement.signedAt) {
    return NextResponse.json({ error: "The agreement must be signed before payment." }, { status: 409 });
  }
  const isHourlyKind = engagement.productKind === "consulting" || engagement.productKind === "coaching";
  const onboardingData = isRecord(engagement.onboardingData) ? engagement.onboardingData : {};
  const existingState = isRecord(onboardingData.proposalBuilderState) ? onboardingData.proposalBuilderState : {};
  const existingServices = isRecord(existingState.services) ? existingState.services : {};
  const hourlyCheckout = isHourlyKind
    ? parseStoredHourlyCheckout(existingServices.hourlyCheckout)
    : null;
  const checkout = !isHourlyKind ? parseStoredProposalCheckout(existingServices) : null;
  if (isHourlyKind && !hourlyCheckout) {
    return NextResponse.json({ error: "Republish this hourly proposal before payment." }, { status: 409 });
  }
  if (!isHourlyKind && !checkout) {
    return NextResponse.json({ error: "Select a valid published pricing option before payment." }, { status: 409 });
  }
  const selectionHash = (hourlyCheckout ?? checkout!).selectionHash;
  const invoiceEmail = typeof existingServices.invoiceEmail === "string" ? existingServices.invoiceEmail : undefined;
  const existingPaymentIntentId = typeof existingServices.stripePaymentIntentId === "string" ? existingServices.stripePaymentIntentId : null;
  const waiverActive = engagement.onboardingFeeStatus === "WAIVED"
    || await resolveOnboardingWaiverForEngagement(engagementId);

  if (engagement.onboardingFeeStatus === "PAID") {
    return NextResponse.json({ alreadyResolved: true });
  }

  const chargeAmount = isHourlyKind
    ? resolveHourlyAmountDueNow({
        checkout: hourlyCheckout!,
        isTestProposal: engagement.isTestProposal,
      })
    : resolveAmountDueNow({
        checkout: checkout!,
        onboardingWaived: waiverActive,
        isTestProposal: engagement.isTestProposal,
      });

  if (chargeAmount <= 0) {
    const waivedAt = new Date();
    await prisma.engagement.update({
      where: { id: engagementId },
      data: { onboardingFeeStatus: "WAIVED", status: "DEPOSIT_PAID" },
    });
    await prisma.quote.updateMany({
      where: { engagementId, brandId: engagement.brandId, status: { not: "archived" } },
      data: { lastActivityAt: waivedAt },
    });
    return NextResponse.json({ waived: true });
  }

  const chargeKind = engagement.isTestProposal
    ? "test_proposal"
    : (hourlyCheckout?.chargeKind ?? checkout!.chargeKind);
  const amountInCents = Math.round(chargeAmount * 100);
  const connectedAccountId = await getChargeableConnectedAccountId(engagement.brandId);

  const stripe = getStripeClient();

  let existingIntentSnapshot: { id: string; status: string; transferDestination: string | null } | null = null;
  if (existingPaymentIntentId) {
    try {
      const existing = await stripe.paymentIntents.retrieve(existingPaymentIntentId);
      existingIntentSnapshot = {
        id: existing.id,
        status: existing.status,
        transferDestination: extractTransferDestination(existing),
      };
      if (existing.status === "succeeded") {
        await markEngagementDepositPaid(engagementId, engagement.brandId, {
          provider: "stripe",
          reference: existing.id,
          amount: existing.amount_received / 100,
          currency: existing.currency.toUpperCase(),
        });
        return NextResponse.json({ alreadyResolved: true, amountDueNow: existing.amount_received / 100 });
      }
    } catch (error) {
      console.error("[payment-intent] Failed to retrieve prior PaymentIntent:", error);
      return NextResponse.json({ error: "We couldn't start the payment form. Please try again shortly." }, { status: 500 });
    }
  }

  const plan = planConnectedPaymentIntent({
    activeConnectedAccountId: connectedAccountId,
    existingIntent: existingIntentSnapshot,
  });

  if (plan.kind === "block") {
    return NextResponse.json({ error: plan.error }, { status: plan.status });
  }

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

  try {
    if (plan.kind === "reuse-update") {
      const updated = await stripe.paymentIntents.update(plan.intentId, {
        amount: intentParams.amount,
        ...(invoiceEmail ? { receipt_email: invoiceEmail } : {}),
      });
      return NextResponse.json({ clientSecret: updated.client_secret, amountDueNow: chargeAmount, chargeKind });
    }

    if (plan.kind === "reuse-as-is") {
      const existing = await stripe.paymentIntents.retrieve(plan.intentId);
      return NextResponse.json({ clientSecret: existing.client_secret, amountDueNow: chargeAmount, chargeKind });
    }

    if (plan.kind === "already-paid") {
      return NextResponse.json({ alreadyResolved: true });
    }

    if (plan.kind === "cancel-and-create") {
      try {
        await stripe.paymentIntents.cancel(plan.cancelIntentId);
      } catch (cancelError) {
        // Log but don't fail — the intent may already be in a terminal state
        // Stripe won't accept a cancel for; a fresh intent is still the safe
        // action so the destination is correct going forward.
        console.warn("[payment-intent] Cancel of stale intent failed:", cancelError);
      }
    }

    const previousAttempt = typeof existingServices.stripePaymentAttempt === "number"
      ? existingServices.stripePaymentAttempt
      : 0;
    const paymentAttempt = previousAttempt + 1;
    const created = await stripe.paymentIntents.create(intentParams, {
      idempotencyKey: `proposal:${engagementId}:${selectionHash}:${paymentAttempt}`,
    });
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
    return NextResponse.json({ clientSecret: created.client_secret, amountDueNow: chargeAmount, chargeKind });
  } catch (error) {
    console.error("[payment-intent] Failed to create/update PaymentIntent:", error);
    return NextResponse.json({ error: "We couldn't start the payment form. Please try again shortly." }, { status: 500 });
  }
}
