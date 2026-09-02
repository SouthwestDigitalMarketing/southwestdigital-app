import { NextResponse } from "next/server";
import { getStripeClient } from "@/lib/stripe";
import { markEngagementDepositPaid } from "@/lib/engagements/fromOffer";
import { syncConnectedAccountStatus } from "@/lib/stripe/connect";

export async function POST(request: Request) {
  const signature = request.headers.get("stripe-signature");
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!signature || !webhookSecret) {
    return NextResponse.json({ error: "Webhook not configured" }, { status: 400 });
  }

  const rawBody = await request.text();
  const stripe = getStripeClient();

  let event;
  try {
    event = stripe.webhooks.constructEvent(rawBody, signature, webhookSecret);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Invalid signature";
    return NextResponse.json({ error: `Webhook signature verification failed: ${message}` }, { status: 400 });
  }

  if (event.type === "payment_intent.succeeded") {
    const paymentIntent = event.data.object;
    const engagementId = paymentIntent.metadata?.engagementId;
    const brandId = paymentIntent.metadata?.brandId;
    if (engagementId) {
      await markEngagementDepositPaid(engagementId, brandId || undefined);
    }
  }

  if (event.type === "account.updated") {
    const account = event.data.object;
    if (account.id) {
      await syncConnectedAccountStatus(account.id);
    }
  }

  return NextResponse.json({ received: true });
}
