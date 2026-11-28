import { describe, expect, it } from "vitest";
import {
  applyBundleOptionEdit,
  asPublicCompanyBundleMap,
  buildCompanyBundleSnapshot,
  companyBundleFeeLines,
  DEFAULT_BUNDLE_PRICING_OPTIONS,
  describeNewFileSetupCharge,
  hasCompanyBundle,
  normalizeCompanyBundle,
  priceCompanyBundle,
  resolveBundlePricingOptions,
  resolveCompanyBundleForTier,
  sanitizeBundlePricingOverride,
  toPublicCompanyBundle,
  toPublicCompanyBundleMap,
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
    propertiesCount: 0,
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
        propertiesCount: 0,
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
        propertiesCount: "4",
        accounts: [{ ...account("a1", 50) }, { id: "bad", kind: "bogus" }],
        complexity: { drivers: 2 },
      },
      { id: "a", fileStatus: "desktop", locationsCount: -4, propertiesCount: -2, accounts: "nope", complexity: [1] },
    ]);
    expect(normalized).toEqual([
      {
        id: "a",
        name: "Alpha",
        ownQboFile: false,
        fileStatus: "new_file",
        locationsCount: 3,
        propertiesCount: 4,
        accounts: [account("a1", 50)],
        complexity: { drivers: 2 },
      },
      {
        id: "a-2",
        name: "Company 2",
        ownQboFile: true,
        fileStatus: "existing",
        locationsCount: 0,
        propertiesCount: 0,
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

  it("ignores tag-only additions so the legacy per-entity charge survives", () => {
    expect(
      hasCompanyBundle({ companies: [company(), company({ id: "tag", name: "Downtown", ownQboFile: false })] }),
    ).toBe(false);
    expect(
      hasCompanyBundle({
        companies: [
          company(),
          company({ id: "t1", name: "Tag 1", ownQboFile: false }),
          company({ id: "t2", name: "Tag 2", ownQboFile: false }),
        ],
      }),
    ).toBe(false);
    // One owned second file among tags still activates the bundle.
    expect(
      hasCompanyBundle({
        companies: [
          company(),
          company({ id: "tag", name: "Downtown", ownQboFile: false }),
          company({ id: "b", name: "B" }),
        ],
      }),
    ).toBe(true);
  });

  it("prices a solo main company with ownQboFile=false like the main file", () => {
    // The main row is always the main file; the flag only matters past index 0.
    expect(hasCompanyBundle({ companies: [company({ ownQboFile: false })] })).toBe(false);
    const priced = priceCompanyBundle({
      companies: [company({ ownQboFile: false })],
      packageId: "maintain",
      baseAssessment: {},
      options: OPTIONS,
    });
    expect(priced.perCompany[0]).toMatchObject({
      isMain: true,
      standaloneMonthly: 250,
      discountedMonthly: 250,
    });
    expect(priced.bundleMonthly).toBe(250);
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

  it("prices an added company's properties through the per-property rules", () => {
    // 4 properties x $50 recurringPerProperty on an empty file: 250 + 200 = 450 standalone.
    const priced = priceCompanyBundle({
      companies: [company(), company({ id: "b", name: "Beta", propertiesCount: 4 })],
      packageId: "maintain",
      baseAssessment: { numberOfProperties: 9 },
      options: OPTIONS,
    });
    expect(priced.perCompany[1]).toMatchObject({
      isMain: false,
      standaloneMonthly: 450,
      discountPct: 20,
      // 450 x 0.8 = 360, already on the $5 grid.
      discountedMonthly: 360,
    });
    expect(priced.discountTotal).toBe(90);
    // The main file still prices its own 9 properties from the base assessment.
    expect(priced.perCompany[0].standaloneMonthly).toBe(250 + 9 * 50);
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
      { companyName: "Main Co", kind: "company-monthly", label: "Main Co — monthly bookkeeping", amount: 250, cadence: "monthly" },
      { companyName: "Beta", kind: "company-monthly", label: "Beta — monthly bookkeeping (bundle, 20% off)", amount: 200, cadence: "monthly" },
      { companyName: "Beta", kind: "setup", label: "Beta — new QuickBooks file setup", amount: 150, cadence: "one-time" },
      { companyName: "Downtown", kind: "tag", label: "Downtown — location (included with main file)", amount: 0, cadence: "monthly" },
      { companyName: "Main Co", kind: "locations", label: "Locations — location reporting", amount: 50, cadence: "monthly" },
    ]);
  });

  it("marks a desktop-to-online company as priced separately without charging it", () => {
    const priced = priceCompanyBundle({
      companies: [
        company({ name: "Main Co" }),
        company({ id: "b", name: "Beta", fileStatus: "desktop_to_online" }),
      ],
      packageId: "maintain",
      baseAssessment: {},
      options: OPTIONS,
    });
    const lines = companyBundleFeeLines(priced);
    expect(lines).toContainEqual({
      companyName: "Beta",
      kind: "migration",
      label: "Beta — Desktop → Online migration (priced separately)",
      amount: 0,
      cadence: "one-time",
    });
    expect(priced.setupTotal).toBe(0);
    expect(priced.bundleMonthly).toBe(450);
  });

  it("keys the main line on the company even when its own-file flag is false", () => {
    const priced = priceCompanyBundle({
      companies: [company({ name: "Main Co", ownQboFile: false })],
      packageId: "maintain",
      baseAssessment: {},
      options: OPTIONS,
    });
    expect(companyBundleFeeLines(priced)).toEqual([
      { companyName: "Main Co", kind: "company-monthly", label: "Main Co — monthly bookkeeping", amount: 250, cadence: "monthly" },
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
        { name: "Main Co", ownQboFile: true, monthly: 250, setupOneTime: 0, migrationFlagged: false },
        { name: "Beta", ownQboFile: true, monthly: 200, setupOneTime: 150, migrationFlagged: false },
      ],
      locationsCount: 2,
      locationsMonthly: 50,
      bundleMonthly: 500,
    });
  });

  it("flags desktop-to-online companies in the public shape", () => {
    const raw = [
      company({ name: "Main Co" }),
      company({ id: "b", name: "Beta", fileStatus: "desktop_to_online" }),
    ];
    const pricing = priceCompanyBundle({ companies: raw, packageId: "maintain", baseAssessment: {}, options: OPTIONS });
    expect(toPublicCompanyBundle(raw, pricing)?.companies[1]).toMatchObject({
      name: "Beta",
      monthly: 200,
      setupOneTime: 0,
      migrationFlagged: true,
    });
  });
});

