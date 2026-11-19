import { describe, expect, it } from "vitest";
import { activeServiceProduct, clientMrrOn, tagDrivenMrr, isActiveOn, parseServiceRecord, serviceTagPlan } from "./serviceRecords";

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
