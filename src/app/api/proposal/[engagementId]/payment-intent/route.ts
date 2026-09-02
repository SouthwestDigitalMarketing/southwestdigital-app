import { NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getStripeClient } from "@/lib/stripe";
import { getChargeableConnectedAccountId } from "@/lib/stripe/connect";
import { destinationPaymentIntentParams } from "@/lib/stripe/paymentIntentParams";

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ engagementId: string }> },
) {
  const { engagementId } = await params;

  const engagement = await prisma.engagement.findUnique({
    where: { id: engagementId },
    select: { brandId: true, onboardingFee: true, onboardingFeeStatus: true, onboardingData: true },
  });
  if (!engagement) return NextResponse.json({ error: "Engagement not found" }, { status: 404 });

  const onboardingFee = engagement.onboardingFee ? Number(engagement.onboardingFee) : 0;
  if (onboardingFee <= 0) {
    return NextResponse.json({ error: "No engagement fee set for this proposal yet" }, { status: 400 });
  }
  if (engagement.onboardingFeeStatus === "PAID") {
    return NextResponse.json({ error: "This deposit has already been paid" }, { status: 400 });
  }

  const onboardingData = isRecord(engagement.onboardingData) ? engagement.onboardingData : {};
  const existingState = isRecord(onboardingData.proposalBuilderState) ? onboardingData.proposalBuilderState : {};
  const existingServices = isRecord(existingState.services) ? existingState.services : {};
  const invoiceEmail = typeof existingServices.invoiceEmail === "string" ? existingServices.invoiceEmail : undefined;
  const existingPaymentIntentId = typeof existingServices.stripePaymentIntentId === "string" ? existingServices.stripePaymentIntentId : null;

  const amountInCents = Math.round(onboardingFee * 100);
  const connectedAccountId = await getChargeableConnectedAccountId(engagement.brandId);
  const intentParams = destinationPaymentIntentParams({
    amountInCents,
    engagementId,
    brandId: engagement.brandId,
    connectedAccountId,
    receiptEmail: invoiceEmail,
  });

  let clientSecret: string | null;
  try {
    const stripe = getStripeClient();
    if (existingPaymentIntentId) {
      const existing = await stripe.paymentIntents.retrieve(existingPaymentIntentId);
      if (existing.status === "requires_payment_method" || existing.status === "requires_confirmation") {
        const updated = await stripe.paymentIntents.update(existingPaymentIntentId, {
          amount: intentParams.amount,
          ...(invoiceEmail ? { receipt_email: invoiceEmail } : {}),
        });
        clientSecret = updated.client_secret;
      } else {
        clientSecret = existing.client_secret;
      }
    } else {
      const created = await stripe.paymentIntents.create(intentParams);
      clientSecret = created.client_secret;
      const proposalBuilderState = {
        ...existingState,
        services: { ...existingServices, stripePaymentIntentId: created.id },
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

  return NextResponse.json({ clientSecret });
}
