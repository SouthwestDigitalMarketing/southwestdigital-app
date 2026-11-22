import { describe, expect, it } from "vitest";
import { accountTotal, profitLossTotals } from "./company_cash_flow.mjs";

describe("QBO cash flow report parsing", () => {
  it("derives cash expenses from net income and counts other income", () => {
    expect(profitLossTotals({ Rows: { Row: [
      { Header: { ColData: [{ value: "Income" }] }, Summary: { ColData: [{ value: "Total Income" }, { value: "2400.00" }] } },
      { Header: { ColData: [{ value: "Other Income" }] }, Summary: { ColData: [{ value: "Total Other Income" }, { value: "50.00" }] } },
      { Summary: { ColData: [{ value: "Net Income" }, { value: "395.42" }] } },
    ] } })).toEqual({ incomeUsd: 2450, expensesUsd: 2054.58 });
  });
  it("requires one exact ledger account", () => {
    const report = { Rows: { Row: [{ Header: { ColData: [{ value: "Owners Draw" }] }, Summary: { ColData: [{ value: "Total" }, { value: "120.00" }] } }] } };
    expect(accountTotal(report, "Owners Draw")).toBe(120);
    expect(() => accountTotal(report, "Tax Reserve")).toThrow(/found 0 times/);
  });
});