describe("buildCompanyBundleSnapshot", () => {
  it("returns null when no bundle is active", () => {
    expect(buildCompanyBundleSnapshot({ companies: [], baseAssessment: {}, options: OPTIONS })).toBeNull();
    expect(
      buildCompanyBundleSnapshot({
        companies: [company(), company({ id: "tag", name: "Tag", ownQboFile: false })],
        baseAssessment: {},
        options: OPTIONS,
      }),
    ).toBeNull();
  });

  it("prices every tier once with a single options resolution", () => {
    const snapshot = buildCompanyBundleSnapshot({
      companies: [company(), company({ id: "b", name: "Beta" })],
      baseAssessment: {},
      options: OPTIONS,
    });
    expect(snapshot).not.toBeNull();
    // Empty files: main 250/250/375, Beta 200/200/300.
    expect(snapshot!.maintain.bundleMonthly).toBe(450);
    expect(snapshot!.improve.bundleMonthly).toBe(450);
    expect(snapshot!.grow.bundleMonthly).toBe(675);
    expect(snapshot!.maintain.discountTotal).toBe(50);
  });
});

describe("resolveCompanyBundleForTier", () => {
  const companies = [company(), company({ id: "b", name: "Beta" })];

  it("reads the published snapshot object instead of recomputing", () => {
    const snapshot = buildCompanyBundleSnapshot({ companies, baseAssessment: {}, options: OPTIONS });
    const pricing = { maintain: { monthly: 1 }, improve: { monthly: 2 }, grow: { monthly: 3 }, companyBundle: snapshot };
    const resolved = resolveCompanyBundleForTier({ pricing, packageId: "grow", companies: [], options: OPTIONS });
    // Empty fallback companies prove nothing was recomputed: the snapshot wins.
    expect(resolved?.bundleMonthly).toBe(675);
  });

  it("falls back to priceCompanyBundle for old snapshots without the object", () => {
    const resolved = resolveCompanyBundleForTier({
      pricing: { maintain: { monthly: 999 } },
      packageId: "maintain",
      companies,
      baseAssessment: {},
      options: OPTIONS,
    });
    expect(resolved?.bundleMonthly).toBe(450);
  });

  it("returns null for legacy assessments either way", () => {
    expect(resolveCompanyBundleForTier({ pricing: {}, packageId: "maintain", companies: [] })).toBeNull();
    expect(
      resolveCompanyBundleForTier({ pricing: { companyBundle: { bogus: true } }, packageId: "maintain", companies: [] }),
    ).toBeNull();
  });
});

