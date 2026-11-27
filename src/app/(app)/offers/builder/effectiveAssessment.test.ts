import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import type { AccountEntry } from "@/lib/quotes/accountInventory";
vi.mock("../who/actions", () => ({
  getOfferBuilderContextAction: async () => null,
  saveOfferDraftAction: async () => undefined,
  syncOfferContactsAction: async () => undefined,
}));
import {
  getAdvancedReceiptManagementPrice,
  getProposalPricingSnapshotData,
  getProposalPricingSnapshotItems,
  mergeStoredAssessment,
  useProposalAssessmentDemoState,
  type AssessmentState,
} from "./ProposalCreationWorkspaceDemo";
import { effectiveAssessment } from "./effectiveAssessment";

function freshAssessment() {
  let state: AssessmentState;
  function Capture() {
    state = useProposalAssessmentDemoState({ persist: false }).assessment;
    return null;
  }
  renderToStaticMarkup(createElement(Capture));
  return state!;
}

function account(kind: AccountEntry["kind"], count = 100, status: AccountEntry["status"] = "open"): AccountEntry {
  return { id: kind, kind, label: kind, monthlyTransactions: count, status, basis: "measured" };
}

describe("effective account inventory assessment", () => {
  it("keeps every legacy input and price unchanged when inventory is absent", () => {
    const assessment = { ...freshAssessment(), transactionBand: "500-999" as const, bankAccountsCount: 7 };
    // Old persisted snapshots have neither inventory field.
    const legacy = { ...assessment } as Partial<AssessmentState>;
    delete legacy.accounts;
    delete legacy.bandOverride;
    expect(effectiveAssessment(legacy as AssessmentState)).toBe(legacy);
    expect(getProposalPricingSnapshotData(legacy as AssessmentState)).toEqual(getProposalPricingSnapshotData(assessment));
  });

  it("leaves legacy counts and band in place for a closed-only inventory", () => {
    const assessment = { ...freshAssessment(), transactionBand: "100-499" as const, bankAccountsCount: 5, accounts: [account("checking", 9000, "closed")] };
    expect(effectiveAssessment(assessment)).toBe(assessment);
  });

  it("derives all five counts and the band from open accounts only", () => {
    const assessment = { ...freshAssessment(), accounts: [account("checking"), account("savings"), account("credit_card"), account("loan"), account("line_of_credit"), account("vehicle_note"), account("merchant"), { ...account("checking", 9000, "closed"), id: "closed" }] };
    const effective = effectiveAssessment(assessment);
    expect(effective).toMatchObject({ transactionBand: "500-999", bankAccountsCount: 2, creditCardsCount: 1, loansCount: 1, linesOfCreditCount: 1, vehicleNotesCount: 1 });
    expect(assessment.transactionBand).toBe("");
  });

  it("ignores invalid overrides and applies one only with a valid reason", () => {
    const assessment = { ...freshAssessment(), accounts: [account("checking", 110)] };
    expect(effectiveAssessment({ ...assessment, bandOverride: { band: "1000+", reason: "" } }).transactionBand).toBe("100-499");
    expect(effectiveAssessment({ ...assessment, bandOverride: { band: "1000+", reason: "Seasonal peak" } }).transactionBand).toBe("1000+");
    expect(effectiveAssessment({ ...assessment, bandOverride: { band: "1000+", reason: "Two\nlines" } }).transactionBand).toBe("100-499");
  });

  it("feeds the same resolved inputs into tier pricing, scores, and receipt pricing", () => {
    const inventory = { ...freshAssessment(), accounts: [account("checking", 1100)] };
    const manual = { ...inventory, accounts: [], transactionBand: "1000+" as const, bankAccountsCount: 1 };
    expect(getProposalPricingSnapshotData(inventory)).toEqual(getProposalPricingSnapshotData(manual));
    expect(getAdvancedReceiptManagementPrice(inventory)).toBe(getAdvancedReceiptManagementPrice(manual));
    expect(getProposalPricingSnapshotItems(inventory).every((item) => item.monthlyLabel !== "- /mo")).toBe(true);
  });

  it("treats the inventory as the total: unconnected counts are a slice, not extra accounts", () => {
    const banks: AccountEntry[] = ["c1", "c2", "c3", "c4"].map((id) => (
      { id, kind: "checking", label: id, monthlyTransactions: 10, status: "open", basis: "measured" }
    ));
    const inventoried = {
      ...freshAssessment(),
      transactionBand: "" as const,
      bankAccountsCount: 0 as const,
      unconnectedBankAccountsCount: 4,
      accounts: banks,
    };
    const effective = effectiveAssessment(inventoried);
    expect(effective.bankAccountsCount).toBe(0);
    expect(effective.unconnectedBankAccountsCount).toBe(4);
    // Same price as four banks total with no double count ($250 Maintain).
    const manualTotal = {
      ...freshAssessment(),
      transactionBand: "0-99" as const,
      bankAccountsCount: 4,
    };
    expect(getProposalPricingSnapshotData(inventoried)).toEqual(
      getProposalPricingSnapshotData(manualTotal),
    );
    expect(getProposalPricingSnapshotData(inventoried).packagePricing.maintain.monthly).toBe(250);
  });

  it("clamps an unconnected count that exceeds the inventoried total", () => {
    const assessment = {
      ...freshAssessment(),
      unconnectedCreditCardsCount: 9,
      accounts: [account("credit_card", 200)],
    };
    const effective = effectiveAssessment(assessment);
    expect(effective.unconnectedCreditCardsCount).toBe(1);
    expect(effective.creditCardsCount).toBe(0);
  });

  it("keeps legacy additive counting without an inventory", () => {
    const legacy = {
      ...freshAssessment(),
      transactionBand: "0-99" as const,
      bankAccountsCount: 4,
      unconnectedBankAccountsCount: 4,
    };
    expect(effectiveAssessment(legacy)).toBe(legacy);
    // Eight reconciliation accounts still price above the four-total case.
    const fourTotal = getProposalPricingSnapshotData({
      ...freshAssessment(), transactionBand: "0-99" as const, bankAccountsCount: 4,
    }).packagePricing.maintain.monthly;
    expect(fourTotal).toBe(250);
    expect(getProposalPricingSnapshotData(legacy).packagePricing.maintain.monthly).toBe(300);
  });

  it("normalizes saved inventory and drops an invalid saved override", () => {
    const merged = mergeStoredAssessment(JSON.stringify({ accounts: [{ ...account("checking"), last4: "12x345", monthlyTransactions: -4 }, { id: "bad", kind: "bogus" }], bandOverride: { band: "1000+", reason: "" } }), freshAssessment());
    expect(merged.accounts).toEqual([{ ...account("checking", 0), last4: "2345" }]);
    expect(merged.bandOverride).toBeNull();
  });

  it("defaults old saves to an empty inventory and no override", () => {
    const merged = mergeStoredAssessment('{"transactionBand":"500-999"}', freshAssessment());
    expect(merged.accounts).toEqual([]);
    expect(merged.bandOverride).toBeNull();
    expect(merged.transactionBand).toBe("500-999");
  });
});
