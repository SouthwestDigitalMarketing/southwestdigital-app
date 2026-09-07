import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
vi.mock("next/navigation", () => ({
  useSearchParams: () => new URLSearchParams(),
}));
vi.mock("./ProposalAppDemoHeader", () => ({ default: () => null }));
vi.mock("./OptionsTemplatesToolbar", () => ({ default: () => null }));
vi.mock("./PricingSnapshotSidebar", () => ({ default: () => null }));
const { saved } = vi.hoisted(() => ({
  saved: {
    servicesInitialized: true,
    bonuses: [
      {
        id: "active",
        name: "Active service",
        description: "Details",
        archived: false,
        defaultPackageIds: ["maintain", "grow"],
      },
      {
        id: "inactive",
        name: "Unassigned service",
        description: "Details",
        archived: false,
        defaultPackageIds: [],
      },
    ],
    additionalOptions: [],
    optionsCatalogOrder: ["active", "inactive"],
    bonusPackageSelections: {},
    packageNames: { maintain: "Maintain", improve: "Improve", grow: "Grow" },
  },
}));
vi.mock("./ProposalCreationWorkspaceDemo", () => ({
  useProposalAssessmentDemoState: () => ({
    assessment: saved,
    setAssessment: vi.fn(),
    updateAssessment: vi.fn(),
    storageReady: true,
  }),
  getProposalBonuses: () => saved.bonuses,
  getProposalAdditionalOptions: () => saved.additionalOptions,
  getOptionsCatalogOrder: () => saved.optionsCatalogOrder,
  getProposalPricingSnapshotItems: () => [],
  getProposalPricingSnapshotCleanupCard: () => null,
}));
import ProposalAddOnsDemo, { TierRangeControl } from "./ProposalAddOnsDemo";

describe("service editor rendering", () => {
  it("shows only configured services, with discoverable search and restore controls", () => {
    const html = renderToStaticMarkup(createElement(ProposalAddOnsDemo));
    expect(html).toContain("Active service");
    expect(html).not.toContain("Unassigned service");
    expect(html).toContain('aria-label="Search services"');
    expect(html).toContain("Add services");
    expect(html).toContain("Show hidden or unassigned services (1)");
    expect(html).toContain('aria-label="Add-on price for Active service"');
    expect(html).not.toContain('role="checkbox"');
  });
  it("displays saved tier gaps explicitly instead of presenting them as None or expanding them", () => {
    const html = renderToStaticMarkup(
      createElement(TierRangeControl, {
        label: "Included tiers",
        value: ["maintain", "grow"],
        names: saved.packageNames,
        onChange: vi.fn(),
      }),
    );
    expect(html).toContain('value="maintain,grow" disabled="" selected=""');
    expect(html).toContain("Custom: Maintain + Grow (saved)");
  });
  it("offers only ranges outside the included tiers", () => {
    const html = renderToStaticMarkup(
      createElement(TierRangeControl, {
        label: "Add-on tiers",
        value: ["maintain"],
        excluded: ["improve", "grow"],
        names: saved.packageNames,
        onChange: vi.fn(),
      }),
    );
    expect(html).toContain('value="maintain" selected=""');
    expect(html).not.toContain('value="improve"');
    expect(html).not.toContain('value="maintain,improve"');
  });
});
