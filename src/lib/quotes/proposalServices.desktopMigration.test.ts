import { describe, expect, it } from "vitest";
import { proposalServiceAddOns, requiredOneTimeAddOnsForTier } from "./proposalServices";

const flatMigrationOption = {
  id: "migration",
  name: "QuickBooks Desktop to Online Migration",
  description: "Move from Desktop to Online.",
  monthlyPrice: 640,
  showInProposal: true,
  archived: false,
  billingCadence: "one-time" as const,
  packageIds: ["grow", "improve", "maintain"] as const,
  required: true,
};

function assessmentWith(selection: unknown, additionalOptions: unknown[] = [flatMigrationOption]) {
  return {
    additionalOptions,
    bonuses: [],
    bonusPackageSelections: {},
    desktopMigration: selection,
  };
}

describe("spec 05 flat migration suppression", () => {
  it("suppresses the flat content-matched option when the sized migration is chosen", () => {
    const addOns = proposalServiceAddOns(
      assessmentWith({ choice: "full_history", historyYears: 2 }),
    );
    expect(addOns.find((option) => option.id === "migration")).toBeUndefined();
    // The agreement line follows the same suppression (shared add-on list).
    expect(
      requiredOneTimeAddOnsForTier(
        assessmentWith({ choice: "full_history", historyYears: 2 }),
        ["migration"],
        "maintain",
      ),
    ).toEqual([]);
  });

  it("suppresses a role-marked option even when its content differs", () => {
    const roleMarked = {
      id: "flat-fee",
      name: "Migration flat fee",
      monthlyPrice: 640,
      showInProposal: true,
      archived: false,
      billingCadence: "one-time" as const,
      packageIds: ["maintain"] as const,
      required: true,
      role: "desktop-migration" as const,
    };
    expect(
      proposalServiceAddOns(assessmentWith({ choice: "fresh_start" }, [roleMarked])),
    ).toEqual([]);
  });

  it("leaves the legacy flat $640 untouched with no selection", () => {
    for (const selection of [undefined, null, {}, { choice: null }]) {
      expect(proposalServiceAddOns(assessmentWith(selection))).toEqual([
        expect.objectContaining({ id: "migration", monthlyPrice: 640, required: true }),
      ]);
      expect(
        requiredOneTimeAddOnsForTier(assessmentWith(selection), ["migration"], "maintain"),
      ).toEqual([{ name: flatMigrationOption.name, price: 640 }]);
    }
  });

  it("keeps unrelated options while suppressing the flat one", () => {
    const other = {
      id: "other",
      name: "Other one-time",
      monthlyPrice: 50,
      showInProposal: true,
      archived: false,
      billingCadence: "one-time" as const,
      packageIds: ["maintain"] as const,
      required: true,
    };
    expect(
      proposalServiceAddOns(assessmentWith({ choice: "fresh_start" }, [flatMigrationOption, other])),
    ).toEqual([expect.objectContaining({ id: "other", monthlyPrice: 50 })]);
  });
});
