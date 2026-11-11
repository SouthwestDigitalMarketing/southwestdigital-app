export function destinationPaymentIntentParams(input: {
  amountInCents: number;
  engagementId: string;
  brandId: string;
  connectedAccountId?: string | null;
  receiptEmail?: string;
  /** Offer ACH bank debit beside card. The route retries card-only if Stripe rejects it. */
  allowBankDebit?: boolean;
}) {
  const allowBankDebit = input.allowBankDebit ?? true;
  return {
    amount: input.amountInCents,
    currency: "usd" as const,
    metadata: {
      engagementId: input.engagementId,
      brandId: input.brandId,
      ...(input.connectedAccountId ? { connectedAccountId: input.connectedAccountId } : {}),
    },
    // Destination charges without on_behalf_of use the platform's payment
    // method settings, so ACH needs enabling on the platform account only.
    // ACH settles in about four business days: the intent sits in
    // "processing" and only payment_intent.succeeded marks the deposit paid.
    payment_method_types: allowBankDebit ? ["card", "us_bank_account"] : ["card"],
    ...(allowBankDebit
      ? { payment_method_options: { us_bank_account: {
          verification_method: "automatic" as const,
          financial_connections: { permissions: ["payment_method" as const] },
        } } }
      : {}),
    ...(input.receiptEmail ? { receipt_email: input.receiptEmail } : {}),
    ...(input.connectedAccountId
      ? { transfer_data: { destination: input.connectedAccountId } }
      : {}),
  };
}
