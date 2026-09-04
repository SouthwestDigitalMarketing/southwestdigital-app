import { describe, expect, it } from "vitest";
import {
  buildHourlyCheckoutSummary,
  parseHourlyCheckoutSelection,
  parseStoredHourlyCheckout,
  resolveHourlyAmountDueNow,
} from "./hourlyCheckout";

describe("parseHourlyCheckoutSelection", () => {
  it("accepts a valid consulting selection with defaults for missing intake", () => {
    const parsed = parseHourlyCheckoutSelection({
      kind: "consulting",
      catalogItemId: "svc_1",
      catalogItemLabel: "60-minute consulting session",
      quantity: 2,
      unitPrice: 200,
    });
    expect(parsed).toEqual({
      kind: "consulting",
      catalogItemId: "svc_1",
      catalogItemLabel: "60-minute consulting session",
      quantity: 2,
      unitPrice: 200,
      intakeFee: 0,
    });
  });

  it("rejects unknown kinds", () => {
    expect(parseHourlyCheckoutSelection({ kind: "bookkeeping", catalogItemId: "x", catalogItemLabel: "y", quantity: 1, unitPrice: 1 })).toBeNull();
  });

  it("rejects zero or negative quantity", () => {
    expect(parseHourlyCheckoutSelection({ kind: "coaching", catalogItemId: "x", catalogItemLabel: "y", quantity: 0, unitPrice: 1 })).toBeNull();
    expect(parseHourlyCheckoutSelection({ kind: "coaching", catalogItemId: "x", catalogItemLabel: "y", quantity: -1, unitPrice: 1 })).toBeNull();
  });

  it("rejects negative or NaN prices", () => {
    expect(parseHourlyCheckoutSelection({ kind: "coaching", catalogItemId: "x", catalogItemLabel: "y", quantity: 1, unitPrice: -1 })).toBeNull();
    expect(parseHourlyCheckoutSelection({ kind: "coaching", catalogItemId: "x", catalogItemLabel: "y", quantity: 1, unitPrice: Number.NaN })).toBeNull();
  });
});

describe("buildHourlyCheckoutSummary", () => {
  it("multiplies quantity by unit price and adds intake to compute total", () => {
    const summary = buildHourlyCheckoutSummary({
      kind: "coaching",
      catalogItemId: "svc_pack",
      catalogItemLabel: "4-session coaching pack",
      quantity: 1,
      unitPrice: 900,
      intakeFee: 100,
    });
    expect(summary.subtotal).toBe(900);
    expect(summary.total).toBe(1000);
    expect(summary.amountDueNow).toBe(1000);
    expect(summary.chargeKind).toBe("hourly_coaching");
    expect(summary.selectionHash).toMatch(/^[a-f0-9]{64}$/);
  });

  it("tags consulting selections with the consulting chargeKind", () => {
    const summary = buildHourlyCheckoutSummary({
      kind: "consulting",
      catalogItemId: "svc",
      catalogItemLabel: "60-minute consulting session",
      quantity: 3,
      unitPrice: 200,
      intakeFee: 0,
    });
    expect(summary.chargeKind).toBe("hourly_consulting");
    expect(summary.total).toBe(600);
  });

  it("produces a stable selection hash for identical selections", () => {
    const first = buildHourlyCheckoutSummary({
      kind: "coaching", catalogItemId: "svc", catalogItemLabel: "60-min", quantity: 1, unitPrice: 250, intakeFee: 0,
    });
    const second = buildHourlyCheckoutSummary({
      kind: "coaching", catalogItemId: "svc", catalogItemLabel: "60-min", quantity: 1, unitPrice: 250, intakeFee: 0,
    });
    expect(first.selectionHash).toBe(second.selectionHash);
  });

  it("changes the hash when any pricing input changes", () => {
    const base = buildHourlyCheckoutSummary({
      kind: "coaching", catalogItemId: "svc", catalogItemLabel: "60-min", quantity: 1, unitPrice: 250, intakeFee: 0,
    });
    const bumpedQty = buildHourlyCheckoutSummary({
      kind: "coaching", catalogItemId: "svc", catalogItemLabel: "60-min", quantity: 2, unitPrice: 250, intakeFee: 0,
    });
    expect(base.selectionHash).not.toBe(bumpedQty.selectionHash);
  });
});

describe("parseStoredHourlyCheckout", () => {
  it("round-trips a summary produced by buildHourlyCheckoutSummary", () => {
    const summary = buildHourlyCheckoutSummary({
      kind: "consulting", catalogItemId: "svc", catalogItemLabel: "60-min", quantity: 2, unitPrice: 200, intakeFee: 50,
    });
    // Simulate JSON storage → JSON parse
    const roundTripped = parseStoredHourlyCheckout(JSON.parse(JSON.stringify(summary)));
    expect(roundTripped).not.toBeNull();
    expect(roundTripped?.total).toBe(450);
    expect(roundTripped?.chargeKind).toBe("hourly_consulting");
  });

  it("returns null if the stored chargeKind is not one of the hourly values", () => {
    const summary = buildHourlyCheckoutSummary({
      kind: "consulting", catalogItemId: "svc", catalogItemLabel: "60-min", quantity: 1, unitPrice: 100, intakeFee: 0,
    });
    const corrupted = { ...summary, chargeKind: "first_month" };
    expect(parseStoredHourlyCheckout(corrupted)).toBeNull();
  });
});

describe("resolveHourlyAmountDueNow", () => {
  it("returns the summary's amountDueNow for a normal proposal", () => {
    const summary = buildHourlyCheckoutSummary({
      kind: "coaching", catalogItemId: "svc", catalogItemLabel: "12-pack", quantity: 1, unitPrice: 2400, intakeFee: 0,
    });
    expect(resolveHourlyAmountDueNow({ checkout: summary, isTestProposal: false })).toBe(2400);
  });

  it("forces exactly $1 for test proposals", () => {
    const summary = buildHourlyCheckoutSummary({
      kind: "coaching", catalogItemId: "svc", catalogItemLabel: "12-pack", quantity: 1, unitPrice: 2400, intakeFee: 0,
    });
    expect(resolveHourlyAmountDueNow({ checkout: summary, isTestProposal: true })).toBe(1);
  });
});
