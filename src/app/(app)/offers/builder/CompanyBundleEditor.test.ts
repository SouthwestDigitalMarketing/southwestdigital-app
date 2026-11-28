import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("../who/actions", () => ({
  getOfferBuilderContextAction: async () => null,
  saveOfferDraftAction: async () => undefined,
  syncOfferContactsAction: async () => undefined,
}));

import CompanyBundleEditor, {
  resolveBundlePricingOptions,
  withSyncedMainAccounts,
  type CompanyBundleEditorProps,
} from "./CompanyBundleEditor";
import {
  getProposalPricingSnapshotData,
  mergeStoredAssessment,
  useProposalAssessmentDemoState,
  type AssessmentState,
} from "./ProposalCreationWorkspaceDemo";
import { effectiveAssessment } from "./effectiveAssessment";
import {
  DEFAULT_BUNDLE_PRICING_OPTIONS,
  type CompanyEntry,
} from "@/lib/quotes/companyBundle";
import type { AccountEntry } from "@/lib/quotes/accountInventory";

function freshAssessment(): AssessmentState {
  let state: AssessmentState;
  function Capture() {
    state = useProposalAssessmentDemoState({ persist: false }).assessment;
    return null;
  }
  renderToStaticMarkup(createElement(Capture));
  return state!;
}

