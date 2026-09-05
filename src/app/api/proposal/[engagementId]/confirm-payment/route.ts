import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getStripeClient } from "@/lib/stripe";
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
  if (!await hasPublicProposalAccess(request, engagementId, "reconcile")) return publicProposalNotFound();
  const engagement = await prisma.engagement.findUnique({
    where: { id: engagementId },
    select: { brandId: true, onboardingFeeStatus: true, onboardingData: true },
  });
  if (!engagement) return NextResponse.json({ error: "Engagement not found" }, { status: 404 });
  if (engagement.onboardingFeeStatus === "PAID") return NextResponse.json({ ok: true, paid: true });

  const onboardingData = isRecord(engagement.onboardingData) ? engagement.onboardingData : {};
  const builderState = isRecord(onboardingData.proposalBuilderState) ? onboardingData.proposalBuilderState : {};
  const services = isRecord(builderState.services) ? builderState.services : {};
  const paymentIntentId =
    typeof services.stripePaymentIntentId === "string" ? services.stripePaymentIntentId : null;
  if (!paymentIntentId) {
    return NextResponse.json({ error: "No payment has been started for this proposal." }, { status: 400 });
  }

  try {
    const paymentIntent = await getStripeClient().paymentIntents.retrieve(paymentIntentId, {
      expand: ["latest_charge"],
    });
    if (paymentIntent.status === "succeeded") {
      const latestCharge = typeof paymentIntent.latest_charge === "object" ? paymentIntent.latest_charge : null;
      await markEngagementDepositPaid(engagementId, engagement.brandId, {
        provider: "stripe",
        reference: paymentIntent.id,
        amount: paymentIntent.amount_received / 100,
        currency: paymentIntent.currency.toUpperCase(),
        receiptUrl: latestCharge?.receipt_url ?? null,
      });
      return NextResponse.json({ ok: true, paid: true });
    }
    return NextResponse.json({ ok: true, paid: false, status: paymentIntent.status });
  } catch (error) {
    console.error("[confirm-payment] Failed:", error);
    return NextResponse.json({ error: "We couldn't confirm this payment." }, { status: 500 });
  }
}
