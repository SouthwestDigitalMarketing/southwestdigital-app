import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("../who/actions", () => ({
  getOfferBuilderContextAction: async () => null,
  saveOfferDraftAction: async () => undefined,
  syncOfferContactsAction: async () => undefined,
}));

import CompanyBundleEditor, {
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
  resolveBundlePricingOptions,
  type BundlePricingOptions,
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
    locationsCount: 0, propertiesCount: 0,
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
      bundleOptions: resolveBundlePricingOptions({}),
      storedBundleOptions: {},
      newFileSetupSource: "placeholder",
      legacyEntitiesField: createElement("span", { id: "legacy-entities" }, "legacy entities input"),
      onCompaniesChange: () => {},
      onBundleOptionsChange: () => {},
      ...props,
    }),
  );
}

type OptionInput = {
  value: number;
  onChange: (event: { target: { value: string } }) => void;
};

function visitTree(node: unknown, visit: (element: { type?: unknown; props?: Record<string, unknown> }) => void): void {
  if (!node || typeof node !== "object") return;
  if (Array.isArray(node)) {
    node.forEach((child) => visitTree(child, visit));
    return;
  }
  const element = node as { type?: unknown; props?: Record<string, unknown> };
  visit(element);
  visitTree(element.props?.children, visit);
}

/** The three bundle-pricing override inputs inside the editor's details section, in order. */
function bundleOptionInputs(tree: unknown): OptionInput[] {
  let detailsChildren: unknown;
  visitTree(tree, (element) => {
    if (detailsChildren === undefined && element.type === "details") {
      detailsChildren = element.props ? element.props.children : undefined;
    }
  });
  expect(detailsChildren).toBeDefined();
  const found: OptionInput[] = [];
  visitTree(detailsChildren, (element) => {
    if (
      element.type === "input" &&
      typeof element.props?.value === "number" &&
      typeof element.props?.onChange === "function"
    ) {
      found.push({
        value: element.props.value,
        onChange: element.props.onChange as OptionInput["onChange"],
      });
    }
  });
  return found;
}

function renderEditorForPayload(props: Partial<CompanyBundleEditorProps> = {}) {
  const fresh = freshAssessment();
  const seen: Array<Partial<BundlePricingOptions>> = [];
  const tree = CompanyBundleEditor({
    companies: [mainCompany(), mainCompany({ id: "b", name: "Beta" })],
    companyName: "Acme LLC",
    mainAccounts: [],
    baseAssessment: effectiveAssessment(fresh),
    bundleOptions: resolveBundlePricingOptions({}),
    storedBundleOptions: {},
    newFileSetupSource: "placeholder",
    legacyEntitiesField: createElement("span", { id: "legacy-entities" }, "legacy entities input"),
    onCompaniesChange: () => {},
    onBundleOptionsChange: (patch) => {
      seen.push(patch);
    },
    ...props,
  });
  return { tree, seen };
}

