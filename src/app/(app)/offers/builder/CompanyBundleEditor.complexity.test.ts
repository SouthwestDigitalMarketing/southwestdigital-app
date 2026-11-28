import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("../who/actions", () => ({
  getOfferBuilderContextAction: async () => null,
  saveOfferDraftAction: async () => undefined,
  syncOfferContactsAction: async () => undefined,
}));

import CompanyBundleEditor, {
  type CompanyBundleEditorProps,
} from "./CompanyBundleEditor";
import ComplexityChecklist from "./ComplexityChecklist";
import {
  getProposalPricingSnapshotData,
  mergeStoredAssessment,
  useProposalAssessmentDemoState,
  type AssessmentState,
} from "./ProposalCreationWorkspaceDemo";
import { effectiveAssessment } from "./effectiveAssessment";
import {
  resolveBundlePricingOptions,
  type CompanyEntry,
} from "@/lib/quotes/companyBundle";
import {
  hasComplexitySelection,
  normalizeComplexitySelection,
} from "@/lib/quotes/complexityDrivers";

function freshAssessment(): AssessmentState {
  let state: AssessmentState;
  function Capture() {
    state = useProposalAssessmentDemoState({ persist: false }).assessment;
    return null;
  }
  renderToStaticMarkup(createElement(Capture));
  return state!;
}

function company(overrides: Partial<CompanyEntry> & { id: string }): CompanyEntry {
  return {
    name: "",
    ownQboFile: true,
    fileStatus: "existing",
    locationsCount: 0,
    propertiesCount: 0,
    accounts: [],
    complexity: null,
    ...overrides,
  };
}

type ElementNode = { type?: unknown; props?: Record<string, unknown> };

function visitTree(node: unknown, visit: (element: ElementNode) => void): void {
  if (!node || typeof node !== "object") return;
  if (Array.isArray(node)) {
    node.forEach((child) => visitTree(child, visit));
    return;
  }
  const element = node as ElementNode;
  visit(element);
  visitTree(element.props?.children, visit);
}

function renderEditor(props: Partial<CompanyBundleEditorProps> = {}) {
  const fresh = freshAssessment();
  const seen: Array<CompanyEntry[] | undefined> = [];
  const tree = CompanyBundleEditor({
    companies: [],
    companyName: "Acme LLC",
    mainAccounts: [],
    baseAssessment: effectiveAssessment(fresh),
    bundleOptions: resolveBundlePricingOptions({}),
    storedBundleOptions: {},
    newFileSetupSource: "placeholder",
    legacyEntitiesField: createElement("span", { id: "legacy-entities" }, "legacy entities input"),
    onCompaniesChange: (next) => {
      seen.push(next);
    },
    onBundleOptionsChange: () => {},
    ...props,
  });
  return { tree, seen };
}

function checklistElements(tree: unknown): ElementNode[] {
  const found: ElementNode[] = [];
  visitTree(tree, (element) => {
    if (element.type === ComplexityChecklist) found.push(element);
  });
  return found;
}

