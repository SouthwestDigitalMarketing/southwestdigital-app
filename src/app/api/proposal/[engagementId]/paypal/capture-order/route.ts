import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { paypalFetch } from "@/lib/paypal";
import { markEngagementDepositPaid } from "@/lib/engagements/fromOffer";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ engagementId: string }> },
) {
  const { engagementId } = await params;

  const body = (await request.json().catch(() => null)) as { orderId?: unknown } | null;
  const orderId = typeof body?.orderId === "string" ? body.orderId : "";
  if (!orderId) return NextResponse.json({ error: "Missing PayPal order id" }, { status: 400 });

  const engagement = await prisma.engagement.findUnique({
    where: { id: engagementId },
    select: { onboardingFeeStatus: true },
  });
  if (!engagement) return NextResponse.json({ error: "Engagement not found" }, { status: 404 });

  if (engagement.onboardingFeeStatus === "PAID") return NextResponse.json({ ok: true });

  try {
    const response = await paypalFetch(`/v2/checkout/orders/${orderId}/capture`, { method: "POST" });
    if (!response.ok) {
      const errorBody = await response.text().catch(() => "");
      console.error("[paypal/capture-order] PayPal API error:", response.status, errorBody);
      return NextResponse.json({ error: "We couldn't confirm your PayPal payment. Please try again." }, { status: 500 });
    }
    const captureResult = (await response.json()) as { status?: string };
    if (captureResult.status !== "COMPLETED") {
      return NextResponse.json({ error: "PayPal payment was not completed." }, { status: 400 });
    }
    await markEngagementDepositPaid(engagementId);
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[paypal/capture-order] Failed:", error);
    return NextResponse.json({ error: "We couldn't confirm your PayPal payment. Please try again." }, { status: 500 });
  }
}
