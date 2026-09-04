import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { paypalFetch } from "@/lib/paypal";
import { markEngagementDepositPaid } from "@/lib/engagements/fromOffer";
import { hasPublicProposalAccess, publicProposalNotFound } from "@/lib/engagements/publicProposalAccess";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ engagementId: string }> },
) {
  const { engagementId } = await params;
  if (!await hasPublicProposalAccess(request, engagementId)) return publicProposalNotFound();

  const body = (await request.json().catch(() => null)) as { orderId?: unknown } | null;
  const orderId = typeof body?.orderId === "string" ? body.orderId : "";
  if (!orderId) return NextResponse.json({ error: "Missing PayPal order id" }, { status: 400 });

  const engagement = await prisma.engagement.findUnique({
    where: { id: engagementId },
    select: { brandId: true, onboardingFeeStatus: true, onboardingData: true },
  });
  if (!engagement) return NextResponse.json({ error: "Engagement not found" }, { status: 404 });

  if (engagement.onboardingFeeStatus === "PAID") return NextResponse.json({ ok: true });

  const onboardingData = engagement.onboardingData && typeof engagement.onboardingData === "object" && !Array.isArray(engagement.onboardingData)
    ? engagement.onboardingData as Record<string, unknown>
    : {};
  const builderState = onboardingData.proposalBuilderState && typeof onboardingData.proposalBuilderState === "object" && !Array.isArray(onboardingData.proposalBuilderState)
    ? onboardingData.proposalBuilderState as Record<string, unknown>
    : {};
  const services = builderState.services && typeof builderState.services === "object" && !Array.isArray(builderState.services)
    ? builderState.services as Record<string, unknown>
    : {};
  if (services.paypalOrderId !== orderId) {
    return NextResponse.json({ error: "This PayPal order does not belong to the proposal." }, { status: 409 });
  }

  try {
    const response = await paypalFetch(`/v2/checkout/orders/${orderId}/capture`, { method: "POST" });
    if (!response.ok) {
      const errorBody = await response.text().catch(() => "");
      console.error("[paypal/capture-order] PayPal API error:", response.status, errorBody);
      return NextResponse.json({ error: "We couldn't confirm your PayPal payment. Please try again." }, { status: 500 });
    }
    const captureResult = (await response.json()) as {
      status?: string;
      purchase_units?: Array<{
        payments?: { captures?: Array<{ id?: string; amount?: { value?: string; currency_code?: string } }> };
      }>;
    };
    if (captureResult.status !== "COMPLETED") {
      return NextResponse.json({ error: "PayPal payment was not completed." }, { status: 400 });
    }
    const capture = captureResult.purchase_units?.[0]?.payments?.captures?.[0];
    await markEngagementDepositPaid(engagementId, engagement.brandId, {
      provider: "paypal",
      reference: capture?.id ?? orderId,
      amount: Number(capture?.amount?.value ?? 0),
      currency: capture?.amount?.currency_code ?? "USD",
    });
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[paypal/capture-order] Failed:", error);
    return NextResponse.json({ error: "We couldn't confirm your PayPal payment. Please try again." }, { status: 500 });
  }
}
