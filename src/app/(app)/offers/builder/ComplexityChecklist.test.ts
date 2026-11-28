import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import ComplexityChecklist from "./ComplexityChecklist";
import {
  hasComplexitySelection,
  normalizeComplexitySelection,
  type ComplexitySelection,
} from "@/lib/quotes/complexityDrivers";

function renderHtml(props: Partial<Parameters<typeof ComplexityChecklist>[0]> = {}) {
  const seen: ComplexitySelection[] = [];
  const html = renderToStaticMarkup(
    createElement(ComplexityChecklist, {
      selection: undefined,
      onChange: (next) => {
        seen.push(next);
      },
      ...props,
    }),
  );
  return { html, seen };
}

function renderTree(props: Partial<Parameters<typeof ComplexityChecklist>[0]> = {}) {
  const seen: ComplexitySelection[] = [];
  const tree = ComplexityChecklist({
    selection: undefined,
    onChange: (next) => {
      seen.push(next);
    },
    ...props,
  });
  return { tree, seen };
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

function findInput(tree: unknown, ariaLabel: string): { checked?: boolean; value?: unknown; onChange: (event: { target: { checked?: boolean; value: string } }) => void } {
  let found: ElementNode | undefined;
  visitTree(tree, (element) => {
    if (found === undefined && element.type === "input" && element.props?.["aria-label"] === ariaLabel) {
      found = element;
    }
  });
  expect(found, `input aria-label="${ariaLabel}"`).toBeDefined();
  return {
    checked: found!.props?.checked as boolean | undefined,
    value: found!.props?.value,
    onChange: found!.props?.onChange as (event: { target: { checked?: boolean; value: string } }) => void,
  };
}

function findSelect(tree: unknown, ariaLabel: string): { value?: unknown; onChange: (event: { target: { value: string } }) => void } {
  let found: ElementNode | undefined;
  visitTree(tree, (element) => {
    if (found === undefined && element.type === "select" && element.props?.["aria-label"] === ariaLabel) {
      found = element;
    }
  });
  expect(found, `select aria-label="${ariaLabel}"`).toBeDefined();
  return {
    value: found!.props?.value,
    onChange: found!.props?.onChange as (event: { target: { value: string } }) => void,
  };
}

function hasSelect(tree: unknown, ariaLabel: string): boolean {
  let found = false;
  visitTree(tree, (element) => {
    if (element.type === "select" && element.props?.["aria-label"] === ariaLabel) found = true;
  });
  return found;
}

describe("ComplexityChecklist SSR states", () => {
  it("renders one unticked row per driver with no selection (legacy)", () => {
    const { html } = renderHtml({ selection: undefined });
    for (const label of [
      "Payroll",
      "Sales tax filing",
      "Job / project tracking",
      "Mixed books",
      "Inventory and cost of goods",
      "Point-of-sale system",
      "Online store",
      "Merchant cash advances and loans with principal / interest / fee splits",
      "Personal spending in the business",
      "1099 filing",
    ]) {
      expect(html).toContain(label);
    }
    expect(html).not.toContain("checked");
    // Legacy: nothing ticked, so no name/count/override inputs.
    expect(html).not.toContain("System name");
    expect(html).not.toContain("Number of payees");
  });

  it("ticked POS row shows the name input and names the system", () => {
    const { html } = renderHtml({
      selection: normalizeComplexitySelection({ drivers: { pos_system: { checked: true, name: "Lightspeed" } } }),
    });
    expect(html).toContain("System name");
    expect(html).toContain("Lightspeed");
  });

  it("ticked 1099 row shows the payee-count input with the count", () => {
    const { html } = renderHtml({
      selection: normalizeComplexitySelection({ drivers: { filing_1099: { checked: true, count: 10 } } }),
    });
    expect(html).toContain("Number of payees");
    expect(html).toContain('value="10"');
  });

  it("existing-line drivers show Included when that line is present", () => {
    const { html } = renderHtml({
      selection: normalizeComplexitySelection({ drivers: { sales_tax: { checked: true } } }),
      existing: { salesTaxAddon: true },
    });
    expect(html).toContain("Included in Sales Tax Filing &amp; Remittance");
  });

  it("existing-line drivers show the will-add note when that line is absent", () => {
    const { html } = renderHtml({
      selection: normalizeComplexitySelection({ drivers: { sales_tax: { checked: true } } }),
      existing: { salesTaxAddon: false },
    });
    expect(html).toContain("Will add the Sales Tax Filing &amp; Remittance add-on.");
    expect(html).not.toContain("Included in");
  });

  it("omitted existing presence reads as Included (legacy behavior)", () => {
    const { html } = renderHtml({
      selection: normalizeComplexitySelection({ drivers: { payroll: { checked: true } } }),
    });
    expect(html).toContain("Included in staffing line");
  });

  it("builder hints are visible for loans/MCA and the online store", () => {
    const { html } = renderHtml({ selection: undefined });
    expect(html).toContain("Plain loan reconciliation is already in the reconciliation line");
    expect(html).toContain("counted once here");
  });

  it("payout-channel hint shows only for an explicit listed choice, never the name", () => {
    const withChoice = renderHtml({
      selection: normalizeComplexitySelection({
        drivers: { online_store: { checked: true, name: "Shopify", payoutPlatform: "stripe" } },
      }),
      paymentPlatforms: ["stripe"],
    });
    expect(withChoice.html).toContain("Counted once here — the store driver wins");
    // The name alone ("Stripe") no longer counts: a separate Stripe
    // account stays charged.
    for (const selection of [
      normalizeComplexitySelection({ drivers: { online_store: { checked: true, name: "Stripe" } } }),
      normalizeComplexitySelection({ drivers: { online_store: { checked: true, name: "Shopify" } } }),
      normalizeComplexitySelection({
        drivers: { online_store: { checked: true, name: "Shopify", payoutPlatform: "stripe" } },
      }),
    ]) {
      const { html } = renderHtml({ selection, paymentPlatforms: [] });
      expect(html).not.toContain("the store driver wins");
    }
    const unlisted = renderHtml({
      selection: normalizeComplexitySelection({
        drivers: { online_store: { checked: true, name: "Shopify", payoutPlatform: "stripe" } },
      }),
      paymentPlatforms: ["paypal"],
    });
    expect(unlisted.html).not.toContain("the store driver wins");
  });

  it("suggests Stripe for a Shopify store but excludes nothing", () => {
    const { html } = renderHtml({
      selection: normalizeComplexitySelection({ drivers: { online_store: { checked: true, name: "Shopify" } } }),
      paymentPlatforms: ["stripe"],
    });
    expect(html).toContain("choose Stripe above to count it once here");
    expect(html).not.toContain("the store driver wins");
    const chosen = renderHtml({
      selection: normalizeComplexitySelection({
        drivers: { online_store: { checked: true, name: "Shopify", payoutPlatform: "stripe" } } }),
      paymentPlatforms: ["stripe"],
    });
    expect(chosen.html).not.toContain("choose Stripe above");
  });

  it("ticked 1099 without a payee count asks for the count", () => {
    const { html } = renderHtml({
      selection: normalizeComplexitySelection({ drivers: { filing_1099: { checked: true } } }),
    });
    expect(html).toContain("Add the payee count to price this");
    const counted = renderHtml({
      selection: normalizeComplexitySelection({ drivers: { filing_1099: { checked: true, count: 10 } } }),
    });
    expect(counted.html).not.toContain("Add the payee count to price this");
    const overridden = renderHtml({
      selection: normalizeComplexitySelection({
        drivers: { filing_1099: { checked: true, monthlyOverride: 100 } },
      }),
    });
    expect(overridden.html).not.toContain("Add the payee count to price this");
  });

  it("new drivers show the resolved default and a per-proposal override input", () => {
    const { html } = renderHtml({
      selection: normalizeComplexitySelection({ drivers: { inventory_cogs: { checked: true } } }),
    });
    expect(html).toContain("$95/mo");
    expect(html).toContain("Override $");
  });
});

describe("ComplexityChecklist onChange", () => {
  it("ticking a box writes a normalized selection", () => {
    const { tree, seen } = renderTree({ selection: undefined });
    findInput(tree, "Payroll").onChange({ target: { checked: true, value: "" } });
    expect(seen).toHaveLength(1);
    expect(seen[0].drivers.payroll).toEqual({ checked: true });
    expect(hasComplexitySelection(seen[0])).toBe(true);
  });

  it("typing a store name keeps the row checked and carries the name", () => {
    const { tree, seen } = renderTree({
      selection: normalizeComplexitySelection({ drivers: { online_store: { checked: true } } }),
    });
    findInput(tree, "Online store name").onChange({ target: { value: "Shopify" } });
    expect(seen).toHaveLength(1);
    expect(seen[0].drivers.online_store).toEqual({ checked: true, name: "Shopify" });
  });

  it("typing a 1099 count carries the count", () => {
    const { tree, seen } = renderTree({
      selection: normalizeComplexitySelection({ drivers: { filing_1099: { checked: true } } }),
    });
    findInput(tree, "1099 filing count").onChange({ target: { value: "10" } });
    expect(seen[0].drivers.filing_1099).toEqual({ checked: true, count: 10 });
  });

  it("typing an override carries the monthlyOverride", () => {
    const { tree, seen } = renderTree({
      selection: normalizeComplexitySelection({ drivers: { inventory_cogs: { checked: true } } }),
    });
    findInput(tree, "Inventory and cost of goods monthly override").onChange({ target: { value: "120" } });
    expect(seen[0].drivers.inventory_cogs).toEqual({ checked: true, monthlyOverride: 120 });
  });

  it("choosing a payout channel carries payoutPlatform, None clears it", () => {
    const { tree, seen } = renderTree({
      selection: normalizeComplexitySelection({ drivers: { online_store: { checked: true, name: "Shopify" } } }),
      paymentPlatforms: ["stripe", "paypal"],
    });
    findSelect(tree, "Online store payout channel").onChange({ target: { value: "stripe" } });
    expect(seen[0].drivers.online_store).toEqual({
      checked: true,
      name: "Shopify",
      payoutPlatform: "stripe",
    });
    const { tree: tree2, seen: seen2 } = renderTree({
      selection: seen[0],
      paymentPlatforms: ["stripe", "paypal"],
    });
    findSelect(tree2, "Online store payout channel").onChange({ target: { value: "" } });
    expect(seen2[0].drivers.online_store).toEqual({ checked: true, name: "Shopify" });
  });

  it("renders the payout select only with platform options or an existing choice", () => {
    const { tree } = renderTree({
      selection: normalizeComplexitySelection({ drivers: { pos_system: { checked: true, name: "Square" } } }),
      paymentPlatforms: [],
    });
    expect(hasSelect(tree, "Point-of-sale system payout channel")).toBe(false);
    const { tree: withPlatforms } = renderTree({
      selection: normalizeComplexitySelection({ drivers: { pos_system: { checked: true, name: "Square" } } }),
      paymentPlatforms: ["stripe"],
    });
    expect(findSelect(withPlatforms, "Point-of-sale system payout channel").value).toBe("");
  });
});

describe("payout-channel hint follows pricing (payoutChannelExclusions)", () => {
  function hintShows(
    drivers: Record<string, { checked: true; name?: string; payoutPlatform?: string }>,
    paymentPlatforms: string[],
  ): boolean {
    const { html } = renderHtml({
      selection: normalizeComplexitySelection({ drivers }),
      paymentPlatforms,
    });
    return html.includes("Counted once here");
  }

  it("fires exactly when pricing counts the channel once", () => {
    const stripeChoice = { online_store: { checked: true as const, payoutPlatform: "stripe" } };
    expect(hintShows(stripeChoice, ["stripe"])).toBe(true);
    // The name alone never fires, even when it equals the platform.
    expect(hintShows({ online_store: { checked: true as const, name: "Stripe" } }, ["stripe"])).toBe(false);
    expect(hintShows({ online_store: { checked: true as const, name: "Shopify" } }, ["stripe"])).toBe(false);
    // An unlisted choice fires nothing.
    expect(hintShows(stripeChoice, ["paypal"])).toBe(false);
    expect(hintShows(stripeChoice, [])).toBe(false);
  });

  it("gives the store priority when both rows claim the same channel", () => {
    const { html } = renderHtml({
      selection: normalizeComplexitySelection({
        drivers: {
          online_store: { checked: true, name: "Shopify", payoutPlatform: "stripe" },
          pos_system: { checked: true, name: "Square", payoutPlatform: "stripe" },
        },
      }),
      paymentPlatforms: ["stripe"],
    });
    expect(html).toContain("the store driver wins");
    expect(html).not.toContain("the point-of-sale driver wins");
  });

  it("fires the pos hint for a pos-only choice", () => {
    const { html } = renderHtml({
      selection: normalizeComplexitySelection({
        drivers: { pos_system: { checked: true, name: "Square", payoutPlatform: "stripe" } },
      }),
      paymentPlatforms: ["stripe"],
    });
    expect(html).toContain("the point-of-sale driver wins");
  });
});
