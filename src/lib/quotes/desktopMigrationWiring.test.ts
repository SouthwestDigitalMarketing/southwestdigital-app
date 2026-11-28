import { describe, expect, it } from "vitest";
import {
  countExtraDesktopFiles,
  desktopMigrationChoiceLabel,
  desktopMigrationFeeLabel,
  resolveDesktopMigrationPrice,
  withSizedMigrationFeeLines,
} from "./desktopMigrationWiring";
import { DEFAULT_DESKTOP_MIGRATION_OPTIONS } from "./desktopMigration";
import type { CompanyBundleFeeLine } from "./companyBundle";

function company(id: string, fileStatus: string) {
  return {
    id,
    name: id,
    ownQboFile: true,
    fileStatus,
    locationsCount: 0,
    propertiesCount: 0,
    accounts: [],
    complexity: null,
  };
}

describe("desktopMigrationChoiceLabel", () => {
  it("labels both choices and nothing else", () => {
    expect(desktopMigrationChoiceLabel("fresh_start")).toBe("Fresh start");
    expect(desktopMigrationChoiceLabel("full_history")).toBe("Full history");
    expect(desktopMigrationChoiceLabel(null)).toBeNull();
    expect(desktopMigrationChoiceLabel("junk")).toBeNull();
  });

  it("builds the agreement fee label", () => {
    expect(desktopMigrationFeeLabel("Fresh start")).toBe(
      "QuickBooks Desktop to Online Migration — Fresh start",
    );
  });
});

describe("countExtraDesktopFiles", () => {
  it("counts flagged companies beyond the main file", () => {
    expect(countExtraDesktopFiles([
      company("main", "desktop_to_online"),
      company("b", "desktop_to_online"),
      company("c", "existing"),
    ])).toBe(1);
  });

  it("counts every flagged company when the main file is not a Desktop file", () => {
    expect(countExtraDesktopFiles([
      company("main", "existing"),
      company("b", "desktop_to_online"),
    ])).toBe(1);
  });

  it("is zero with no bundle or no flagged files", () => {
    expect(countExtraDesktopFiles(undefined)).toBe(0);
    expect(countExtraDesktopFiles([company("main", "existing")])).toBe(0);
    expect(countExtraDesktopFiles([company("main", "desktop_to_online")])).toBe(0);
  });
});

describe("resolveDesktopMigrationPrice", () => {
  it("returns null with no choice (legacy)", () => {
    expect(resolveDesktopMigrationPrice({})).toBeNull();
    expect(resolveDesktopMigrationPrice({ desktopMigration: { choice: null } })).toBeNull();
    expect(resolveDesktopMigrationPrice({ desktopMigration: "junk" })).toBeNull();
  });

  it("prices a fresh start at the base with the default band fallback", () => {
    const priced = resolveDesktopMigrationPrice({ desktopMigration: { choice: "fresh_start" } });
    expect(priced?.choice).toBe("fresh_start");
    expect(priced?.choiceLabel).toBe("Fresh start");
    expect(priced?.total).toBe(DEFAULT_DESKTOP_MIGRATION_OPTIONS.baseAmount);
    expect(priced?.extraDesktopFiles).toBe(0);
  });

  it("prices full history with years, Spec 01 band and extra files", () => {
    const priced = resolveDesktopMigrationPrice({
      accounts: [
        { id: "a", kind: "checking", label: "Checking", status: "open", monthlyTransactions: 600, basis: "measured" },
      ],
      companies: [
        company("main", "desktop_to_online"),
        company("b", "desktop_to_online"),
      ],
      desktopMigration: { choice: "full_history", historyYears: 3 },
    });
    // Band 500-999 adds 300; one extra file adds 250; 3 years x 150.
    expect(priced?.band).toBe("500-999");
    expect(priced?.extraDesktopFiles).toBe(1);
    expect(priced?.total).toBe(640 + 3 * 150 + 300 + 250);
  });

  it("resolves overrides over template over code defaults", () => {
    const base = {
      companies: [],
      desktopMigration: { choice: "fresh_start" as const },
      desktopMigrationDefaults: { baseAmount: 700 },
    };
    expect(resolveDesktopMigrationPrice(base)?.total).toBe(700);
    expect(resolveDesktopMigrationPrice({
      ...base,
      desktopMigration: { choice: "fresh_start" as const, overrides: { baseAmount: 800 } },
    })?.total).toBe(800);
  });
});

describe("withSizedMigrationFeeLines", () => {
  const marker: CompanyBundleFeeLine = {
    companyName: "Main Co",
    kind: "migration",
    label: "Main Co — Desktop → Online migration (priced separately)",
    amount: 0,
    cadence: "one-time",
  };
  const setup: CompanyBundleFeeLine = {
    companyName: "Main Co",
    kind: "setup",
    label: "Main Co — new QuickBooks file setup",
    amount: 100,
    cadence: "one-time",
  };

  it("returns lines untouched without a sized migration", () => {
    expect(withSizedMigrationFeeLines([marker, setup], null)).toEqual([marker, setup]);
    expect(withSizedMigrationFeeLines(undefined, null)).toBeUndefined();
  });

  it("swaps markers for the single priced line", () => {
    expect(withSizedMigrationFeeLines([marker, setup], { label: "L", amount: 640 })).toEqual([
      setup,
      { companyName: "", kind: "migration", label: "L", amount: 640, cadence: "one-time" },
    ]);
  });
});
