import { describe, expect, it } from "vitest";
import {
  companyBundleFeeLines,
  DEFAULT_BUNDLE_PRICING_OPTIONS,
  hasCompanyBundle,
  normalizeCompanyBundle,
  priceCompanyBundle,
  toPublicCompanyBundle,
  type BundlePricingOptions,
  type CompanyEntry,
} from "./companyBundle";
import type { AccountEntry } from "./accountInventory";

function account(id: string, monthlyTransactions: number): AccountEntry {
  return { id, kind: "checking", label: id, monthlyTransactions, status: "open", basis: "measured" };
}

function company(overrides: Partial<CompanyEntry> = {}): CompanyEntry {
  return {
    id: "main",
    name: "Main Co",
    ownQboFile: true,
    fileStatus: "existing",
    locationsCount: 0,
    accounts: [],
    complexity: null,
    ...overrides,
  };
}

const OPTIONS: BundlePricingOptions = { ...DEFAULT_BUNDLE_PRICING_OPTIONS };

describe("normalizeCompanyBundle", () => {
  it("returns [] for non-arrays", () => {
    expect(normalizeCompanyBundle(undefined)).toEqual([]);
    expect(normalizeCompanyBundle(null)).toEqual([]);
    expect(normalizeCompanyBundle({})).toEqual([]);
    expect(normalizeCompanyBundle("x")).toEqual([]);
  });

  it("fills tolerant defaults, index 0 is the main company", () => {
    expect(normalizeCompanyBundle([{}])).toEqual([
      {
        id: "company",
        name: "Company 1",
        ownQboFile: true,
        fileStatus: "existing",
        locationsCount: 0,
        accounts: [],
        complexity: null,
      },
    ]);
  });

  it("keeps valid fields and drops garbage the way account inventory does", () => {
    const normalized = normalizeCompanyBundle([
      {
        id: "a",
        name: "  Alpha  ",
        ownQboFile: false,
        fileStatus: "new_file",
        locationsCount: "3",
        accounts: [{ ...account("a1", 50) }, { id: "bad", kind: "bogus" }],
        complexity: { drivers: 2 },
      },
      { id: "a", fileStatus: "desktop", locationsCount: -4, accounts: "nope", complexity: [1] },
    ]);
    expect(normalized).toEqual([
      {
        id: "a",
        name: "Alpha",
        ownQboFile: false,
        fileStatus: "new_file",
        locationsCount: 3,
        accounts: [account("a1", 50)],
        complexity: { drivers: 2 },
      },
      {
        id: "a-2",
        name: "Company 2",
        ownQboFile: true,
        fileStatus: "existing",
        locationsCount: 0,
        accounts: [],
        complexity: null,
      },
    ]);
  });

  it("dedupes ids without stealing a later real id", () => {
    const normalized = normalizeCompanyBundle([{ id: "company" }, {}, { id: "company" }]);
    expect(normalized.map((entry) => entry.id)).toEqual(["company", "company-2", "company-3"]);
  });

  it("clamps locations counts like transaction counts", () => {
    expect(normalizeCompanyBundle([{ locationsCount: 2.9 }])[0].locationsCount).toBe(2);
    expect(normalizeCompanyBundle([{ locationsCount: 1e9 }])[0].locationsCount).toBe(1000000);
  });
});

describe("hasCompanyBundle", () => {
  it("is false without companies", () => {
    expect(hasCompanyBundle({})).toBe(false);
    expect(hasCompanyBundle({ companies: undefined })).toBe(false);
    expect(hasCompanyBundle({ companies: [] })).toBe(false);
    expect(hasCompanyBundle({ companies: "nope" })).toBe(false);
  });

  it("is false for a single plain main company", () => {
    expect(hasCompanyBundle({ companies: [company()] })).toBe(false);
    expect(hasCompanyBundle({ companies: [company({ ownQboFile: false })] })).toBe(false);
  });

  it("is true with a second company, main locations, or a main new file", () => {
    expect(hasCompanyBundle({ companies: [company(), company({ id: "b", name: "B" })] })).toBe(true);
    expect(hasCompanyBundle({ companies: [company({ locationsCount: 2 })] })).toBe(true);
    expect(hasCompanyBundle({ companies: [company({ fileStatus: "new_file" })] })).toBe(true);
  });

  it("treats desktop_to_online as flagged only, not a bundle", () => {
    expect(hasCompanyBundle({ companies: [company({ fileStatus: "desktop_to_online" })] })).toBe(false);
  });
});

