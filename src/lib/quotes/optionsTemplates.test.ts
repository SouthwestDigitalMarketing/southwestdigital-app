import { describe, expect, it } from "vitest";
import { DEFAULT_BUNDLE_PRICING_OPTIONS } from "./companyBundle";
import {
  OPTIONS_TEMPLATE_SNAPSHOT_VERSION,
  buildOptionsTemplateSnapshot,
  parseBundlePricingDefaultsInputs,
  parseOptionsTemplateSnapshot,
  reconcileOptionsTemplateSnapshot,
  sanitizeBundlePricingDefaults,
  type OptionsTemplateAssessmentSlice,
} from "./optionsTemplates";

const baseSlice: OptionsTemplateAssessmentSlice = {
  optionsCatalogOrder: ["stessa-migration", "quarterly-review", "advanced-receipts"],
  additionalOptions: [
    {
      id: "advanced-receipts",
      name: "Advanced Receipt Management",
      description: "Receipts routed through Zoho.",
      monthlyPrice: 60,
      showInProposal: true,
      archived: false,
    },
  ],
  bonuses: [
    {
      id: "stessa-migration",
      name: "Stessa Migration",
      description: "Move all books to Stessa.",
      archived: false,
      billingCadence: "one-time",
      includedPlacement: "main",
      defaultPackageIds: ["grow", "improve"],
    },
    {
      id: "quarterly-review",
      name: "Quarterly Review",
      description: "Meet quarterly to review the books.",
      archived: false,
      billingCadence: "monthly",
      includedPlacement: "included",
    },
  ],
  bonusPackageSelections: {
    "stessa-migration": ["grow", "improve"],
    "quarterly-review": ["grow"],
  },
};

describe("buildOptionsTemplateSnapshot", () => {
  it("keeps the required flag on an add-on when a draft is saved", () => {
    const slice = buildOptionsTemplateSnapshot({
      ...baseSlice,
      additionalOptions: [
        { id: "migration", name: "Migration", description: "", monthlyPrice: 640, showInProposal: true, archived: false, billingCadence: "one-time", required: true },
        { id: "optional-thing", name: "Optional", description: "", monthlyPrice: 10, showInProposal: true, archived: false },
      ],
    } as never);
    expect(slice.additionalOptions.find((o) => o.id === "migration")?.required).toBe(true);
    expect(slice.additionalOptions.find((o) => o.id === "optional-thing")?.required).toBeUndefined();
  });

  it("round-trips a well-formed slice via parse", () => {
    const snapshot = buildOptionsTemplateSnapshot(baseSlice);
    expect(snapshot.version).toBe(OPTIONS_TEMPLATE_SNAPSHOT_VERSION);
    expect(snapshot.productKind).toBe("bookkeeping");
    const roundTripped = parseOptionsTemplateSnapshot(JSON.parse(JSON.stringify(snapshot)));
    expect(roundTripped).toEqual(snapshot);
  });

  it("drops items without an id and deduplicates the catalog order", () => {
    const snapshot = buildOptionsTemplateSnapshot({
      ...baseSlice,
      optionsCatalogOrder: ["stessa-migration", "stessa-migration", "quarterly-review"],
      additionalOptions: [
        ...baseSlice.additionalOptions,
        { ...baseSlice.additionalOptions[0], id: "" },
      ],
    });
    expect(snapshot.optionsCatalogOrder).toEqual(["stessa-migration", "quarterly-review"]);
    expect(snapshot.additionalOptions).toHaveLength(1);
  });

  it("normalizes package selections to unique valid ids", () => {
    const snapshot = buildOptionsTemplateSnapshot({
      ...baseSlice,
      bonusPackageSelections: {
        "stessa-migration": ["grow", "grow", "improve", "invalid" as never],
      },
    });
    expect(snapshot.bonusPackageSelections["stessa-migration"]).toEqual(["grow", "improve"]);
  });
});

