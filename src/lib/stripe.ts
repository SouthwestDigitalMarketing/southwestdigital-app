import Stripe from "stripe";

export type StripeMode = "live" | "test";

const clients: Partial<Record<StripeMode, Stripe>> = {};

export function getStripeClient(mode: StripeMode = "live"): Stripe {
  if (clients[mode]) return clients[mode];
  const envName = mode === "test" ? "STRIPE_TEST_SECRET_KEY" : "STRIPE_SECRET_KEY";
  const secretKey = process.env[envName]
    // Local development already uses a test STRIPE_SECRET_KEY. Production
    // must set the explicit test key so test proposals cannot use live mode.
    ?? (mode === "test" && process.env.NODE_ENV !== "production" ? process.env.STRIPE_SECRET_KEY : undefined);
  if (!secretKey) throw new Error(`${envName} is not set`);
  clients[mode] = new Stripe(secretKey);
  return clients[mode];
}
