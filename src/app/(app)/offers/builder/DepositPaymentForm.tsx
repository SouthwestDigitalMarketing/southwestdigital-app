"use client";

import { useState } from "react";
import type { FormEvent } from "react";
import { loadStripe } from "@stripe/stripe-js";
import { Elements, PaymentElement, useStripe, useElements } from "@stripe/react-stripe-js";

const publishableKey = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY;
const stripePromise = publishableKey ? loadStripe(publishableKey) : null;

function CheckoutForm({ onPaid }: { onPaid: (status: "succeeded" | "processing") => void }) {
  const stripe = useStripe();
  const elements = useElements();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!stripe || !elements) return;
    setSubmitting(true);
    setError(null);
    const { error: confirmError, paymentIntent } = await stripe.confirmPayment({
      elements,
      redirect: "if_required",
    });
    if (confirmError) {
      setError(confirmError.message ?? "Something went wrong processing your payment.");
      setSubmitting(false);
      return;
    }
    onPaid(paymentIntent?.status === "processing" ? "processing" : "succeeded");
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <PaymentElement options={{ layout: { type: "tabs" } }} />
      {error ? <p className="text-xs text-red-600">{error}</p> : null}
      <button
        type="submit"
        disabled={!stripe || submitting}
        className="ui-action-primary w-full rounded-lg border-2 px-5 py-3 text-sm font-bold transition-all hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:translate-y-0"
      >
        {submitting ? "Processing…" : "Pay now"}
      </button>
    </form>
  );
}

export default function DepositPaymentForm({
  clientSecret,
  onPaid,
}: {
  clientSecret: string;
  onPaid: (status: "succeeded" | "processing") => void;
}) {
  if (!stripePromise) {
    return (
      <p className="text-sm text-red-600">
        Payment isn&apos;t configured yet. Please contact us to complete your deposit.
      </p>
    );
  }
  return (
    <Elements stripe={stripePromise} options={{ clientSecret }}>
      <CheckoutForm onPaid={onPaid} />
    </Elements>
  );
}
