import { describe, expect, it } from "vitest";
import { buildHourlyCheckoutSummary } from "./hourlyCheckout";
import { buildAcceptedPayment, readAcceptedPayment, readAcceptedSelection, readStripePaymentExpectation } from "./acceptedPayment";

const hourly = buildHourlyCheckoutSummary({ kind: "consulting", catalogItemId: "consult", catalogItemLabel: "Consulting", quantity: 2, unitPrice: 150, intakeFee: 50 });

describe("accepted payment obligation", () => {
  it("freezes hourly totals and selection identity at signing", () => {
    expect(buildAcceptedPayment({ hourlyCheckout: hourly }, false)).toMatchObject({
      amountInCents: 35_000, currency: "usd", selectionHash: hourly.selectionHash, chargeKind: "hourly_consulting", isTestProposal: false,
    });
  });
  it("explicitly freezes the existing one-dollar test mode", () => {
    expect(buildAcceptedPayment({ hourlyCheckout: hourly }, true)).toMatchObject({ amountInCents: 100, chargeKind: "test_proposal", isTestProposal: true });
  });
  it("does not read an editable draft as accepted evidence", () => {
    expect(readAcceptedPayment({ proposalBuilderState: { services: { hourlyCheckout: hourly } } })).toBeNull();
    expect(buildAcceptedPayment({}, false)).toBeNull();
  });
  it("retains the accepted amount after later draft edits", () => {
    const obligation = buildAcceptedPayment({ hourlyCheckout: hourly }, false);
    expect(readAcceptedPayment({ proposalAcceptance: { paymentObligation: obligation }, proposalBuilderState: { services: { amountDueNow: 1 } } })).toEqual(obligation);
  });
  it("rejects incomplete intent evidence", () => {
    expect(readStripePaymentExpectation({ proposalBuilderState: { services: { stripePaymentExpectation: { intentId: "pi_only" } } } })).toBeNull();
  });
  it("reads signed hourly records from acceptance after draft pricing changes", () => {
    const record = readAcceptedSelection({
      proposalAcceptance: { selection: { hourlyCheckout: hourly } },
      proposalBuilderState: { services: { hourlyCheckout: { ...hourly, total: 1, amountDueNow: 1 } } },
    });
    expect(record.hourly?.total).toBe(350);
    expect(record.bookkeeping).toBeNull();
    expect(readAcceptedSelection({ proposalBuilderState: { services: { hourlyCheckout: hourly } } }).hourly).toBeNull();
  });
});
