import { NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getStripeClient } from "@/lib/stripe";
import { getChargeableConnectedAccountId } from "@/lib/stripe/connect";
import { destinationPaymentIntentParams } from "@/lib/stripe/paymentIntentParams";
import { asRecord, readAcceptedPayment, readStripePaymentExpectation } from "@/lib/engagements/acceptedPayment";
import { matchesProposalPayment, PaymentReconciliationError, reconcileProposalPayment } from "@/lib/stripe/reconcileProposalPayment";
import { hasPublicProposalAccess, publicProposalNotFound } from "@/lib/engagements/publicProposalAccess";

export async function POST(request: Request, { params }: { params: Promise<{ engagementId: string }> }) {
  const { engagementId } = await params;
  if (!await hasPublicProposalAccess(request, engagementId)) return publicProposalNotFound();
  const engagement = await prisma.engagement.findUnique({
    where: { id: engagementId },
    select: { brandId: true, onboardingFeeStatus: true, onboardingData: true, agreementManagerStatus: true, signedAt: true, updatedAt: true, billingContactEmail: true },
  });
  if (!engagement) return publicProposalNotFound();
  if (["VOIDED", "VOIDED_BEFORE_SIGNATURE", "CANCELLATION_REQUESTED", "TERMINATED_AFTER_SIGNATURE"].includes(engagement.agreementManagerStatus)) {
    return NextResponse.json({ error: "Payment is unavailable for this agreement." }, { status: 409 });
  }
  if (!engagement.signedAt) return NextResponse.json({ error: "The agreement must be signed before payment." }, { status: 409 });
  if (engagement.onboardingFeeStatus === "PAID") return NextResponse.json({ alreadyResolved: true });

  const accepted = readAcceptedPayment(engagement.onboardingData);
  if (!accepted) return NextResponse.json({ error: "This signed proposal needs a payment review by your bookkeeper before checkout can continue." }, { status: 409 });
  if (accepted.amountInCents === 0) {
    const resolved = await prisma.$transaction(async (tx) => {
      const updated = await tx.engagement.updateMany({
        where: { id: engagementId, brandId: engagement.brandId, updatedAt: engagement.updatedAt },
        data: { onboardingFeeStatus: "WAIVED", status: "DEPOSIT_PAID" },
      });
      if (updated.count !== 1) return false;
      await tx.quote.updateMany({
        where: { engagementId, brandId: engagement.brandId, status: { not: "archived" } },
        data: { status: "completed", lastActivityAt: new Date() },
      });
      return true;
    });
    return resolved ? NextResponse.json({ waived: true }) : NextResponse.json({ error: "The proposal changed. Please reload." }, { status: 409 });
  }

  const onboardingData = asRecord(engagement.onboardingData);
  const builderState = asRecord(onboardingData.proposalBuilderState);
  const services = asRecord(builderState.services);
  const savedExpectation = readStripePaymentExpectation(onboardingData);
  const priorIntentId = typeof services.stripePaymentIntentId === "string" ? services.stripePaymentIntentId : null;
  const stripe = getStripeClient();
  try {
    const existing = priorIntentId ? await stripe.paymentIntents.retrieve(priorIntentId) : null;
    if (existing?.status === "succeeded") {
      await reconcileProposalPayment(existing, engagementId, engagement.brandId);
      return NextResponse.json({ alreadyResolved: true });
    }
    const connectedAccountId = await getChargeableConnectedAccountId(engagement.brandId);
    if (!connectedAccountId) return NextResponse.json({ error: "This firm cannot accept payments until its administrator completes Stripe Connect setup." }, { status: 409 });

    if (existing && existing.status !== "canceled") {
      if (existing.metadata.brandId !== engagement.brandId || existing.metadata.engagementId !== engagementId) throw new PaymentReconciliationError();
      if (savedExpectation && savedExpectation.brandId === engagement.brandId &&
          savedExpectation.engagementId === engagementId && savedExpectation.connectedAccountId === connectedAccountId &&
          matchesProposalPayment(existing, savedExpectation, accepted, false)) {
        return NextResponse.json({ clientSecret: existing.client_secret, amountDueNow: accepted.amountInCents / 100, chargeKind: accepted.chargeKind });
      }
      // Never create a second payable intent if cancellation is uncertain.
      if (!["requires_payment_method", "requires_confirmation", "requires_action"].includes(existing.status)) throw new PaymentReconciliationError();
      const canceled = await stripe.paymentIntents.cancel(existing.id);
      if (canceled.status !== "canceled") throw new PaymentReconciliationError();
    }

    const previousAttempt = typeof services.stripePaymentAttempt === "number" && Number.isSafeInteger(services.stripePaymentAttempt) && services.stripePaymentAttempt >= 0
      ? services.stripePaymentAttempt : 0;
    const paymentAttempt = previousAttempt + 1;
    const base = destinationPaymentIntentParams({
      amountInCents: accepted.amountInCents, engagementId, brandId: engagement.brandId,
      connectedAccountId, receiptEmail: engagement.billingContactEmail ?? undefined,
    });
    const created = await stripe.paymentIntents.create({
      ...base, metadata: { ...base.metadata, selectionHash: accepted.selectionHash, chargeKind: accepted.chargeKind },
    }, { idempotencyKey: `proposal:${engagementId}:${accepted.selectionHash}:${paymentAttempt}` });
    const expectation = {
      ...accepted, intentId: created.id, brandId: engagement.brandId, engagementId,
      connectedAccountId, livemode: created.livemode,
    };
    const updated = await prisma.engagement.updateMany({
      where: { id: engagementId, brandId: engagement.brandId, updatedAt: engagement.updatedAt },
      data: { onboardingData: {
        ...onboardingData,
        proposalBuilderState: { ...builderState, services: {
          ...services, stripePaymentIntentId: created.id, stripePaymentAttempt: paymentAttempt, stripePaymentExpectation: expectation,
        } },
      } as Prisma.InputJsonValue },
    });
    // A concurrent request uses the same idempotency key. Do not cancel here:
    // the winning request may already have saved and displayed that intent.
    if (updated.count !== 1) return NextResponse.json({ error: "Checkout changed in another tab. Reload to continue safely." }, { status: 409 });
    return NextResponse.json({ clientSecret: created.client_secret, amountDueNow: accepted.amountInCents / 100, chargeKind: accepted.chargeKind });
  } catch (error) {
    if (error instanceof PaymentReconciliationError) return NextResponse.json({ error: error.message }, { status: 409 });
    console.error("[payment-intent] Could not prepare payment:", error);
    return NextResponse.json({ error: "We couldn't start the payment form. Please try again shortly." }, { status: 500 });
  }
}