describe("resolveBundlePricingOptions", () => {
  it("returns the proposed defaults for missing or garbage input", () => {
    expect(resolveBundlePricingOptions({})).toEqual(DEFAULT_BUNDLE_PRICING_OPTIONS);
    expect(resolveBundlePricingOptions(null)).toEqual(DEFAULT_BUNDLE_PRICING_OPTIONS);
    expect(resolveBundlePricingOptions("bundle")).toEqual(DEFAULT_BUNDLE_PRICING_OPTIONS);
    expect(resolveBundlePricingOptions([])).toEqual(DEFAULT_BUNDLE_PRICING_OPTIONS);
  });

  it("merges a partial per-proposal override over the template defaults", () => {
    expect(
      resolveBundlePricingOptions({ bundlePricingOptions: { additionalCompanyDiscountPct: 30 } }),
    ).toEqual({
      additionalCompanyDiscountPct: 30,
      locationMonthlyCharge: 25,
      newFileSetupCharge: 150,
    });
  });

  it("clamps the discount and floors charges, keeping non-finite fields at defaults", () => {
    expect(
      resolveBundlePricingOptions({
        bundlePricingOptions: {
          additionalCompanyDiscountPct: 150,
          locationMonthlyCharge: -5,
          newFileSetupCharge: Number.NaN,
        },
      }),
    ).toEqual({ additionalCompanyDiscountPct: 100, locationMonthlyCharge: 0, newFileSetupCharge: 150 });
    expect(resolveBundlePricingOptions({ bundlePricingOptions: { additionalCompanyDiscountPct: -5 } })).toEqual({
      ...DEFAULT_BUNDLE_PRICING_OPTIONS,
      additionalCompanyDiscountPct: 0,
    });
  });

  it("reads the brand catalog new-file price when the template leaves the default", () => {
    const bonuses = [{ id: "new-quickbooks-file", name: "Setup", description: "", archived: false, addOnPrice: 99 }];
    expect(resolveBundlePricingOptions({ bonuses }).newFileSetupCharge).toBe(99);
    expect(
      resolveBundlePricingOptions({ bonuses, bundlePricingDefaults: { newFileSetupCharge: 80 } }).newFileSetupCharge,
    ).toBe(80);
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
        mainCompany({ locationsCount: 2, propertiesCount: 0, fileStatus: "new_file" }),
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
    expect(html).toContain("Shares the main file — priced as part of the main company, not on its own.");
  });

  it("keeps the legacy entities field for a tag-only addition (no bundle)", () => {
    // F2: ownQboFile=false rows never activate the bundle, so the legacy
    // per-entity charge (and its input) survives the tag.
    const html = editorHtml({
      companies: [mainCompany(), mainCompany({ id: "b", name: "Beta", ownQboFile: false })],
    });
    expect(html).toContain("legacy entities input");
    expect(html).not.toContain("Priced per company below");
    expect(html).not.toContain("Bundle price (read-only)");
  });

  it("offers locations only on the main company, never on added companies", () => {
    // F3: only companies[0].locationsCount is charged, so only the main card
    // renders a locations input.
    const html = editorHtml({
      companies: [mainCompany(), mainCompany({ id: "b", name: "Beta" })],
    });
    expect(html.match(/Locations in the main file/g)).toHaveLength(1);
  });

  it("edits properties on added companies while the main file keeps the existing input", () => {
    // R1: the main company prices its properties through the existing
    // assessment properties input, so only added files get their own field.
    const html = editorHtml({
      companies: [mainCompany(), mainCompany({ id: "b", name: "Beta", propertiesCount: 3 })],
    });
    expect(html).toContain("Properties in this file");
    expect(html.match(/Properties in this file/g)).toHaveLength(1);
    expect(html).toContain("3 properties");
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
      newFileSetupSource: "override",
    });
    // 250 standalone at 10% off rounds up to 225.
    expect(html).toContain("bundle discount 10%");
    expect(html).toContain("Maintain $225");
    expect(html).toContain("effective $150 — proposal override");
  });

  it("shows the effective setup value and its source", () => {
    const bundled = { companies: [mainCompany(), mainCompany({ id: "b", name: "Beta" })] };
    expect(editorHtml({ ...bundled, newFileSetupSource: "placeholder" })).toContain(
      "effective $150 — placeholder",
    );
    expect(
      editorHtml({
        ...bundled,
        bundleOptions: { additionalCompanyDiscountPct: 20, locationMonthlyCharge: 25, newFileSetupCharge: 99 },
        newFileSetupSource: "catalog",
      }),
    ).toContain("effective $99 — from catalog");
    expect(
      editorHtml({
        ...bundled,
        bundleOptions: { additionalCompanyDiscountPct: 20, locationMonthlyCharge: 25, newFileSetupCharge: 80 },
        newFileSetupSource: "template",
      }),
    ).toContain("effective $80 — template default");
  });
});

describe("CompanyBundleEditor option change payload", () => {
  it("sends a one-field stored patch when the discount changes, never the resolved object", () => {
    const { tree, seen } = renderEditorForPayload({
      storedBundleOptions: { newFileSetupCharge: 99 },
    });
    const inputs = bundleOptionInputs(tree);
    // Display still shows the resolved values (20/25/150).
    expect(inputs.map((input) => input.value)).toEqual([20, 25, 150]);
    inputs[0].onChange({ target: { value: "15" } });
    // Only the edited field joins the stored keys — no resolved-object freeze.
    expect(seen).toEqual([{ newFileSetupCharge: 99, additionalCompanyDiscountPct: 15 }]);
  });

  it("deletes the setup key on blank so the charge falls back down the chain", () => {
    const { tree, seen } = renderEditorForPayload({
      storedBundleOptions: { newFileSetupCharge: 99 },
    });
    bundleOptionInputs(tree)[2].onChange({ target: { value: "" } });
    expect(seen).toEqual([{}]);
  });

  it("sends nothing for non-numeric input", () => {
    const { tree, seen } = renderEditorForPayload();
    bundleOptionInputs(tree)[1].onChange({ target: { value: "abc" } });
    expect(seen).toEqual([]);
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
          locationsCount: 1, propertiesCount: 0,
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
    // Unset fields stay unset so resolution can fall through to the template,
    // catalog, and placeholder — only the stored 30 is explicit here.
    expect(merged.bundlePricingOptions).toEqual({ additionalCompanyDiscountPct: 30 });
    // Main 250 + Beta (250 at 30% off = 175), no legacy entity charge.
    expect(getProposalPricingSnapshotData(merged).packagePricing.maintain.monthly).toBe(425);
  });
});
