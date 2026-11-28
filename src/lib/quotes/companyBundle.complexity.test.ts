import { describe, expect, it } from "vitest";
import {
  normalizeCompanyBundle,
  priceCompanyBundle,
  DEFAULT_BUNDLE_PRICING_OPTIONS,
} from "./companyBundle";

const INVENTORY = { drivers: { inventory_cogs: { checked: true } } };

function companies() {
  return normalizeCompanyBundle([
    { id: "main", name: "Main Co", ownQboFile: true, accounts: [] },
    { id: "second", name: "Second Co", ownQboFile: true, accounts: [], complexity: INVENTORY },
    { id: "tag", name: "Tag Location", ownQboFile: false, accounts: [], complexity: INVENTORY },
  ]);
}

describe("spec 03 per-company complexity", () => {
  it("prices an added file's own selection in its standalone price, before discount", () => {
    const bundle = priceCompanyBundle({
      companies: companies(),
      packageId: "maintain",
      baseAssessment: {},
      options: DEFAULT_BUNDLE_PRICING_OPTIONS,
    });
    const second = bundle.perCompany[1];
    expect(second.isMain).toBe(false);
    // Standalone 250 base + 95 inventory; 20% bundle discount, ceil $5.
    expect(second.standaloneMonthly).toBe(345);
    expect(second.discountPct).toBe(20);
    expect(second.discountedMonthly).toBe(280);
  });

  it("prices nothing for tags, even with a selection stored", () => {
    const bundle = priceCompanyBundle({
      companies: companies(),
      packageId: "maintain",
      baseAssessment: {},
      options: DEFAULT_BUNDLE_PRICING_OPTIONS,
    });
    expect(bundle.perCompany[2]).toMatchObject({
      standaloneMonthly: 0,
      discountedMonthly: 0,
      setupOneTime: 0,
    });
  });

  it("prices the main company's selection from the base assessment", () => {
    const bundle = priceCompanyBundle({
      companies: companies(),
      packageId: "maintain",
      baseAssessment: { complexity: INVENTORY },
      options: DEFAULT_BUNDLE_PRICING_OPTIONS,
    });
    expect(bundle.perCompany[0].standaloneMonthly).toBe(345);
    expect(bundle.perCompany[0].discountedMonthly).toBe(345);
  });

  it("keeps per-company existing-line drivers at zero without headcount or add-ons", () => {
    const rows = normalizeCompanyBundle([
      { id: "main", name: "Main Co", ownQboFile: true, accounts: [] },
      {
        id: "second",
        name: "Second Co",
        ownQboFile: true,
        accounts: [],
        complexity: { drivers: { payroll: { checked: true }, sales_tax: { checked: true } } },
      },
    ]);
    const bundle = priceCompanyBundle({
      companies: rows,
      packageId: "maintain",
      baseAssessment: {},
      options: DEFAULT_BUNDLE_PRICING_OPTIONS,
    });
    // No staffing line or add-on is synthesized for the file: no charge.
    expect(bundle.perCompany[1].standaloneMonthly).toBe(250);
  });

  it("leaves legacy bundles unchanged without any selection", () => {
    const rows = normalizeCompanyBundle([
      { id: "main", name: "Main Co", ownQboFile: true, accounts: [] },
      { id: "second", name: "Second Co", ownQboFile: true, accounts: [] },
    ]);
    const bundle = priceCompanyBundle({
      companies: rows,
      packageId: "maintain",
      baseAssessment: {},
      options: DEFAULT_BUNDLE_PRICING_OPTIONS,
    });
    expect(bundle.perCompany[1].standaloneMonthly).toBe(250);
    expect(bundle.bundleMonthly).toBe(250 + 200);
  });
});