describe("parseOptionsTemplateSnapshot", () => {
  it("replaces legacy overpromising bookkeeping copy while preserving the service ids", () => {
    const snapshot = buildOptionsTemplateSnapshot({
      ...baseSlice,
      bonuses: [
        {
          id: "monthly-bookkeeping",
          name: "Monthly Bookkeeping",
          description: "We categorize transactions, reconcile accounts, complete the monthly close, and deliver a clear Balance Sheet and Profit & Loss statement.",
          archived: false,
          billingCadence: "monthly",
        },
        {
          id: "document-organization",
          name: "Audit-Ready Document System",
          description: "Use one organized process for sending records, resolving missing items, and keeping supporting documents connected to the books.",
          archived: false,
        },
      ],
    });

    expect(snapshot.bonuses).toEqual([
      expect.objectContaining({
        id: "monthly-bookkeeping",
        name: "Monthly QuickBooks Bookkeeping",
        description: "Recurring categorization and reconciliation for the QuickBooks accounts included in your plan, using the information and access available to us.",
      }),
      expect.objectContaining({
        id: "document-organization",
        name: "Bookkeeping Document Organization",
        description: "We organize the documents you provide as part of the bookkeeping process.",
      }),
    ]);
  });

  it("returns null for the wrong version", () => {
    const snapshot = buildOptionsTemplateSnapshot(baseSlice);
    expect(parseOptionsTemplateSnapshot({ ...snapshot, version: 999 })).toBeNull();
  });

  it("returns null for a non-bookkeeping product kind", () => {
    const snapshot = buildOptionsTemplateSnapshot(baseSlice);
    expect(parseOptionsTemplateSnapshot({ ...snapshot, productKind: "coaching" })).toBeNull();
  });

  it("returns null for unrelated payloads", () => {
    expect(parseOptionsTemplateSnapshot(null)).toBeNull();
    expect(parseOptionsTemplateSnapshot("hi")).toBeNull();
    expect(parseOptionsTemplateSnapshot({ hello: "world" })).toBeNull();
  });
});

describe("reconcileOptionsTemplateSnapshot", () => {
  it("keeps items that still exist in the catalog and reports the rest", () => {
    const snapshot = buildOptionsTemplateSnapshot(baseSlice);
    const result = reconcileOptionsTemplateSnapshot(snapshot, [
      "stessa-migration",
      "advanced-receipts",
    ]);
    expect(result.skippedIds).toEqual(["quarterly-review"]);
    expect(result.slice.bonuses.map((b) => b.id)).toEqual(["stessa-migration"]);
    expect(result.slice.additionalOptions.map((o) => o.id)).toEqual(["advanced-receipts"]);
    expect(result.slice.optionsCatalogOrder).toEqual(["stessa-migration", "advanced-receipts"]);
    expect(result.slice.bonusPackageSelections).toEqual({ "stessa-migration": ["grow", "improve"] });
  });

  it("keeps everything when the catalog list is empty (unknown catalog state)", () => {
    const snapshot = buildOptionsTemplateSnapshot(baseSlice);
    const result = reconcileOptionsTemplateSnapshot(snapshot, []);
    expect(result.skippedIds).toEqual([]);
    expect(result.slice.additionalOptions).toEqual(snapshot.additionalOptions);
    expect(result.slice.bonuses).toEqual(snapshot.bonuses);
  });
});

