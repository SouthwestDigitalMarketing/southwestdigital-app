import { describe, expect, it } from "vitest";
import { clientMrrOn, isActiveOn, monthlyRecurringRevenue, parseServiceRecord } from "./serviceRecords";

const monthly = {
  sourceKey: "backfill-2026-11-18:aaa:monthly-bookkeeping",
  contactId: "c1",
  product: "monthly-bookkeeping",
  basis: "monthly",
  feeAmount: 150,
  startDate: "2026-01-01",
  evidenceSource: "qbo_contract",
  evidenceRef: "General Services Agreement AAA",
  evidenceDate: "2026-01-15",
};

describe("parseServiceRecord", () => {
  it("accepts a monthly record from a signed agreement", () => {
    const out = parseServiceRecord(monthly);
    expect(typeof out).toBe("object");
    expect(out).toMatchObject({ basis: "monthly", feeAmount: 150, endDate: null, engagementId: null });
  });

  it("refuses a monthly record without a fee or from an invoice", () => {
    expect(parseServiceRecord({ ...monthly, feeAmount: undefined })).toMatch(/monthly fee/);
    expect(parseServiceRecord({ ...monthly, evidenceSource: "paid_invoice" })).toMatch(/signed agreement/);
  });

  it("needs end date and reason together", () => {
    expect(parseServiceRecord({ ...monthly, endDate: "2026-07-31" })).toMatch(/together/);
    expect(parseServiceRecord({ ...monthly, endReason: "lapsed" })).toMatch(/together/);
    expect(parseServiceRecord({ ...monthly, endDate: "2026-07-31", endReason: "lapsed" })).toMatchObject({
      endReason: "lapsed",
    });
  });

  it("accepts hourly with no rate and refuses bad dates and vocabularies", () => {
    expect(
      parseServiceRecord({ ...monthly, basis: "hourly", product: "hourly-bookkeeping", feeAmount: null }),
    ).toMatchObject({ feeAmount: null });
    expect(parseServiceRecord({ ...monthly, startDate: "2026-13-01" })).toMatch(/startDate/);
    expect(parseServiceRecord({ ...monthly, basis: "yearly" })).toMatch(/basis/);
    expect(parseServiceRecord({ ...monthly, evidenceRef: " " })).toMatch(/evidenceRef/);
    expect(parseServiceRecord({ ...monthly, previousSourceKey: monthly.sourceKey })).toMatch(/itself/);
  });
});

describe("monthlyRecurringRevenue", () => {
  const records = [
    { contactId: "aaa", basis: "monthly", feeAmount: 150, startDate: "2026-01-01", endDate: null },
    { contactId: "rodan", basis: "monthly", feeAmount: 480, startDate: "2026-12-01", endDate: null },
    { contactId: "rodan", basis: "one_time", feeAmount: 300, startDate: "2026-11-11", endDate: "2026-11-11" },
    { contactId: "yacht", basis: "monthly", feeAmount: 300, startDate: "2026-01-01", endDate: "2026-07-31" },
  ];

  it("counts only monthly records active that day", () => {
    expect(monthlyRecurringRevenue(records, "2026-11-18")).toEqual({ total: 150, clients: 1 });
    expect(monthlyRecurringRevenue(records, "2026-12-01")).toEqual({ total: 630, clients: 2 });
    expect(monthlyRecurringRevenue(records, "2026-07-31")).toEqual({ total: 450, clients: 2 });
  });

  it("treats the end date as the last day of service", () => {
    expect(isActiveOn(records[3], "2026-07-31")).toBe(true);
    expect(isActiveOn(records[3], "2026-08-01")).toBe(false);
  });
});

describe("clientMrrOn", () => {
  const base = { company: null, endDate: null };
  const records = [
    { ...base, contactId: "aaa", contactName: "AAA", basis: "monthly", feeAmount: 150, startDate: "2026-01-01" },
    { ...base, contactId: "bayou", contactName: "Bayou", basis: "monthly", feeAmount: 450, startDate: "2026-10-01" },
    { ...base, contactId: "bayou", contactName: "Bayou", basis: "monthly", feeAmount: 50, startDate: "2026-11-01" },
    { ...base, contactId: "new", contactName: "New", basis: "monthly", feeAmount: 300, startDate: "2026-12-01" },
    { ...base, contactId: "aaa", contactName: "AAA", basis: "one_time", feeAmount: 900, startDate: "2026-11-01" },
    { ...base, contactId: "old", contactName: "Old", basis: "monthly", feeAmount: 300, startDate: "2026-01-01", endDate: "2026-07-31" },
  ];

  it("sums active monthly records per client, biggest first, and lists future ones as starting", () => {
    const out = clientMrrOn(records, "2026-11-18");
    expect(out.clients.map((c) => [c.id, c.mrr])).toEqual([
      ["bayou", 500],
      ["aaa", 150],
    ]);
    expect(out.starting).toEqual([{ id: "new", name: "New", company: null, mrr: 300, startDate: "2026-12-01" }]);
  });
});
