import { describe, expect, it } from "vitest";
import {
  applyServiceConfiguration,
  readServiceConfiguration,
} from "./proposalServiceConfiguration";
import { proposalServiceAddOns } from "@/lib/quotes/proposalServices";
import type {
  ProposalAdditionalOption,
  ProposalBonus,
} from "./ProposalCreationWorkspaceDemo";

function assessment() {
  return {
    additionalOptions: [
      {
        id: "reports",
        name: "Reports",
        description: "Details",
        monthlyPrice: 65,
        showInProposal: true,
        archived: false,
        billingCadence: "one-time",
        packageIds: ["maintain", "improve", "grow"],
      },
    ] as ProposalAdditionalOption[],
    bonuses: [] as ProposalBonus[],
    bonusPackageSelections: {},
  };
}
describe("offer-specific service configuration", () => {
  it("keeps the published service order when editing an existing included row", () => {
    const saved = { ...assessment(), bonuses: [
      { id: "first", name: "First", description: "", archived: false },
      { id: "last", name: "Last", description: "", archived: false },
    ] };
    const config = readServiceConfiguration(saved, { id: "first", bonus: saved.bonuses[0] });
    expect(applyServiceConfiguration(saved, "first", config).bonuses.map((item) => item.id)).toEqual(["first", "last"]);
  });
  it("opens a paid service without changing its saved data", () => {
    const saved = assessment();
    const before = JSON.stringify(saved);
    expect(
      readServiceConfiguration(saved, {
        id: "reports",
        option: saved.additionalOptions[0],
      }),
    ).toMatchObject({
      included: [],
      optional: ["maintain", "improve", "grow"],
      price: 65,
      cadence: "one-time",
    });
    expect(JSON.stringify(saved)).toBe(before);
  });
  it("applies hybrid availability atomically and exposes only the paid lower tier", () => {
    const saved = assessment();
    const config = readServiceConfiguration(saved, {
      id: "reports",
      option: saved.additionalOptions[0],
    });
    const next = applyServiceConfiguration(saved, "reports", {
      ...config,
      included: ["improve", "grow"],
      optional: ["maintain", "improve"],
    });
    expect(next.additionalOptions).toEqual([]);
    expect(next.bonusPackageSelections).toEqual({
      reports: ["improve", "grow"],
    });
    expect(proposalServiceAddOns(next)).toEqual([
      expect.objectContaining({
        monthlyPrice: 65,
        billingCadence: "one-time",
        packageIds: ["maintain"],
      }),
    ]);
    expect(saved.additionalOptions).toHaveLength(1);
  });
  it("preserves saved gaps and exact cadence when applying an unchanged configuration", () => {
    const saved = {
      ...assessment(),
      additionalOptions: [],
      bonuses: [
        {
          id: "support",
          name: "Support",
          description: "",
          archived: false,
          defaultPackageIds: ["maintain", "grow"],
        },
      ] as ProposalBonus[],
    };
    const config = readServiceConfiguration(saved, {
      id: "support",
      bonus: saved.bonuses[0],
    });
    const next = applyServiceConfiguration(saved, "support", config);
    expect(next.bonusPackageSelections).toEqual({
      support: ["maintain", "grow"],
    });
    expect(next.bonuses[0].billingCadence).toBe("one-time");
  });
  it("allows an included service to become optional everywhere without a treatment toggle", () => {
    const saved = {
      ...assessment(),
      additionalOptions: [],
      bonuses: [
        {
          id: "support",
          name: "Support",
          description: "",
          archived: false,
          defaultPackageIds: ["grow"],
        },
      ] as ProposalBonus[],
    };
    const config = readServiceConfiguration(saved, {
      id: "support",
      bonus: saved.bonuses[0],
    });
    const next = applyServiceConfiguration(saved, "support", {
      ...config,
      included: [],
      optional: ["maintain", "improve", "grow"],
      price: 150,
      cadence: "monthly",
    });
    expect(proposalServiceAddOns(next)).toEqual([
      expect.objectContaining({
        monthlyPrice: 150,
        billingCadence: "monthly",
        packageIds: ["maintain", "improve", "grow"],
      }),
    ]);
  });
  it("retains availability and price while hiding and restoring a service", () => {
    const saved = assessment();
    const config = readServiceConfiguration(saved, {
      id: "reports",
      option: saved.additionalOptions[0],
    });
    const hidden = applyServiceConfiguration(saved, "reports", {
      ...config,
      visible: false,
    });
    expect(proposalServiceAddOns(hidden)).toEqual([]);
    const restored = applyServiceConfiguration(hidden, "reports", {
      ...config,
      visible: true,
    });
    expect(proposalServiceAddOns(restored)).toEqual(
      proposalServiceAddOns(saved),
    );
  });
  it.each([-1, NaN, Infinity])("rejects invalid pricing: %s", (price) => {
    const saved = assessment();
    const config = readServiceConfiguration(saved, {
      id: "reports",
      option: saved.additionalOptions[0],
    });
    expect(() =>
      applyServiceConfiguration(saved, "reports", { ...config, price }),
    ).toThrow();
  });
});
