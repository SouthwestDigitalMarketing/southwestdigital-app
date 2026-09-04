import { describe, expect, it } from "vitest";
import { planConnectedPaymentIntent } from "./connectPaymentPlan";

describe("planConnectedPaymentIntent", () => {
  it("blocks payment when the brand has no active Connect account", () => {
    const plan = planConnectedPaymentIntent({
      activeConnectedAccountId: null,
      existingIntent: null,
    });
    expect(plan.kind).toBe("block");
    if (plan.kind === "block") {
      expect(plan.reason).toBe("no-active-connect");
      expect(plan.status).toBe(409);
    }
  });

  it("blocks payment even if a prior platform-only intent exists but Connect is still inactive", () => {
    const plan = planConnectedPaymentIntent({
      activeConnectedAccountId: null,
      existingIntent: { id: "pi_old", status: "requires_payment_method", transferDestination: null },
    });
    expect(plan.kind).toBe("block");
  });

  it("creates a fresh intent when Connect is active and none exists", () => {
    const plan = planConnectedPaymentIntent({
      activeConnectedAccountId: "acct_active",
      existingIntent: null,
    });
    expect(plan.kind).toBe("create-fresh");
  });

  it("returns already-paid when the existing intent succeeded", () => {
    const plan = planConnectedPaymentIntent({
      activeConnectedAccountId: "acct_active",
      existingIntent: { id: "pi_ok", status: "succeeded", transferDestination: "acct_active" },
    });
    expect(plan.kind).toBe("already-paid");
    if (plan.kind === "already-paid") expect(plan.intentId).toBe("pi_ok");
  });

  it("reuses and updates an unpaid intent already routed to the active account", () => {
    const plan = planConnectedPaymentIntent({
      activeConnectedAccountId: "acct_active",
      existingIntent: { id: "pi_open", status: "requires_payment_method", transferDestination: "acct_active" },
    });
    expect(plan.kind).toBe("reuse-update");
  });

  it("reuses as-is when status is not updatable but destination matches", () => {
    const plan = planConnectedPaymentIntent({
      activeConnectedAccountId: "acct_active",
      existingIntent: { id: "pi_action", status: "requires_action", transferDestination: "acct_active" },
    });
    expect(plan.kind).toBe("reuse-as-is");
  });

  it("cancels and creates a new intent when the prior intent has no destination (platform-only)", () => {
    const plan = planConnectedPaymentIntent({
      activeConnectedAccountId: "acct_active",
      existingIntent: { id: "pi_platform", status: "requires_payment_method", transferDestination: null },
    });
    expect(plan.kind).toBe("cancel-and-create");
    if (plan.kind === "cancel-and-create") {
      expect(plan.cancelIntentId).toBe("pi_platform");
      expect(plan.reason).toBe("missing-destination");
    }
  });

  it("cancels and creates a new intent when the prior intent targets a different brand's account", () => {
    const plan = planConnectedPaymentIntent({
      activeConnectedAccountId: "acct_brand_a",
      existingIntent: { id: "pi_cross", status: "requires_payment_method", transferDestination: "acct_brand_b" },
    });
    expect(plan.kind).toBe("cancel-and-create");
    if (plan.kind === "cancel-and-create") {
      expect(plan.cancelIntentId).toBe("pi_cross");
      expect(plan.reason).toBe("wrong-destination");
    }
  });

  it("creates fresh when the prior intent was already canceled", () => {
    const plan = planConnectedPaymentIntent({
      activeConnectedAccountId: "acct_active",
      existingIntent: { id: "pi_dead", status: "canceled", transferDestination: null },
    });
    expect(plan.kind).toBe("create-fresh");
  });

  it("cancels and recreates even for non-updatable statuses when destination is wrong", () => {
    const plan = planConnectedPaymentIntent({
      activeConnectedAccountId: "acct_active",
      existingIntent: { id: "pi_wrong_action", status: "requires_action", transferDestination: null },
    });
    expect(plan.kind).toBe("cancel-and-create");
  });
});
