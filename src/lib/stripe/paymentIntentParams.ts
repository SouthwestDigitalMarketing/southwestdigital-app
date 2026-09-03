export function destinationPaymentIntentParams(input: {
  amountInCents: number;
  engagementId: string;
  brandId: string;
  connectedAccountId?: string | null;
  receiptEmail?: string;
}) {
  return {
    amount: input.amountInCents,
    currency: "usd" as const,
    metadata: {
      engagementId: input.engagementId,
      brandId: input.brandId,
      ...(input.connectedAccountId ? { connectedAccountId: input.connectedAccountId } : {}),
    },
    // Keep the primary Payment Element universally available. PayPal has its
    // own checkout path, and optional methods can reject the entire intent
    // when they are not enabled for a connected account.
    payment_method_types: ["card"],
    ...(input.receiptEmail ? { receipt_email: input.receiptEmail } : {}),
    ...(input.connectedAccountId
      ? { transfer_data: { destination: input.connectedAccountId } }
      : {}),
  };
}
