"use client";

import { useState } from "react";
import { PayPalScriptProvider, PayPalButtons } from "@paypal/react-paypal-js";

const clientId = process.env.NEXT_PUBLIC_PAYPAL_CLIENT_ID;

export default function PaypalPaymentButton({
  engagementId,
  proposalToken,
  onPaid,
}: {
  engagementId: string;
  proposalToken?: string | null;
  onPaid: (status: "succeeded" | "processing") => void;
}) {
  const [error, setError] = useState<string | null>(null);

  if (!clientId) {
    return (
      <p className="text-sm text-red-600">
        PayPal isn&apos;t configured yet. Please contact us to complete your deposit.
      </p>
    );
  }

  return (
    <PayPalScriptProvider
      options={{
        clientId,
        currency: "USD",
        intent: "capture",
        disableFunding: ["card", "paylater"],
      }}
    >
      <div className="space-y-2">
        <PayPalButtons
          style={{ layout: "vertical", label: "pay", disableMaxWidth: true }}
          createOrder={async () => {
            setError(null);
            const response = await fetch(`/api/proposal/${engagementId}/paypal/create-order`, {
              method: "POST",
              headers: proposalToken ? { "x-proposal-token": proposalToken } : undefined,
            });
            const result = await response.json().catch(() => null);
            if (!response.ok || !result?.orderId) {
              setError(result?.error ?? "Unable to start PayPal checkout.");
              throw new Error(result?.error ?? "Unable to start PayPal checkout.");
            }
            return result.orderId;
          }}
          onApprove={async (data) => {
            const response = await fetch(`/api/proposal/${engagementId}/paypal/capture-order`, {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                ...(proposalToken ? { "x-proposal-token": proposalToken } : {}),
              },
              body: JSON.stringify({ orderId: data.orderID }),
            });
            const result = await response.json().catch(() => null);
            if (!response.ok || !result?.ok) {
              setError(result?.error ?? "We couldn't confirm your PayPal payment.");
              return;
            }
            onPaid("succeeded");
          }}
          onError={() => setError("Something went wrong processing your PayPal payment.")}
        />
        {error ? <p className="text-xs text-red-600">{error}</p> : null}
      </div>
    </PayPalScriptProvider>
  );
}