describe("resolveBundlePricingOptions", () => {
  it("prefers the per-proposal override, then template defaults, then the proposed default", () => {
    expect(resolveBundlePricingOptions({})).toEqual(DEFAULT_BUNDLE_PRICING_OPTIONS);
    expect(
      resolveBundlePricingOptions({
        bundlePricingDefaults: { additionalCompanyDiscountPct: 10, locationMonthlyCharge: 5, newFileSetupCharge: 99 },
      }),
    ).toEqual({ additionalCompanyDiscountPct: 10, locationMonthlyCharge: 5, newFileSetupCharge: 99 });
    expect(
      resolveBundlePricingOptions({
        bundlePricingOptions: { additionalCompanyDiscountPct: 30, locationMonthlyCharge: 5, newFileSetupCharge: 99 },
        bundlePricingDefaults: { additionalCompanyDiscountPct: 10, locationMonthlyCharge: 5, newFileSetupCharge: 11 },
      }),
    ).toEqual({ additionalCompanyDiscountPct: 30, locationMonthlyCharge: 5, newFileSetupCharge: 99 });
    // Partial override: set fields win, the rest fall through to template defaults.
    expect(
      resolveBundlePricingOptions({
        bundlePricingOptions: { additionalCompanyDiscountPct: 50 },
        bundlePricingDefaults: { additionalCompanyDiscountPct: 10, locationMonthlyCharge: 7, newFileSetupCharge: 77 },
      }),
    ).toEqual({ additionalCompanyDiscountPct: 50, locationMonthlyCharge: 7, newFileSetupCharge: 77 });
  });

  it("uses the brand catalog new-quickbooks-file price above zero before the $150 fallback", () => {
    const bonuses = [{ id: "new-quickbooks-file", name: "New QuickBooks Setup", description: "", archived: false, addOnPrice: 99, addOnPackageIds: [] }];
    expect(
      resolveBundlePricingOptions({ bonuses }).newFileSetupCharge,
    ).toBe(99);
    // The seed row is $0.00: no price carried, so the proposed $150 applies.
    const zeroed = [{ id: "new-quickbooks-file", name: "New QuickBooks Setup", description: "", archived: false }];
    expect(resolveBundlePricingOptions({ bonuses: zeroed }).newFileSetupCharge).toBe(150);
    // An explicit override still beats the catalog.
    expect(
      resolveBundlePricingOptions({ bonuses, bundlePricingOptions: { newFileSetupCharge: 40 } }).newFileSetupCharge,
    ).toBe(40);
    // Template defaults beat the catalog too.
    expect(
      resolveBundlePricingOptions({ bonuses, bundlePricingDefaults: { newFileSetupCharge: 80 } }).newFileSetupCharge,
    ).toBe(80);
  });

  it("lets the catalog win when the template leaves setup unset, but keeps a stored 150", () => {
    const bonuses = [{ id: "new-quickbooks-file", name: "Setup", description: "", archived: false, addOnPrice: 99 }];
    // New seeds omit newFileSetupCharge: the catalog price applies.
    expect(
      resolveBundlePricingOptions({
        bonuses,
        bundlePricingDefaults: { additionalCompanyDiscountPct: 20, locationMonthlyCharge: 25 },
      }).newFileSetupCharge,
    ).toBe(99);
    // An old-seeded template carrying exactly 150 counts as explicitly set.
    expect(
      resolveBundlePricingOptions({
        bonuses,
        bundlePricingDefaults: { additionalCompanyDiscountPct: 20, locationMonthlyCharge: 25, newFileSetupCharge: 150 },
      }).newFileSetupCharge,
    ).toBe(150);
  });
});

