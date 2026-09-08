import { describe, expect, it } from "vitest";
import {
  OPTIONS_TEMPLATE_SNAPSHOT_VERSION,
  buildOptionsTemplateSnapshot,
  parseOptionsTemplateSnapshot,
  reconcileOptionsTemplateSnapshot,
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