function mainCompany(overrides: Partial<CompanyEntry> = {}): CompanyEntry {
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

function editorHtml(props: Partial<CompanyBundleEditorProps> = {}) {
  const fresh = freshAssessment();
  return renderToStaticMarkup(
    createElement(CompanyBundleEditor, {
      companies: [],
      companyName: "Acme LLC",
      mainAccounts: [],
      baseAssessment: effectiveAssessment(fresh),
      bundleOptions: resolveBundlePricingOptions(undefined),
      legacyEntitiesField: createElement("span", { id: "legacy-entities" }, "legacy entities input"),
      onCompaniesChange: () => {},
      onBundleOptionsChange: () => {},
      ...props,
    }),
  );
}

describe("resolveBundlePricingOptions", () => {
  it("returns the proposed defaults for missing or garbage input", () => {
    expect(resolveBundlePricingOptions(undefined)).toEqual(DEFAULT_BUNDLE_PRICING_OPTIONS);
    expect(resolveBundlePricingOptions(null)).toEqual(DEFAULT_BUNDLE_PRICING_OPTIONS);
    expect(resolveBundlePricingOptions("bundle")).toEqual(DEFAULT_BUNDLE_PRICING_OPTIONS);
    expect(resolveBundlePricingOptions([])).toEqual(DEFAULT_BUNDLE_PRICING_OPTIONS);
  });

  it("merges a partial override over the defaults", () => {
    expect(resolveBundlePricingOptions({ additionalCompanyDiscountPct: 30 })).toEqual({
      additionalCompanyDiscountPct: 30,
      locationMonthlyCharge: 25,
      newFileSetupCharge: 150,
    });
  });

  it("clamps the discount and floors charges, keeping non-finite fields at defaults", () => {
    expect(
      resolveBundlePricingOptions({
        additionalCompanyDiscountPct: 150,
        locationMonthlyCharge: -5,
        newFileSetupCharge: Number.NaN,
      }),
    ).toEqual({ additionalCompanyDiscountPct: 100, locationMonthlyCharge: 0, newFileSetupCharge: 150 });
    expect(resolveBundlePricingOptions({ additionalCompanyDiscountPct: -5 })).toEqual({
      ...DEFAULT_BUNDLE_PRICING_OPTIONS,
      additionalCompanyDiscountPct: 0,
    });
  });
});

describe("withSyncedMainAccounts", () => {
  it("returns an empty list untouched", () => {
    expect(withSyncedMainAccounts([], [{ id: "a" } as AccountEntry])).toEqual([]);
  });

  it("mirrors the main inventory onto companies[0] and leaves added companies alone", () => {
    const betaAccounts: AccountEntry[] = [
      { id: "b1", kind: "checking", label: "Beta", monthlyTransactions: 0, status: "open", basis: "estimated" },
    ];
    const mainAccounts: AccountEntry[] = [
      { id: "a1", kind: "checking", label: "Main", monthlyTransactions: 0, status: "open", basis: "estimated" },
    ];
    const synced = withSyncedMainAccounts(
      [mainCompany({ accounts: [] }), mainCompany({ id: "b", name: "Beta", accounts: betaAccounts })],
      mainAccounts,
    );
    expect(synced).toHaveLength(2);
    expect(synced[0].accounts).toEqual(mainAccounts);
    expect(synced[1].accounts).toEqual(betaAccounts);
  });
});

describe("CompanyBundleEditor states", () => {
  it("shows the legacy entities field and an Add company button with no bundle", () => {
    const html = editorHtml();
    expect(html).toContain("legacy entities input");
    expect(html).toContain("Add company");
    expect(html).not.toContain("Priced per company below");
    expect(html).not.toContain("Bundle price (read-only)");
  });

  it("keeps the legacy field for a solo plain main company with no price summary", () => {
    const html = editorHtml({ companies: [mainCompany()] });
    expect(html).toContain("legacy entities input");
    expect(html).toContain("Main company");
    expect(html).not.toContain("Priced per company below");
    expect(html).not.toContain("Bundle price (read-only)");
  });

  it("hides the legacy field and prices two files with the bundle discount", () => {
    const html = editorHtml({
      companies: [mainCompany(), mainCompany({ id: "b", name: "Beta" })],
    });
    expect(html).toContain("Priced per company below");
    expect(html).not.toContain("legacy entities input");
    expect(html).toContain("Bundle price (read-only)");
    // Empty inventories: main 250 full price, Beta 250 standalone with 20% off.
    expect(html).toContain("bundle discount 20%");
    expect(html).toContain("Maintain $200");
    expect(html).toContain("full price");
    // Bundle monthly per package: grow 675, improve/maintain 450.
    expect(html).toContain("Grow $675");
    expect(html).toContain("Maintain $450");
  });

  it("shows locations and one-time setup lines", () => {
    const html = editorHtml({
      companies: [
        mainCompany({ locationsCount: 2, fileStatus: "new_file" }),
        mainCompany({ id: "b", name: "Beta" }),
      ],
    });
    expect(html).toContain("Locations in the main file (2)");
    expect(html).toContain("+$50/mo");
    expect(html).toContain("Setup total: $150 one-time");
    expect(html).toContain("Maintain $500");
  });

  it("marks a shared-file company as included with the main file", () => {
    const html = editorHtml({
      companies: [mainCompany(), mainCompany({ id: "b", name: "Beta", ownQboFile: false })],
    });
    expect(html).toContain("included with the main file, no separate monthly price");
  });

  it("flags Desktop-to-Online instead of pricing it", () => {
    const html = editorHtml({
      companies: [mainCompany(), mainCompany({ id: "b", name: "Beta", fileStatus: "desktop_to_online" })],
    });
    expect(html).toContain("Flagged only");
  });

  it("shows the proposed option defaults in the collapsed bundle pricing section", () => {
    const html = editorHtml({
      companies: [mainCompany(), mainCompany({ id: "b", name: "Beta" })],
    });
    expect(html).toContain("Bundle pricing (per-proposal override)");
    expect(html).toContain('value="20"');
    expect(html).toContain('value="25"');
    expect(html).toContain('value="150"');
  });

  it("reflects a per-proposal option override in the summary", () => {
    const html = editorHtml({
      companies: [mainCompany(), mainCompany({ id: "b", name: "Beta" })],
      bundleOptions: { additionalCompanyDiscountPct: 10, locationMonthlyCharge: 25, newFileSetupCharge: 150 },
    });
    // 250 standalone at 10% off rounds up to 225.
    expect(html).toContain("bundle discount 10%");
    expect(html).toContain("Maintain $225");
  });
});

describe("saved-state load and normalize", () => {
  it("loads legacy snapshots exactly as before (no companies key)", () => {
    const fresh = freshAssessment();
    const legacy = { ...fresh, numberOfEntities: 3, companyName: "Legacy Co" };
    const merged = mergeStoredAssessment(JSON.stringify({ ...legacy, companies: undefined }), fresh);
    expect(merged.companies).toBeUndefined();
    expect(merged.bundlePricingOptions).toBeUndefined();
    expect(merged.numberOfEntities).toBe(3);
    expect(getProposalPricingSnapshotData(merged).packagePricing).toEqual(
      getProposalPricingSnapshotData(legacy).packagePricing,
    );
  });

  it("treats a stored empty companies list like a legacy snapshot", () => {
    const fresh = freshAssessment();
    const legacy = { ...fresh, numberOfEntities: 2 };
    const merged = mergeStoredAssessment(JSON.stringify({ ...legacy, companies: [] }), fresh);
    expect(merged.companies).toBeUndefined();
    expect(getProposalPricingSnapshotData(merged).packagePricing).toEqual(
      getProposalPricingSnapshotData(legacy).packagePricing,
    );
  });

  it("normalizes a stored bundle and mirrors companies[0].accounts to assessment.accounts", () => {
    const fresh = freshAssessment();
    const storedAccount = {
      id: "a1",
      kind: "checking",
      label: "Chase",
      monthlyTransactions: 1200,
      status: "open",
      basis: "measured",
    } as AccountEntry;
    const raw = JSON.stringify({
      ...fresh,
      numberOfEntities: 2,
      accounts: [],
      companies: [
        {
          id: "m",
          name: "",
          ownQboFile: true,
          fileStatus: "new_file",
          locationsCount: 1,
          accounts: [storedAccount],
          complexity: null,
        },
      ],
    });
    const merged = mergeStoredAssessment(raw, fresh);
    expect(merged.companies).toHaveLength(1);
    expect(merged.companies?.[0].name).toBe("Company 1");
    expect(merged.accounts).toHaveLength(1);
    expect(merged.accounts).toEqual(merged.companies?.[0].accounts);
  });

  it("sanitizes a stored partial options override and prices with it", () => {
    const fresh = freshAssessment();
    const merged = mergeStoredAssessment(
      JSON.stringify({
        ...fresh,
        companies: [mainCompany(), mainCompany({ id: "b", name: "Beta" })],
        bundlePricingOptions: { additionalCompanyDiscountPct: 30 },
      }),
      fresh,
    );
    expect(merged.bundlePricingOptions).toEqual({
      additionalCompanyDiscountPct: 30,
      locationMonthlyCharge: 25,
      newFileSetupCharge: 150,
    });
    // Main 250 + Beta (250 at 30% off = 175), no legacy entity charge.
    expect(getProposalPricingSnapshotData(merged).packagePricing.maintain.monthly).toBe(425);
  });
});
