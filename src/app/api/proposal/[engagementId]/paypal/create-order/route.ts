import { NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { paypalFetch } from "@/lib/paypal";
import { resolveOnboardingWaiverForEngagement } from "@/lib/discounts/resolveOnboardingWaiver";
import { parseStoredProposalCheckout, resolveAmountDueNow } from "@/lib/engagements/proposalCheckout";
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
    select: {
      onboardingFeeStatus: true,
      onboardingData: true,
      isTestProposal: true,
      signedAt: true,
      agreementManagerStatus: true,
    },
  });
  if (!engagement) return NextResponse.json({ error: "Engagement not found" }, { status: 404 });
  if (!engagement.signedAt) {
    return NextResponse.json({ error: "The agreement must be signed before payment." }, { status: 409 });
  }
  if (engagement.agreementManagerStatus !== "ACTIVE" && engagement.agreementManagerStatus !== "ARCHIVED") {
    return NextResponse.json({ error: "Payment is unavailable for this agreement." }, { status: 409 });
  }
  if (engagement.onboardingFeeStatus === "PAID") {
    return NextResponse.json({ error: "This proposal has already been paid." }, { status: 409 });
  }

  const onboardingData = isRecord(engagement.onboardingData) ? engagement.onboardingData : {};
  const existingState = isRecord(onboardingData.proposalBuilderState) ? onboardingData.proposalBuilderState : {};
  const existingServices = isRecord(existingState.services) ? existingState.services : {};
  const checkout = parseStoredProposalCheckout(existingServices);
  if (!checkout) {
    return NextResponse.json({ error: "Select a valid published pricing option before payment." }, { status: 409 });
  }
  const waiverActive = engagement.onboardingFeeStatus === "WAIVED"
    || await resolveOnboardingWaiverForEngagement(engagementId);
  const chargeAmount = resolveAmountDueNow({
    checkout,
    onboardingWaived: waiverActive,
    isTestProposal: engagement.isTestProposal,
  });
  if (chargeAmount <= 0) {
    return NextResponse.json({ error: "No amount is due for this proposal." }, { status: 409 });
  }

  try {
    const response = await paypalFetch("/v2/checkout/orders", {
      method: "POST",
      body: JSON.stringify({
        intent: "CAPTURE",
        purchase_units: [{
          custom_id: engagementId,
          amount: { currency_code: "USD", value: chargeAmount.toFixed(2) },
        }],
      }),
    });
    if (!response.ok) {
      const body = await response.text().catch(() => "");
      console.error("[paypal/create-order] PayPal API error:", response.status, body);
      return NextResponse.json({ error: "We couldn't start PayPal checkout. Please try again shortly." }, { status: 500 });
    }
    const order = (await response.json()) as { id: string };

    const proposalBuilderState = {
      ...existingState,
      services: { ...existingServices, paypalOrderId: order.id },
      version: 1,
      updatedAt: new Date().toISOString(),
    };
    await prisma.engagement.update({
      where: { id: engagementId },
      data: { onboardingData: { ...onboardingData, proposalBuilderState } as Prisma.InputJsonValue },
    });

    return NextResponse.json({ orderId: order.id, amountDueNow: chargeAmount });
  } catch (error) {
    console.error("[paypal/create-order] Failed:", error);
    return NextResponse.json({ error: "We couldn't start PayPal checkout. Please try again shortly." }, { status: 500 });
  }
}