describe("bundle pricing defaults (Spec 02)", () => {
  it("keeps the proposed default amounts without a migration", () => {
    expect(DEFAULT_BUNDLE_PRICING_OPTIONS).toEqual({
      additionalCompanyDiscountPct: 20,
      locationMonthlyCharge: 25,
      newFileSetupCharge: 150,
    });
    expect(OPTIONS_TEMPLATE_SNAPSHOT_VERSION).toBe(1);
  });

  it("leaves omitted defaults unset so the catalog can win at resolution", () => {
    const snapshot = buildOptionsTemplateSnapshot(baseSlice);
    expect(snapshot.bundlePricingDefaults).toEqual({});
    const partial = buildOptionsTemplateSnapshot({
      ...baseSlice,
      bundlePricingDefaults: { additionalCompanyDiscountPct: 10, locationMonthlyCharge: 40 },
    });
    expect(partial.bundlePricingDefaults).toEqual({ additionalCompanyDiscountPct: 10, locationMonthlyCharge: 40 });
  });

  it("round-trips custom defaults through build and parse", () => {
    const snapshot = buildOptionsTemplateSnapshot({
      ...baseSlice,
      bundlePricingDefaults: { additionalCompanyDiscountPct: 10, locationMonthlyCharge: 40, newFileSetupCharge: 99 },
    });
    expect(snapshot.bundlePricingDefaults).toEqual({
      additionalCompanyDiscountPct: 10,
      locationMonthlyCharge: 40,
      newFileSetupCharge: 99,
    });
    expect(parseOptionsTemplateSnapshot(JSON.parse(JSON.stringify(snapshot)))).toEqual(snapshot);
  });

  it("parses pre-Spec-02 snapshots with the defaults left unset", () => {
    const legacy = buildOptionsTemplateSnapshot(baseSlice);
    delete (legacy as { bundlePricingDefaults?: unknown }).bundlePricingDefaults;
    const parsed = parseOptionsTemplateSnapshot(JSON.parse(JSON.stringify(legacy)));
    expect(parsed?.bundlePricingDefaults).toEqual({});
  });

  it("keeps a stored 150 as an explicitly set template default", () => {
    expect(sanitizeBundlePricingDefaults({ newFileSetupCharge: 150 })).toEqual({ newFileSetupCharge: 150 });
  });

  it("sanitizes out-of-range and non-finite defaults per field, leaving gaps unset", () => {
    expect(sanitizeBundlePricingDefaults(undefined)).toEqual({});
    expect(sanitizeBundlePricingDefaults(null)).toEqual({});
    expect(
      sanitizeBundlePricingDefaults({
        additionalCompanyDiscountPct: 150,
        locationMonthlyCharge: -5,
        newFileSetupCharge: Number.NaN,
      }),
    ).toEqual({ additionalCompanyDiscountPct: 100, locationMonthlyCharge: 0 });
    expect(
      sanitizeBundlePricingDefaults({ additionalCompanyDiscountPct: Number.POSITIVE_INFINITY }),
    ).toEqual({});
  });

  it("carries the defaults through reconciliation (they are not catalog items)", () => {
    const snapshot = buildOptionsTemplateSnapshot({
      ...baseSlice,
      bundlePricingDefaults: { additionalCompanyDiscountPct: 10, locationMonthlyCharge: 40, newFileSetupCharge: 99 },
    });
    const result = reconcileOptionsTemplateSnapshot(snapshot, ["stessa-migration", "advanced-receipts"]);
    expect(result.slice.bundlePricingDefaults).toEqual({
      additionalCompanyDiscountPct: 10,
      locationMonthlyCharge: 40,
      newFileSetupCharge: 99,
    });
    const missing = reconcileOptionsTemplateSnapshot(
      { ...snapshot, bundlePricingDefaults: undefined },
      ["stessa-migration"],
    );
    expect(missing.slice.bundlePricingDefaults).toEqual({});
  });

  it("parses the manager's text inputs, with blank clearing the key", () => {
    expect(
      parseBundlePricingDefaultsInputs({ discountPct: "15", locationCharge: "30", setupCharge: "99" }),
    ).toEqual({ additionalCompanyDiscountPct: 15, locationMonthlyCharge: 30, newFileSetupCharge: 99 });
    // Blank clears: no key saved, so the field falls back down the chain
    // (never a Number("") 0).
    expect(
      parseBundlePricingDefaultsInputs({ discountPct: "", locationCharge: "", setupCharge: "" }),
    ).toEqual({});
    expect(
      parseBundlePricingDefaultsInputs({ discountPct: "  ", locationCharge: "25", setupCharge: "" }),
    ).toEqual({ locationMonthlyCharge: 25 });
  });

  it("rejects non-numeric and negative manager inputs, clamps the discount", () => {
    expect(
      parseBundlePricingDefaultsInputs({ discountPct: "abc", locationCharge: "25", setupCharge: "" }),
    ).toBeNull();
    expect(
      parseBundlePricingDefaultsInputs({ discountPct: "10", locationCharge: "-5", setupCharge: "" }),
    ).toBeNull();
    expect(
      parseBundlePricingDefaultsInputs({ discountPct: "150", locationCharge: "25", setupCharge: "200" }),
    ).toEqual({ additionalCompanyDiscountPct: 100, locationMonthlyCharge: 25, newFileSetupCharge: 200 });
  });
});