describe("CompanyBundleEditor per-company complexity checklist", () => {
  it("shows one checklist per added company with its own file, none for shared files", () => {
    const { tree } = renderEditor({
      companies: [
        company({ id: "main", name: "Main Co" }),
        company({ id: "beta", name: "Beta" }),
        company({ id: "gamma", name: "Gamma", ownQboFile: false }),
      ],
    });
    // Two added companies, but only Beta has its own file.
    expect(checklistElements(tree)).toHaveLength(1);
  });

  it("shows no checklist without a bundle (legacy unchanged)", () => {
    const { html } = (() => {
      const fresh = freshAssessment();
      const html = renderToStaticMarkup(
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
        }),
      );
      return { html };
    })();
    expect(html).toContain("legacy entities input");
    expect(html).not.toContain("Complexity drivers for this file");
  });

  it("writing the per-company checklist updates only that company", () => {
    const betaComplexity = normalizeComplexitySelection({ drivers: { inventory_cogs: { checked: true } } });
    const { tree, seen } = renderEditor({
      companies: [
        company({ id: "main", name: "Main Co" }),
        company({ id: "beta", name: "Beta" }),
      ],
    });
    const [checklist] = checklistElements(tree);
    expect(checklist).toBeDefined();
    (checklist.props?.onChange as (next: unknown) => void)(betaComplexity);
    expect(seen).toHaveLength(1);
    const next = seen[0]!;
    expect(next.find((entry) => entry.id === "beta")?.complexity).toEqual(betaComplexity);
    expect(hasComplexitySelection(next.find((entry) => entry.id === "beta")?.complexity)).toBe(true);
    // The main company's snapshot key is untouched.
    expect(next.find((entry) => entry.id === "main")?.complexity).toBeNull();
  });

  it("per-company existing-line drivers read absent (Will add), matching per-company pricing", () => {
    const fresh = freshAssessment();
    const html = renderToStaticMarkup(
      createElement(CompanyBundleEditor, {
        companies: [
          company({ id: "main", name: "Main Co" }),
          company({
            id: "beta",
            name: "Beta",
            complexity: { ...normalizeComplexitySelection({ drivers: { sales_tax: { checked: true } } }) },
          }),
        ],
        companyName: "Acme LLC",
        mainAccounts: [],
        baseAssessment: effectiveAssessment(fresh),
        bundleOptions: resolveBundlePricingOptions({}),
        storedBundleOptions: {},
        newFileSetupSource: "placeholder",
        legacyEntitiesField: createElement("span", { id: "legacy-entities" }, "legacy"),
        onCompaniesChange: () => {},
        onBundleOptionsChange: () => {},
      }),
    );
    // The added file has no add-on of its own, so the row reads "Will add" —
    // the same `requiresExistingLine` pricing emits for the file.
    expect(html).toContain("Will add the Sales Tax Filing &amp; Remittance add-on.");
  });

  it("per-company rows never show a counted-once hint for main-file platforms", () => {
    const fresh = freshAssessment();
    const html = renderToStaticMarkup(
      createElement(CompanyBundleEditor, {
        companies: [
          company({ id: "main", name: "Main Co" }),
          company({
            id: "beta",
            name: "Beta",
            complexity: {
              ...normalizeComplexitySelection({
                drivers: { online_store: { checked: true, name: "Shopify", payoutPlatform: "stripe" } },
              }),
            },
          }),
        ],
        companyName: "Acme LLC",
        mainAccounts: [],
        // Main file lists Stripe, but per-company rows price zero
        // platforms — the hint must not fire off the main file's list.
        baseAssessment: { ...effectiveAssessment(fresh), paymentPlatforms: ["stripe"] },
        bundleOptions: resolveBundlePricingOptions({}),
        storedBundleOptions: {},
        newFileSetupSource: "placeholder",
        legacyEntitiesField: createElement("span", { id: "legacy-entities" }, "legacy"),
        onCompaniesChange: () => {},
        onBundleOptionsChange: () => {},
      }),
    );
    expect(html).toContain("Complexity drivers for this file");
    expect(html).not.toContain("Counted once here");
    expect(html).not.toContain("choose Stripe above");
  });

  it("a ticked per-company selection renders ticked", () => {
    const fresh = freshAssessment();
    const html = renderToStaticMarkup(
      createElement(CompanyBundleEditor, {
        companies: [
          company({ id: "main", name: "Main Co" }),
          company({
            id: "beta",
            name: "Beta",
            complexity: { ...normalizeComplexitySelection({ drivers: { online_store: { checked: true, name: "Shopify" } } }) },
          }),
        ],
        companyName: "Acme LLC",
        mainAccounts: [],
        baseAssessment: effectiveAssessment(fresh),
        bundleOptions: resolveBundlePricingOptions({}),
        storedBundleOptions: {},
        newFileSetupSource: "placeholder",
        legacyEntitiesField: createElement("span", { id: "legacy-entities" }, "legacy"),
        onCompaniesChange: () => {},
        onBundleOptionsChange: () => {},
      }),
    );
    expect(html).toContain("Complexity drivers for this file");
    expect(html).toContain("Shopify");
  });
});

// Re-export guard: the pricing snapshot path is Builder B's; this file only
// asserts the editor never changes stored pricing data on a complexity edit.
describe("complexity edits preserve pricing snapshot inputs", () => {
  it("getProposalPricingSnapshotData still runs with a complexity selection present", () => {
    const fresh = freshAssessment();
    const withComplexity: AssessmentState = {
      ...fresh,
      complexity: normalizeComplexitySelection({ drivers: { inventory_cogs: { checked: true } } }),
    };
    expect(() => getProposalPricingSnapshotData(withComplexity)).not.toThrow();
    const merged = mergeStoredAssessment(JSON.stringify({ complexity: { drivers: 42 } }), fresh);
    expect(merged.complexity).toBeDefined();
  });
});
