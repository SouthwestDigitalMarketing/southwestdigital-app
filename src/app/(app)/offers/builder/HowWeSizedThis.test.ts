import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { ESTIMATE_NOTICE_TEXT, toPublicAccountInventory, type AccountEntry } from "@/lib/quotes/accountInventory";
import HowWeSizedThis from "./HowWeSizedThis";
import AccountInventoryEditor from "./AccountInventoryEditor";

const accounts: AccountEntry[] = [
  { id: "open", kind: "checking", label: "Chase", last4: "1234", monthlyTransactions: 123, status: "open", basis: "measured", source: "PRIVATE SOURCE" },
  { id: "closed", kind: "savings", label: "Closed bank", monthlyTransactions: 9999, status: "closed", basis: "estimated" },
];

function render(rows: AccountEntry[]) {
  return renderToStaticMarkup(createElement(HowWeSizedThis, { inventory: toPublicAccountInventory(rows), brandName: "Our Firm" }));
}

describe("How we sized this", () => {
  it("hides the section and terms for legacy and closed-only proposals", () => {
    expect(render([])).toBe("");
    expect(render([accounts[1]])).toBe("");
  });
  it("shows open accounts, masked last four, total, basis and fixed-fee terms", () => {
    const html = render(accounts);
    for (const text of ["How we sized this", "Checking", "Chase ••1234", "123", "Measured", "Total per month", "Proposal terms", "Volume-based pricing.", "Our Firm will recheck"]) expect(html).toContain(text);
    expect(html).not.toContain("Closed bank");
    expect(html).not.toContain("9,999");
    expect(html).not.toContain("PRIVATE SOURCE");
    expect(html).not.toContain(ESTIMATE_NOTICE_TEXT);
  });
  it("shows the estimate notice when any open account is estimated", () => {
    const html = render([{ ...accounts[0], basis: "estimated" }]);
    expect(html).toContain("Estimated");
    expect(html).toContain(ESTIMATE_NOTICE_TEXT);
    expect(html).toContain("partly estimated");
  });
  it("renders nothing different for legacy callers when companies is absent or empty", () => {
    const main = toPublicAccountInventory(accounts);
    const without = renderToStaticMarkup(createElement(HowWeSizedThis, { inventory: main, brandName: "Our Firm" }));
    for (const companies of [undefined, null, [] as never[]]) {
      expect(renderToStaticMarkup(createElement(HowWeSizedThis, { inventory: main, brandName: "Our Firm", companies }))).toBe(without);
    }
    expect(without).toContain("How we sized this");
  });
  it("shows one table per company with its own open accounts when a bundle exists", () => {
    const main = toPublicAccountInventory(accounts)!;
    const betaAccounts: AccountEntry[] = [
      { id: "b1", kind: "credit_card", label: "Beta Card", last4: "9999", monthlyTransactions: 45, status: "open", basis: "measured" },
    ];
    const html = renderToStaticMarkup(createElement(HowWeSizedThis, {
      inventory: main,
      brandName: "Our Firm",
      companies: [
        { name: "Main Co", inventory: main },
        { name: "Beta", inventory: toPublicAccountInventory(betaAccounts) },
        { name: "Empty Co", inventory: toPublicAccountInventory([]) },
      ],
    }));
    expect(html).toContain("Main Co");
    expect(html).toContain("Beta");
    expect(html).toContain("Beta Card ••9999");
    expect(html).toContain("45");
    expect(html).not.toContain("Empty Co");
    expect(html).toContain("Proposal terms");
    expect(html).toContain("Our Firm will recheck");
  });
  it("renders nothing when no company has open accounts", () => {
    expect(renderToStaticMarkup(createElement(HowWeSizedThis, {
      inventory: null,
      brandName: "Our Firm",
      companies: [{ name: "Main Co", inventory: null }],
    }))).toBe("");
  });
});

describe("account editor", () => {
  it("keeps closed rows visible, greyed and excluded from totals", () => {
    const html = renderToStaticMarkup(createElement(AccountInventoryEditor, { accounts, bandOverride: null, onAccountsChange: () => {}, onOverrideChange: () => {} }));
    expect(html).toContain("Closed bank");
    expect(html).toContain("Closed — excluded");
    expect(html).toContain("opacity-60");
    expect(html).toContain("Open accounts: 123 transactions per month");
    expect(html).toContain("Band: 100-499 (from accounts)");
    expect(html).toContain('maxLength="4"');
    expect(html).toContain('inputMode="numeric"');
  });
  it("shows the core closed-only and estimated warnings", () => {
    const props = { bandOverride: null, onAccountsChange: () => {}, onOverrideChange: () => {} };
    expect(renderToStaticMarkup(createElement(AccountInventoryEditor, { ...props, accounts: [accounts[1]] }))).toContain("Only closed accounts are listed");
    expect(renderToStaticMarkup(createElement(AccountInventoryEditor, { ...props, accounts: [{ ...accounts[0], basis: "estimated" }] }))).toContain("Some open accounts have estimated transaction counts");
  });
});
