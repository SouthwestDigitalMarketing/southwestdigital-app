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
