import { describe, expect, it } from "vitest";
import { activeServiceProduct, billingMismatches, isoDay, recordsFromAgreement, recordsFromProposal, clientMrrOn, tagDrivenMrr, isActiveOn, parseServiceRecord, serviceTagPlan } from "./serviceRecords";

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

describe("isActiveOn", () => {
  it("treats the end date as the last day of service", () => {
    const yacht = { startDate: "2026-01-01", endDate: "2026-07-31" };
    expect(isActiveOn(yacht, "2026-07-31")).toBe(true);
    expect(isActiveOn(yacht, "2026-08-01")).toBe(false);
    expect(isActiveOn({ startDate: "2026-12-01", endDate: null }, "2026-11-18")).toBe(false);
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

describe("serviceTagPlan", () => {
  const day = "2026-11-18";
  const monthly = (startDate: string, endDate: string | null = null) => ({ product: "monthly-bookkeeping", startDate, endDate });

  it("marks an active monthly client", () => {
    expect(serviceTagPlan([monthly("2026-01-01")], ["monthly-bookkeeping"], day)).toEqual({
      add: ["active-client", "service-monthly-bookkeeping-active"],
      remove: [],
    });
  });

  it("ends services and makes a former client when everything ended", () => {
    expect(
      serviceTagPlan(
        [monthly("2026-01-01", "2026-07-31"), { product: "onboarding-cleanup", startDate: "2026-01-01", endDate: "2026-01-31" }],
        ["active-client", "service-monthly-bookkeeping-active"],
        day,
      ),
    ).toEqual({
      add: ["former-client", "service-monthly-bookkeeping-ended", "service-onboarding-cleanup-ended"],
      remove: ["active-client", "service-monthly-bookkeeping-active"],
    });
  });

  it("keeps a client active on one service while another ended", () => {
    const plan = serviceTagPlan(
      [monthly("2026-11-01"), { product: "onboarding", startDate: "2026-11-11", endDate: "2026-11-11" }],
      ["active-client"],
      day,
    );
    expect(plan.add).toEqual(["service-monthly-bookkeeping-active", "service-onboarding-ended"]);
    expect(plan.remove).toEqual([]);
  });

  it("changes nothing for a signed client that has not started", () => {
    expect(serviceTagPlan([monthly("2026-12-01")], ["contract-signed"], day)).toEqual({ add: [], remove: [] });
  });

  it("leaves hand-set service tags with no records alone, and they keep the client active", () => {
    expect(
      serviceTagPlan([{ product: "hourly-onsite", startDate: "2026-10-01", endDate: "2026-10-01" }], ["service-payroll-active"], day),
    ).toEqual({ add: ["active-client", "service-hourly-onsite-ended"], remove: [] });
  });

  it("reads the product from an active service tag", () => {
    expect(activeServiceProduct("service-monthly-bookkeeping-active")).toBe("monthly-bookkeeping");
    expect(activeServiceProduct("service-monthly-bookkeeping-ended")).toBeNull();
    expect(activeServiceProduct("active-client")).toBeNull();
  });
});

describe("tagDrivenMrr", () => {
  const rec = (contactId: string, product: string, basis: string, feeAmount: number, startDate: string, endDate: string | null = null) => ({
    contactId,
    contactName: contactId,
    company: null,
    product,
    basis,
    feeAmount,
    startDate,
    endDate,
  });
  const records = [
    rec("aaa", "monthly-bookkeeping", "monthly", 150, "2026-01-01"),
    rec("bnb", "monthly-bookkeeping", "monthly", 150, "2025-12-15"),
    rec("pay", "monthly-payroll", "monthly", 90, "2026-02-01"),
    rec("new", "monthly-bookkeeping", "monthly", 300, "2026-12-01"),
    rec("woods", "hourly-onsite", "one_time", 200, "2026-10-23", "2026-10-23"),
  ];
  const tagged = [
    { id: "aaa", name: "aaa", company: null, tags: ["service-monthly-bookkeeping-active", "active-client"] },
    { id: "pay", name: "pay", company: null, tags: ["service-monthly-payroll-active"] },
    { id: "hand", name: "hand", company: null, tags: ["service-monthly-bookkeeping-active"] },
    { id: "woods", name: "woods", company: null, tags: ["service-hourly-onsite-active"] },
  ];

  it("counts tagged clients of recurring products with fees from records, and lists mismatches", () => {
    const out = tagDrivenMrr({ records, tagged, day: "2026-11-18" });
    expect(out.clients.map((c) => [c.id, c.mrr])).toEqual([
      ["aaa", 150],
      ["pay", 90],
      ["hand", 0],
    ]);
    expect(out.starting.map((c) => c.id)).toEqual(["new"]);
    expect(out.mismatches).toEqual([
      { id: "hand", name: "hand", problem: "Recurring service tag but no active monthly record" },
      { id: "bnb", name: "bnb", problem: "Active monthly record but no service tag" },
    ]);
  });
});

describe("recordsFromProposal", () => {
  const meta = { engagementId: "e1", contactId: "c1", paidDay: "2026-11-11", signedDay: "2026-11-11" };

  it("opens monthly from the first of the prepaid month and one-time fees on the pay day", () => {
    const out = recordsFromProposal(
      { recurringMonthlyTotal: 480, onboardingFee: 300, cleanupTotal: 0, prepaidMonths: 1, selectedTierLabel: "Improve" },
      meta,
    );
    expect(out.map((r) => [r.sourceKey, r.basis, r.feeAmount, r.startDate])).toEqual([
      ["client-won:e1:monthly-bookkeeping", "monthly", 480, "2026-11-01"],
      ["client-won:e1:onboarding", "one_time", 300, "2026-11-11"],
    ]);
    expect(out.every((r) => parseServiceRecord(r as unknown as Record<string, unknown>) !== null)).toBe(true);
    expect(typeof parseServiceRecord(out[0] as unknown as Record<string, unknown>)).toBe("object");
  });

  it("starts monthly on the pay day when no month was prepaid, and adds cleanup", () => {
    const out = recordsFromProposal({ recurringMonthlyTotal: 300, cleanupTotal: 900 }, meta);
    expect(out.map((r) => [r.product, r.startDate])).toEqual([
      ["monthly-bookkeeping", "2026-11-11"],
      ["catch-up-bookkeeping", "2026-11-11"],
    ]);
  });
});

describe("recordsFromAgreement", () => {
  const rodan = {
    file_slug: "Rodan-Properties-LLC",
    effective_date_iso: "2026-11-11",
    parties: { client_email: "R4-1980@hotmail.com" },
    plan: "improve",
    start_date: "November 1, 2026",
    fees: { monthly: 480, onboarding: 300, notes: ["paid"] },
  };

  it("maps the builder JSON to records found by the client's email", () => {
    const out = recordsFromAgreement(rodan, { evidenceRef: "rodan.pdf", evidenceDate: "2026-11-11" });
    expect(Array.isArray(out)).toBe(true);
    expect((out as ReturnType<typeof recordsFromProposal>).map((r) => [r.sourceKey, r.contactEmail, r.basis, r.feeAmount, r.startDate])).toEqual([
      ["agreement:rodan-properties-llc:2026-11-11:monthly-bookkeeping", "r4-1980@hotmail.com", "monthly", 480, "2026-11-01"],
      ["agreement:rodan-properties-llc:2026-11-11:onboarding", "r4-1980@hotmail.com", "one_time", 300, "2026-11-11"],
    ]);
  });

  it("refuses an agreement it cannot read", () => {
    expect(recordsFromAgreement({ ...rodan, parties: {} }, { evidenceRef: "x", evidenceDate: null })).toMatch(/client_email/);
    expect(recordsFromAgreement({ ...rodan, start_date: "soon" }, { evidenceRef: "x", evidenceDate: null })).toMatch(/start_date/);
    expect(isoDay("February 29, 2026")).toBeNull();
    expect(isoDay("March 1, 2026")).toBe("2026-03-01");
  });
});

describe("billingMismatches", () => {
  const rec = (contactId: string, product: string, basis: string, feeAmount: number | null, startDate: string, endDate: string | null = null) => ({
    contactId,
    contactName: contactId,
    product,
    basis,
    feeAmount,
    startDate,
    endDate,
  });
  const records = [
    rec("aaa", "monthly-bookkeeping", "monthly", 150, "2026-01-01"),
    rec("rodan", "monthly-bookkeeping", "monthly", 480, "2026-11-01"),
    rec("rodan", "onboarding", "one_time", 300, "2026-11-11"),
    rec("bayou", "monthly-bookkeeping", "monthly", 450, "2026-10-01"),
    rec("woods", "hourly-onsite", "one_time", 200, "2026-11-06", "2026-11-06"),
    rec("sj", "hourly-bookkeeping", "hourly", null, "2026-10-28"),
  ];
  const billing = [
    { customer: "AAA Discount Maid Service", amount: 150, contactId: "aaa" },
    { customer: "RODAN PROPERTIES, LLC", amount: 780, contactId: "rodan" },
    { customer: "Woodlands Landscaping", amount: 200, contactId: "woods" },
    { customer: "SJ Equity LLC", amount: 812.5, contactId: "sj" },
    { customer: "Contigo Accounting", amount: 400, contactId: null },
  ];

  it("passes matching bills, flags unknown billing for Tom and a missing invoice for Sol", () => {
    const out = billingMismatches({ month: "2026-11", asOf: "2026-11-18", billing, records });
    expect(out.map((i) => [i.kind, i.owner, i.name])).toEqual([
      ["billed-no-record", "tom", "Contigo Accounting"],
      ["no-invoice", "sol", "bayou"],
    ]);
  });

  it("flags an amount that differs from the agreed fee", () => {
    const out = billingMismatches({
      month: "2026-11",
      asOf: "2026-11-30",
      billing: [{ customer: "AAA", amount: 200, contactId: "aaa" }],
      records: [records[0]],
    });
    expect(out).toEqual([
      expect.objectContaining({ kind: "amount-differs", owner: "sol", detail: expect.stringContaining("agreed $150") }),
    ]);
  });
});
