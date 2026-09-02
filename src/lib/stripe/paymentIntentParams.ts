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
    payment_method_types: ["card", "us_bank_account", "cashapp", "klarna"],
    ...(input.receiptEmail ? { receipt_email: input.receiptEmail } : {}),
    ...(input.connectedAccountId
      ? { transfer_data: { destination: input.connectedAccountId } }
      : {}),
  };
}
