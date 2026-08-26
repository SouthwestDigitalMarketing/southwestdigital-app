import { NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { paypalFetch } from "@/lib/paypal";

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
    select: { onboardingFee: true, onboardingFeeStatus: true, onboardingData: true },
  });
  if (!engagement) return NextResponse.json({ error: "Engagement not found" }, { status: 404 });

  const onboardingFee = engagement.onboardingFee ? Number(engagement.onboardingFee) : 0;
  if (onboardingFee <= 0) return NextResponse.json({ error: "No engagement fee set for this proposal yet" }, { status: 400 });
  if (engagement.onboardingFeeStatus === "PAID") return NextResponse.json({ error: "This deposit has already been paid" }, { status: 400 });

  try {
    const response = await paypalFetch("/v2/checkout/orders", {
      method: "POST",
      body: JSON.stringify({
        intent: "CAPTURE",
        purchase_units: [{
          custom_id: engagementId,
          amount: { currency_code: "USD", value: onboardingFee.toFixed(2) },
        }],
      }),
    });
    if (!response.ok) {
      const body = await response.text().catch(() => "");
      console.error("[paypal/create-order] PayPal API error:", response.status, body);
      return NextResponse.json({ error: "We couldn't start PayPal checkout. Please try again shortly." }, { status: 500 });
    }
    const order = (await response.json()) as { id: string };

    const onboardingData = isRecord(engagement.onboardingData) ? engagement.onboardingData : {};
    const existingState = isRecord(onboardingData.proposalBuilderState) ? onboardingData.proposalBuilderState : {};
    const existingServices = isRecord(existingState.services) ? existingState.services : {};
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

    return NextResponse.json({ orderId: order.id });
  } catch (error) {
    console.error("[paypal/create-order] Failed:", error);
    return NextResponse.json({ error: "We couldn't start PayPal checkout. Please try again shortly." }, { status: 500 });
  }
}
