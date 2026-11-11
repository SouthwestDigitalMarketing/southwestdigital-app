import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { POST } from "./route";

const mocks = vi.hoisted(() => ({
  constructEvent: vi.fn(),
  reconcile: vi.fn(),
  alreadyProcessed: vi.fn(),
  record: vi.fn(),
  syncAccount: vi.fn(),
  alert: vi.fn(),
}));
vi.mock("@/lib/stripe", () => ({ getStripeClient: () => ({ webhooks: { constructEvent: mocks.constructEvent } }) }));
vi.mock("@/lib/stripe/reconcileProposalPayment", () => ({ reconcileProposalPayment: mocks.reconcile }));
vi.mock("@/lib/stripe/processedStripeEvents", () => ({
  stripeEventAlreadyProcessed: mocks.alreadyProcessed,
  recordProcessedStripeEvent: mocks.record,
}));
vi.mock("@/lib/stripe/connect", () => ({ syncConnectedAccountStatus: mocks.syncAccount }));
vi.mock("@/lib/notifications/staffAlert", () => ({ sendProposalAlert: mocks.alert }));

function postSucceeded(intent: { id?: string; metadata?: Record<string, string> }, eventId = "evt_1") {
  const event = { id: eventId, type: "payment_intent.succeeded", data: { object: intent } };
  mocks.constructEvent.mockImplementation((_raw: string) => JSON.parse(_raw));
  return POST(new Request("https://firm.example.test/api/stripe/webhook", {
    method: "POST",
    headers: { "stripe-signature": "sig_test" },
    body: JSON.stringify(event),
  }));
}

beforeEach(() => {
  vi.resetAllMocks();
  vi.stubEnv("STRIPE_WEBHOOK_SECRET", "whsec_test");
  mocks.constructEvent.mockImplementation((raw: string) => JSON.parse(raw));
  mocks.reconcile.mockResolvedValue(undefined);
  mocks.alreadyProcessed.mockResolvedValue(false);
  mocks.record.mockResolvedValue(undefined);
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("stripe webhook proposal payments", () => {
  it("acknowledges a duplicate payment_intent.succeeded without reconciling again", async () => {
    const intent = { id: "pi_1", metadata: { engagementId: "eng", brandId: "brand" } };
    mocks.alreadyProcessed.mockResolvedValueOnce(false).mockResolvedValueOnce(true);
    const first = await postSucceeded(intent);
    const second = await postSucceeded(intent);
    expect(first.status).toBe(200);
    expect(await first.json()).toEqual({ received: true });
    expect(second.status).toBe(200);
    expect(await second.json()).toEqual({ received: true });
    expect(mocks.reconcile).toHaveBeenCalledTimes(1);
    expect(mocks.record).toHaveBeenCalledTimes(1);
    expect(mocks.record).toHaveBeenCalledWith("eng", "brand", "evt_1");
  });

  it("fails closed when reconciliation rejects an amount mismatch", async () => {
    mocks.reconcile.mockRejectedValue(new Error("needs review"));
    const response = await postSucceeded({ id: "pi_1", metadata: { engagementId: "eng", brandId: "brand" } });
    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({ error: "Payment reconciliation pending" });
    expect(mocks.record).not.toHaveBeenCalled();
  });

  it("rejects a proposal payment missing brandId", async () => {
    const response = await postSucceeded({ id: "pi_1", metadata: { engagementId: "eng" } });
    expect(response.status).toBe(409);
    expect(await response.json()).toEqual({ error: "Incomplete proposal payment metadata" });
    expect(mocks.reconcile).not.toHaveBeenCalled();
    expect(mocks.alreadyProcessed).not.toHaveBeenCalled();
    expect(mocks.record).not.toHaveBeenCalled();
  });

  it("ignores succeeded intents with neither brandId nor engagementId", async () => {
    const response = await postSucceeded({ id: "pi_1", metadata: {} });
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ received: true });
    expect(mocks.reconcile).not.toHaveBeenCalled();
    expect(mocks.alreadyProcessed).not.toHaveBeenCalled();
    expect(mocks.record).not.toHaveBeenCalled();
  });
  it("never reconciles a failed or still-processing ACH payment", async () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    for (const type of ["payment_intent.processing", "payment_intent.payment_failed"]) {
      const event = { id: `evt_${type}`, type, data: { object: { id: "pi_ach", metadata: { engagementId: "eng", brandId: "brand" }, last_payment_error: { code: "insufficient_funds", payment_method: { type: "us_bank_account" } } } } };
      const response = await POST(new Request("https://firm.example.test/api/stripe/webhook", {
        method: "POST", headers: { "stripe-signature": "sig_test" }, body: JSON.stringify(event),
      }));
      expect(response.status).toBe(200);
    }
    expect(mocks.reconcile).not.toHaveBeenCalled();
    expect(mocks.alert).toHaveBeenNthCalledWith(1, "eng", "brand", expect.objectContaining({ kind: "processing" }));
    expect(mocks.alert).toHaveBeenNthCalledWith(2, "eng", "brand", expect.objectContaining({ kind: "failed" }));
    // Recorded only so a Stripe retry does not text Tom twice.
    expect(mocks.record).toHaveBeenCalledWith("eng", "brand", "evt_payment_intent.processing");
    expect(errorSpy).toHaveBeenCalledWith("[stripe/webhook] Proposal payment failed", expect.objectContaining({ intentId: "pi_ach", code: "insufficient_funds" }));
    errorSpy.mockRestore();
  });
  it("does not alert twice for a retried processing event", async () => {
    mocks.alreadyProcessed.mockResolvedValue(true);
    const event = { id: "evt_dup", type: "payment_intent.processing", data: { object: { id: "pi_ach", amount: 78000, currency: "usd", metadata: { engagementId: "eng", brandId: "brand" } } } };
    const response = await POST(new Request("https://firm.example.test/api/stripe/webhook", {
      method: "POST", headers: { "stripe-signature": "sig_test" }, body: JSON.stringify(event),
    }));
    expect(response.status).toBe(200);
    expect(mocks.alert).not.toHaveBeenCalled();
    expect(mocks.record).not.toHaveBeenCalled();
  });
});
