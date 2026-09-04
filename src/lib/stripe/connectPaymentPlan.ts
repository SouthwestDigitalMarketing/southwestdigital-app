export type ExistingIntentSnapshot = {
  id: string;
  status: string;
  transferDestination: string | null;
};

export type ConnectPaymentPlan =
  | { kind: "block"; reason: "no-active-connect" | "cross-brand-destination"; status: number; error: string }
  | { kind: "already-paid"; intentId: string }
  | { kind: "reuse-update"; intentId: string }
  | { kind: "reuse-as-is"; intentId: string }
  | { kind: "create-fresh" }
  | { kind: "cancel-and-create"; cancelIntentId: string; reason: "missing-destination" | "wrong-destination" | "was-canceled" };

// Statuses where Stripe permits amount updates. Anything else must be reused
// as-is (the client will complete it) or cancelled and recreated.
const UPDATABLE_STATUSES = new Set(["requires_payment_method", "requires_confirmation"]);
// Terminal or unusable statuses where the intent can no longer be paid; we
// must start a new one.
const DEAD_STATUSES = new Set(["canceled"]);

// Decide what to do about the destination charge for a proposal payment,
// given the brand's currently active connected account and any prior
// PaymentIntent recorded for the engagement.
//
// The rule is strict: if the brand does not have an ACTIVE Stripe Connect
// account, payment is blocked. If a prior PaymentIntent exists but its
// destination is missing or does not match the current active account, it is
// cancelled and a new one is created so funds cannot land on the wrong
// account.
export function planConnectedPaymentIntent(input: {
  activeConnectedAccountId: string | null;
  existingIntent: ExistingIntentSnapshot | null;
}): ConnectPaymentPlan {
  const { activeConnectedAccountId, existingIntent } = input;

  if (!activeConnectedAccountId) {
    return {
      kind: "block",
      reason: "no-active-connect",
      status: 409,
      error: "This brand can't accept payments yet. Complete Stripe Connect setup in Settings before sending a proposal.",
    };
  }

  if (!existingIntent) {
    return { kind: "create-fresh" };
  }

  if (existingIntent.status === "succeeded") {
    return { kind: "already-paid", intentId: existingIntent.id };
  }

  if (DEAD_STATUSES.has(existingIntent.status)) {
    return { kind: "create-fresh" };
  }

  const destination = existingIntent.transferDestination;
  if (destination === null) {
    return {
      kind: "cancel-and-create",
      cancelIntentId: existingIntent.id,
      reason: "missing-destination",
    };
  }
  if (destination !== activeConnectedAccountId) {
    return {
      kind: "cancel-and-create",
      cancelIntentId: existingIntent.id,
      reason: "wrong-destination",
    };
  }

  if (UPDATABLE_STATUSES.has(existingIntent.status)) {
    return { kind: "reuse-update", intentId: existingIntent.id };
  }
  return { kind: "reuse-as-is", intentId: existingIntent.id };
}