describe("priceCompanyBundle", () => {
  it("publishes the default option amounts", () => {
    expect(DEFAULT_BUNDLE_PRICING_OPTIONS).toEqual({
      additionalCompanyDiscountPct: 20,
      locationMonthlyCharge: 25,
      newFileSetupCharge: 150,
    });
  });

  it("prices a solo main file at exactly today's zero-driver price", () => {
    const priced = priceCompanyBundle({ companies: [company()], packageId: "maintain", baseAssessment: {}, options: OPTIONS });
    expect(priced.perCompany).toEqual([
      { company: company(), isMain: true, standaloneMonthly: 250, discountPct: 0, discountedMonthly: 250, setupOneTime: 0 },
    ]);
    expect(priced).toMatchObject({ locationsMonthly: 0, bundleMonthly: 250, discountTotal: 0, setupTotal: 0 });
  });

  it("discounts a second own-file company 20% off standalone, rounded up to $5", () => {
    const priced = priceCompanyBundle({
      companies: [company(), company({ id: "b", name: "Beta", accounts: [account("b1", 150)] })],
      packageId: "maintain",
      baseAssessment: {},
      options: OPTIONS,
    });
    // Beta: 1 bank + 100-499 band = 250 + 70 = 320 standalone; 320 x 0.8 = 256 -> 260.
    expect(priced.perCompany[1]).toMatchObject({
      isMain: false,
      standaloneMonthly: 320,
      discountPct: 20,
      discountedMonthly: 260,
      setupOneTime: 0,
    });
    expect(priced.bundleMonthly).toBe(250 + 260);
    expect(priced.discountTotal).toBe(320 - 260);
    expect(priced.setupTotal).toBe(0);
  });

  it("applies the grow override to additional files too", () => {
    const priced = priceCompanyBundle({
      companies: [company(), company({ id: "b", name: "Beta" })],
      packageId: "grow",
      baseAssessment: {},
      options: OPTIONS,
    });
    // Main grow = ceil5(250 x 1.5) = 375; Beta grow standalone = same 375 -> 300 after 20% off.
    expect(priced.perCompany[0].discountedMonthly).toBe(375);
    expect(priced.perCompany[1]).toMatchObject({ standaloneMonthly: 375, discountedMonthly: 300 });
    expect(priced.bundleMonthly).toBe(375 + 300);
  });

  it("charges main locations and new-file setups, and never for desktop_to_online", () => {
    const priced = priceCompanyBundle({
      companies: [
        company({ locationsCount: 4, fileStatus: "new_file" }),
        company({ id: "b", name: "Beta", fileStatus: "new_file" }),
        company({ id: "c", name: "Gamma", fileStatus: "desktop_to_online" }),
      ],
      packageId: "maintain",
      baseAssessment: {},
      options: OPTIONS,
    });
    expect(priced.locationsMonthly).toBe(4 * 25);
    expect(priced.perCompany.map((entry) => entry.setupOneTime)).toEqual([150, 150, 0]);
    expect(priced.setupTotal).toBe(300);
    // Beta/Gamma are empty files: 250 -> 200 each.
    expect(priced.bundleMonthly).toBe(250 + 200 + 200 + 100);
  });

  it("treats ownQboFile=false as a location-like tag with no price", () => {
    const priced = priceCompanyBundle({
      companies: [company(), company({ id: "tag", name: "Downtown", ownQboFile: false, locationsCount: 9 })],
      packageId: "maintain",
      baseAssessment: {},
      options: OPTIONS,
    });
    expect(priced.perCompany[1]).toMatchObject({
      standaloneMonthly: 0,
      discountPct: 0,
      discountedMonthly: 0,
      setupOneTime: 0,
    });
    // The tag's own locationsCount is not charged; only the main file's is.
    expect(priced.locationsMonthly).toBe(0);
    expect(priced.bundleMonthly).toBe(250);
  });

  it("honours custom options and sanitises garbage to the defaults", () => {
    const custom: BundlePricingOptions = { additionalCompanyDiscountPct: 50, locationMonthlyCharge: 10, newFileSetupCharge: 99 };
    const priced = priceCompanyBundle({
      companies: [company({ locationsCount: 4 }), company({ id: "b", name: "Beta", fileStatus: "new_file" })],
      packageId: "maintain",
      baseAssessment: {},
      options: custom,
    });
    expect(priced.perCompany[1].discountedMonthly).toBe(125);
    expect(priced.locationsMonthly).toBe(40);
    expect(priced.setupTotal).toBe(99);
    const sanitised = priceCompanyBundle({
      companies: [company({ locationsCount: 1 }), company({ id: "b", name: "Beta" })],
      packageId: "maintain",
      baseAssessment: {},
      options: { additionalCompanyDiscountPct: NaN, locationMonthlyCharge: -5, newFileSetupCharge: Infinity } as unknown as BundlePricingOptions,
    });
    expect(sanitised.perCompany[1].discountedMonthly).toBe(200);
    // Finite numbers clamp into range (negative charge -> 0); non-finite fall back to defaults.
    expect(sanitised.locationsMonthly).toBe(0);
  });

  it("never applies the legacy per-entity charge when companies exist", () => {
    const withEntities = priceCompanyBundle({
      companies: [company(), company({ id: "b", name: "Beta" })],
      packageId: "maintain",
      baseAssessment: { numberOfEntities: 5 },
      options: OPTIONS,
    });
    expect(withEntities.perCompany[0].discountedMonthly).toBe(250);
    expect(withEntities.bundleMonthly).toBe(450);
  });

  it("prices each additional file from its own accounts, never the main file's drivers", () => {
    // Main carries a heavy band via the base assessment; Beta's empty file still prices at the zero-driver 250.
    const priced = priceCompanyBundle({
      companies: [company(), company({ id: "b", name: "Beta" })],
      packageId: "maintain",
      baseAssessment: { transactionBand: "1000+", numberOfProperties: 12 },
      options: OPTIONS,
    });
    expect(priced.perCompany[0].standaloneMonthly).toBeGreaterThan(250);
    expect(priced.perCompany[1].standaloneMonthly).toBe(250);
  });
});

