import { NextResponse } from "next/server";
import { getStripeClient } from "@/lib/stripe";
import { reconcileProposalPayment } from "@/lib/stripe/reconcileProposalPayment";
import { recordProcessedStripeEvent, stripeEventAlreadyProcessed } from "@/lib/stripe/processedStripeEvents";
import { syncConnectedAccountStatus } from "@/lib/stripe/connect";
import { sendProposalAlert } from "@/lib/notifications/staffAlert";

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
    if (engagementId || brandId) {
      if (!engagementId || !brandId) return NextResponse.json({ error: "Incomplete proposal payment metadata" }, { status: 409 });
      if (!event.id) return NextResponse.json({ error: "Payment reconciliation pending" }, { status: 500 });
      if (await stripeEventAlreadyProcessed(engagementId, brandId, event.id)) {
        return NextResponse.json({ received: true });
      }
      try {
        await reconcileProposalPayment(paymentIntent, engagementId, brandId);
        await recordProcessedStripeEvent(engagementId, brandId, event.id);
      } catch {
        // Retain provider retries; never acknowledge an unapplied proposal
        // payment as successfully reconciled. Do not record event.id on throw.
        console.error("[stripe/webhook] Proposal payment requires reconciliation", { eventId: event.id, intentId: paymentIntent.id });
        return NextResponse.json({ error: "Payment reconciliation pending" }, { status: 500 });
      }
    }
  }

  if (event.type === "payment_intent.processing") {
    const paymentIntent = event.data.object;
    const engagementId = paymentIntent.metadata?.engagementId;
    const brandId = paymentIntent.metadata?.brandId;
    if (engagementId && brandId && event.id && !await stripeEventAlreadyProcessed(engagementId, brandId, event.id)) {
      await sendProposalAlert(engagementId, brandId, {
        kind: "processing", amount: paymentIntent.amount / 100, currency: paymentIntent.currency,
      });
      await recordProcessedStripeEvent(engagementId, brandId, event.id).catch(() => undefined);
    }
  }

  if (event.type === "payment_intent.payment_failed") {
    const paymentIntent = event.data.object;
    const engagementId = paymentIntent.metadata?.engagementId;
    const brandId = paymentIntent.metadata?.brandId;
    if (engagementId && brandId && event.id && !await stripeEventAlreadyProcessed(engagementId, brandId, event.id)) {
      await sendProposalAlert(engagementId, brandId, {
        kind: "failed", amount: paymentIntent.amount / 100, currency: paymentIntent.currency,
        detail: paymentIntent.last_payment_error?.message ?? paymentIntent.last_payment_error?.code ?? null,
      });
      await recordProcessedStripeEvent(engagementId, brandId, event.id).catch(() => undefined);
    }
    if (engagementId) {
      // A failed ACH debit returns the intent to requires_payment_method, so the
      // deposit stays unpaid and the client can retry from the proposal link.
      console.error("[stripe/webhook] Proposal payment failed", {
        eventId: event.id, intentId: paymentIntent.id, engagementId, brandId: paymentIntent.metadata?.brandId,
        code: paymentIntent.last_payment_error?.code ?? null,
        paymentMethodType: paymentIntent.last_payment_error?.payment_method?.type ?? null,
      });
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