describe("describeNewFileSetupCharge", () => {
  const bonuses = [{ id: "new-quickbooks-file", name: "Setup", description: "", archived: false, addOnPrice: 99 }];
  it("reports the winning source in resolution order", () => {
    expect(describeNewFileSetupCharge({})).toEqual({ value: 150, source: "placeholder" });
    expect(describeNewFileSetupCharge({ bonuses })).toEqual({ value: 99, source: "catalog" });
    expect(describeNewFileSetupCharge({ bonuses, bundlePricingDefaults: { newFileSetupCharge: 80 } })).toEqual(
      { value: 80, source: "template" },
    );
    expect(
      describeNewFileSetupCharge({ bonuses, bundlePricingOptions: { newFileSetupCharge: 40 } }),
    ).toEqual({ value: 40, source: "override" });
  });

  it("keeps non-finite fields unset so sanitizing never manufactures a source", () => {
    expect(sanitizeBundlePricingOverride({ newFileSetupCharge: Number.NaN })).toEqual({});
    expect(sanitizeBundlePricingOverride("bundle")).toEqual({});
    expect(
      sanitizeBundlePricingOverride({ additionalCompanyDiscountPct: 150, locationMonthlyCharge: -5 }),
    ).toEqual({ additionalCompanyDiscountPct: 100, locationMonthlyCharge: 0 });
  });
});

describe("toPublicCompanyBundleMap", () => {
  it("maps every tier so the public block can show the selected tab", () => {
    const raw = [
      company({ name: "Main Co" }),
      company({ id: "b", name: "Beta", fileStatus: "new_file" }),
    ];
    const snapshot = buildCompanyBundleSnapshot({ companies: raw, baseAssessment: {}, options: OPTIONS });
    const mapped = toPublicCompanyBundleMap(raw, snapshot);
    expect(mapped?.maintain.bundleMonthly).toBe(450);
    expect(mapped?.improve.bundleMonthly).toBe(450);
    expect(mapped?.grow.bundleMonthly).toBe(675);
    expect(mapped?.grow.companies[1]).toMatchObject({ name: "Beta", monthly: 300, setupOneTime: 150 });
  });

  it("returns null without a snapshot", () => {
    expect(toPublicCompanyBundleMap([company()], null)).toBeNull();
  });

  it("reads a legacy single-tier payload as every tier", () => {
    const single = toPublicCompanyBundle([company(), company({ id: "b", name: "Beta" })], priceCompanyBundle({
      companies: [company(), company({ id: "b", name: "Beta" })],
      packageId: "maintain",
      baseAssessment: {},
      options: OPTIONS,
    }));
    const mapped = asPublicCompanyBundleMap(single);
    expect(mapped?.maintain.bundleMonthly).toBe(450);
    expect(mapped?.grow.bundleMonthly).toBe(450);
    expect(asPublicCompanyBundleMap(null)).toBeNull();
    expect(asPublicCompanyBundleMap({ bogus: true })).toBeNull();
  });
});

describe("applyBundleOptionEdit", () => {
  it("patches only the edited field, leaving other stored keys alone", () => {
    expect(
      applyBundleOptionEdit({ newFileSetupCharge: 99 }, "additionalCompanyDiscountPct", "15"),
    ).toEqual({ newFileSetupCharge: 99, additionalCompanyDiscountPct: 15 });
  });

  it("never stores the whole resolved object: an edit adds one key, not all three", () => {
    const next = applyBundleOptionEdit({}, "additionalCompanyDiscountPct", "15");
    expect(next).toEqual({ additionalCompanyDiscountPct: 15 });
    expect(next).not.toHaveProperty("locationMonthlyCharge");
    expect(next).not.toHaveProperty("newFileSetupCharge");
  });

  it("deletes the key on blank input so the field falls back down the chain", () => {
    expect(
      applyBundleOptionEdit(
        { additionalCompanyDiscountPct: 30, newFileSetupCharge: 99 },
        "additionalCompanyDiscountPct",
        "",
      ),
    ).toEqual({ newFileSetupCharge: 99 });
    expect(applyBundleOptionEdit({ newFileSetupCharge: 99 }, "newFileSetupCharge", "   ")).toEqual({});
  });

  it("ignores non-numeric input (null, no change)", () => {
    const stored = { additionalCompanyDiscountPct: 30 };
    expect(applyBundleOptionEdit(stored, "additionalCompanyDiscountPct", "abc")).toBeNull();
    expect(applyBundleOptionEdit(stored, "additionalCompanyDiscountPct", "NaN")).toBeNull();
  });
});