describe("companyBundleFeeLines", () => {
  it("emits one monthly line per company plus setup and locations lines", () => {
    const priced = priceCompanyBundle({
      companies: [
        company({ name: "Main Co", locationsCount: 2 }),
        company({ id: "b", name: "Beta", fileStatus: "new_file" }),
        company({ id: "tag", name: "Downtown", ownQboFile: false }),
      ],
      packageId: "maintain",
      baseAssessment: {},
      options: OPTIONS,
    });
    expect(companyBundleFeeLines(priced)).toEqual([
      { label: "Main Co — monthly bookkeeping", amount: 250, cadence: "monthly" },
      { label: "Beta — monthly bookkeeping (bundle, 20% off)", amount: 200, cadence: "monthly" },
      { label: "Beta — new QuickBooks file setup", amount: 150, cadence: "one-time" },
      { label: "Downtown — location (included with main file)", amount: 0, cadence: "monthly" },
      { label: "Locations — location reporting", amount: 50, cadence: "monthly" },
    ]);
  });
});

describe("toPublicCompanyBundle", () => {
  it("returns null without pricing or without companies", () => {
    expect(toPublicCompanyBundle([company()], null)).toBeNull();
    expect(toPublicCompanyBundle([], priceCompanyBundle({ companies: [company()], packageId: "maintain", baseAssessment: {}, options: OPTIONS }))).toBeNull();
    expect(toPublicCompanyBundle(undefined, priceCompanyBundle({ companies: [company()], packageId: "maintain", baseAssessment: {}, options: OPTIONS }))).toBeNull();
  });

  it("maps priced companies to their public shape", () => {
    const raw = [
      company({ name: "Main Co", locationsCount: 2 }),
      company({ id: "b", name: "Beta", fileStatus: "new_file" }),
    ];
    const pricing = priceCompanyBundle({ companies: raw, packageId: "maintain", baseAssessment: {}, options: OPTIONS });
    expect(toPublicCompanyBundle(raw, pricing)).toEqual({
      companies: [
        { name: "Main Co", ownQboFile: true, monthly: 250, setupOneTime: 0 },
        { name: "Beta", ownQboFile: true, monthly: 200, setupOneTime: 150 },
      ],
      locationsCount: 2,
      locationsMonthly: 50,
      bundleMonthly: 500,
    });
  });
});
