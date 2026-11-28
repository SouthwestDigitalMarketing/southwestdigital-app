import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import ComplexityWhyList from "./ComplexityWhyList";
import type { ComplexityPublicWhy } from "@/lib/quotes/complexityDrivers";

const LINES: ComplexityPublicWhy[] = [
  {
    id: "inventory_cogs",
    label: "Inventory and cost of goods",
    why: "We track stock and cost of goods sold each month.",
    monthly: 95,
  },
  {
    id: "payroll",
    label: "Payroll",
    why: "Covered by the staffing line — we keep payroll and contractor payments reconciled each month.",
    monthly: null,
  },
];

function renderHtml(lines: ComplexityPublicWhy[] | null | undefined, tierName?: string) {
  return renderToStaticMarkup(createElement(ComplexityWhyList, { lines, tierName }));
}

describe("ComplexityWhyList", () => {
  it("renders each line with its why text and amount", () => {
    const html = renderHtml(LINES);
    expect(html).toContain("Why this price");
    expect(html).toContain("Inventory and cost of goods");
    expect(html).toContain("We track stock and cost of goods sold each month.");
    expect(html).toContain("$95/mo");
  });

  it("renders included for null-monthly lines", () => {
    const html = renderHtml(LINES);
    expect(html).toContain("Payroll");
    expect(html).toContain("included");
  });

  it("names the tier when given", () => {
    const html = renderHtml(LINES, "Maintain");
    expect(html).toContain("Why this price — Maintain");
  });

  it("renders nothing when empty (legacy unchanged)", () => {
    expect(renderHtml([])).toBe("");
    expect(renderHtml(null)).toBe("");
    expect(renderHtml(undefined)).toBe("");
  });

  it("drops junk entries instead of rendering them", () => {
    const html = renderHtml([
      ...LINES,
      { id: "bogus", label: 42, why: null, monthly: NaN } as unknown as ComplexityPublicWhy,
    ]);
    expect(html).toContain("Inventory and cost of goods");
    expect(html).not.toContain("bogus");
  });
});
