import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import CompanyBundleSummary from "./CompanyBundleSummary";
import {
  DEFAULT_BUNDLE_PRICING_OPTIONS,
  priceCompanyBundle,
  toPublicCompanyBundle,
} from "@/lib/quotes/companyBundle";

const companies = [
  { id: "main", name: "Main Co", ownQboFile: true, fileStatus: "existing" as const, locationsCount: 2, propertiesCount: 0, accounts: [], complexity: null },
  { id: "beta", name: "Beta", ownQboFile: true, fileStatus: "new_file" as const, locationsCount: 0, propertiesCount: 0, accounts: [], complexity: null },
];

function priced() {
  return priceCompanyBundle({
    companies,
    packageId: "maintain",
    baseAssessment: {},
    options: DEFAULT_BUNDLE_PRICING_OPTIONS,
  });
}

describe("CompanyBundleSummary", () => {
  it("shows one row per company with the discount note, locations, setup and bundle total", () => {
    const html = renderToStaticMarkup(createElement(CompanyBundleSummary, { priced: priced() }));
    expect(html).toContain("Companies in this proposal");
    expect(html).toContain("Main Co");
    expect(html).toContain("Beta");
    expect(html).toContain("Own QuickBooks file");
    expect(html).toContain("$250.00");
    expect(html).toContain("$200.00");
    expect(html).toContain("20% bundle discount");
    expect(html).toContain("2 locations — location reporting: $50.00/mo");
    expect(html).toContain("Beta — new QuickBooks file setup: $150.00 one-time");
    expect(html).toContain("Bundle monthly total");
    expect(html).toContain("$500.00");
  });

  it("renders the public bundle payload with the same rows and totals", () => {
    const bundle = toPublicCompanyBundle(companies, priced());
    expect(bundle).not.toBeNull();
    const html = renderToStaticMarkup(createElement(CompanyBundleSummary, { publicBundle: bundle! }));
    expect(html).toContain("Main Co");
    expect(html).toContain("Beta");
    expect(html).toContain("$200.00");
    expect(html).toContain("bundle discount applied");
    expect(html).toContain("Beta — new QuickBooks file setup: $150.00 one-time");
    expect(html).toContain("$500.00");
  });

  it("flags desktop-to-online companies as priced separately without charging them", () => {
    const pricedMigration = priceCompanyBundle({
      companies: [
        companies[0],
        { id: "beta", name: "Beta", ownQboFile: true, fileStatus: "desktop_to_online" as const, locationsCount: 0, propertiesCount: 0, accounts: [], complexity: null },
      ],
      packageId: "maintain",
      baseAssessment: {},
      options: DEFAULT_BUNDLE_PRICING_OPTIONS,
    });
    const html = renderToStaticMarkup(createElement(CompanyBundleSummary, { priced: pricedMigration }));
    expect(html).toContain("Desktop → Online migration (priced separately)");
    // Empty Beta file at 20% off plus the main file and its 2 locations: 200 + 250 + 50.
    expect(html).toContain("$500.00");
  });

  it("marks location-only companies as having no QuickBooks file", () => {
    const pricedTag = priceCompanyBundle({
      companies: [
        companies[0],
        { id: "tag", name: "Downtown", ownQboFile: false, fileStatus: "existing" as const, locationsCount: 0, propertiesCount: 0, accounts: [], complexity: null },
      ],
      packageId: "maintain",
      baseAssessment: {},
      options: DEFAULT_BUNDLE_PRICING_OPTIONS,
    });
    const html = renderToStaticMarkup(createElement(CompanyBundleSummary, { priced: pricedTag }));
    expect(html).toContain("Downtown");
    expect(html).toContain("No");
    expect(html).toContain("$250.00");
  });
});
