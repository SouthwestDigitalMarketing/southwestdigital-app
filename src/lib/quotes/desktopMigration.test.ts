import { describe, expect, it } from "vitest";
import {
  DEFAULT_DESKTOP_MIGRATION_OPTIONS,
  findSuppressedFlatMigrationOptions,
  hasDesktopMigrationSelection,
  isFlatDesktopMigrationOption,
  normalizeDesktopMigrationSelection,
  priceDesktopMigration,
  resolveDesktopMigrationOptions,
  sanitizeDesktopMigrationDefaults,
  toPublicDesktopMigration,
} from "./desktopMigration";

const FLAT_OPTION = {
  id: "migration",
  name: "QuickBooks Desktop to Online Migration",
  description: "",
  monthlyPrice: 640,
  showInProposal: true,
  archived: false,
  billingCadence: "one-time",
  packageIds: ["grow", "improve", "maintain"],
  required: true,
};

describe("normalizeDesktopMigrationSelection", () => {
  it("accepts both choices and drops junk", () => {
    expect(normalizeDesktopMigrationSelection({ choice: "fresh_start" })).toEqual({
      choice: "fresh_start",
    });
    expect(
      normalizeDesktopMigrationSelection({
        choice: "full_history",
        historyYears: 3,
        payrollHistory: true,
        inventory: true,
        openJobs: true,
        overrides: { baseAmount: 700 },
      }),
    ).toEqual({
      choice: "full_history",
      historyYears: 3,
      payrollHistory: true,
      inventory: true,
      openJobs: true,
      overrides: { baseAmount: 700 },
    });
  });

  it("normalizes junk to no choice and sanitizes overrides", () => {
    expect(normalizeDesktopMigrationSelection(null)).toEqual({ choice: null });
    expect(normalizeDesktopMigrationSelection("full_history")).toEqual({ choice: null });
    expect(normalizeDesktopMigrationSelection({ choice: "sized" })).toEqual({ choice: null });
    expect(
      normalizeDesktopMigrationSelection({
        choice: "full_history",
        historyYears: -2,
        payrollHistory: "yes",
        overrides: { baseAmount: Number.NaN, historyPerYear: 100 },
      }),
    ).toEqual({ choice: "full_history", overrides: { historyPerYear: 100 } });
    // Empty overrides stay out of the snapshot.
    expect(normalizeDesktopMigrationSelection({ choice: "fresh_start", overrides: {} })).toEqual({
      choice: "fresh_start",
    });
  });
});

describe("resolveDesktopMigrationOptions", () => {
  it("resolves the code defaults with no inputs", () => {
    expect(resolveDesktopMigrationOptions({})).toEqual(DEFAULT_DESKTOP_MIGRATION_OPTIONS);
  });

  it("resolves override, then template, then code defaults field by field", () => {
    expect(
      resolveDesktopMigrationOptions({
        override: { baseAmount: 700 },
        template: { baseAmount: 650, historyPerYear: 100 },
      }),
    ).toEqual({ ...DEFAULT_DESKTOP_MIGRATION_OPTIONS, baseAmount: 700, historyPerYear: 100 });
  });

  it("floors money at zero and truncates the year cap", () => {
    expect(
      resolveDesktopMigrationOptions({ override: { baseAmount: -5, historyYearCap: 2.9 } }),
    ).toMatchObject({ baseAmount: 640, historyYearCap: 2 });
  });
});

describe("priceDesktopMigration", () => {
  it("prices a fresh start at the flat base plus the included tie-out", () => {
    const priced = priceDesktopMigration({ selection: { choice: "fresh_start" } });
    expect(priced.total).toBe(640);
    expect(priced.lines).toEqual([
      { id: "base", label: "Desktop migration — fresh start", amount: 640, kind: "base" },
      { id: "trial-balance-tie-out", label: "Trial-balance tie-out (included)", amount: 0, kind: "included" },
    ]);
  });

  it("prices full history with per-year math and the band add", () => {
    const priced = priceDesktopMigration({
      selection: { choice: "full_history", historyYears: 3 },
      band: "100-499",
    });
    // 640 base + 3 x 150 history + 150 volume.
    expect(priced.total).toBe(640 + 450 + 150);
    expect(priced.lines.map((line) => line.kind)).toEqual([
      "base",
      "history",
      "volume",
      "included",
    ]);
  });

  it("caps billable history years at the year cap", () => {
    const priced = priceDesktopMigration({
      selection: { choice: "full_history", historyYears: 20 },
      band: "1000+",
    });
    // 640 base + 5 x 150 capped history + 500 volume.
    expect(priced.total).toBe(640 + 750 + 500);
    expect(priced.lines.find((line) => line.kind === "history")?.label).toContain("5 years");
  });

  it.each([
    ["0-99", 0],
    ["100-499", 150],
    ["500-999", 300],
    ["1000+", 500],
  ])("adds the %s band volume add", (band, add) => {
    const priced = priceDesktopMigration({
      selection: { choice: "full_history", historyYears: 0 },
      band,
    });
    const volume = priced.lines.find((line) => line.kind === "volume");
    if (add === 0) {
      expect(volume).toBeUndefined();
      expect(priced.total).toBe(640);
    } else {
      expect(volume?.amount).toBe(add);
      expect(priced.total).toBe(640 + add);
    }
  });

  it("falls back to the smallest-volume add with no band signal", () => {
    for (const band of [undefined, null, "", "unknown", "nonsense", 42]) {
      const priced = priceDesktopMigration({
        selection: { choice: "full_history", historyYears: 1 },
        band,
      });
      // 640 base + 1 x 150 history + 0 fallback volume (line omitted).
      expect(priced.total).toBe(790);
      expect(priced.lines.some((line) => line.kind === "volume")).toBe(false);
    }
  });

  it("prices ticked add-ons on either choice", () => {
    const full = priceDesktopMigration({
      selection: { choice: "full_history", payrollHistory: true, inventory: true, openJobs: true },
      band: "0-99",
    });
    // 640 base + 150 payroll + 200 inventory + 150 open jobs.
    expect(full.total).toBe(640 + 150 + 200 + 150);
    expect(full.lines.filter((line) => line.kind === "addon")).toHaveLength(3);
    const fresh = priceDesktopMigration({
      selection: { choice: "fresh_start", inventory: true },
    });
    expect(fresh.total).toBe(640 + 200);
  });

  it("charges each additional Desktop file beyond the main file", () => {
    const priced = priceDesktopMigration({
      selection: { choice: "fresh_start" },
      extraDesktopFiles: 2,
    });
    expect(priced.total).toBe(640 + 500);
    expect(priced.lines.find((line) => line.kind === "extra_file")).toEqual({
      id: "extra-files",
      label: "2 additional Desktop files × $250",
      amount: 500,
      kind: "extra_file",
    });
    expect(
      priceDesktopMigration({ selection: { choice: "fresh_start" }, extraDesktopFiles: 0 }).total,
    ).toBe(640);
  });

  it("honors per-proposal overrides and template defaults", () => {
    const overridden = priceDesktopMigration({
      selection: { choice: "fresh_start", overrides: { baseAmount: 700 } },
    });
    expect(overridden.total).toBe(700);
    const templated = priceDesktopMigration({
      selection: { choice: "fresh_start" },
      options: { template: { baseAmount: 600 } },
    });
    expect(templated.total).toBe(600);
    const full = priceDesktopMigration({
      selection: { choice: "fresh_start", overrides: { baseAmount: 1 } },
      options: { baseAmount: 600, historyPerYear: 150 },
    });
    expect(full.total).toBe(1);
  });

  it("prices nothing with no choice (legacy proposals)", () => {
    expect(priceDesktopMigration({ selection: null })).toEqual({ lines: [], total: 0 });
    expect(priceDesktopMigration({ selection: {} })).toEqual({ lines: [], total: 0 });
    expect(hasDesktopMigrationSelection({ choice: "full_history" })).toBe(true);
    expect(hasDesktopMigrationSelection({})).toBe(false);
  });
});

describe("isFlatDesktopMigrationOption", () => {
  it("matches the flat option by content", () => {
    expect(isFlatDesktopMigrationOption(FLAT_OPTION)).toBe(true);
    expect(
      isFlatDesktopMigrationOption({ ...FLAT_OPTION, name: "  QuickBooks DESKTOP to ONLINE migration " }),
    ).toBe(true);
  });

  it("rejects near misses on content", () => {
    expect(isFlatDesktopMigrationOption({ ...FLAT_OPTION, required: false })).toBe(false);
    expect(isFlatDesktopMigrationOption({ ...FLAT_OPTION, billingCadence: "monthly" })).toBe(false);
    expect(isFlatDesktopMigrationOption({ ...FLAT_OPTION, name: "Desktop Setup" })).toBe(false);
    expect(isFlatDesktopMigrationOption(null)).toBe(false);
  });

  it("matches by staff role even when the content differs", () => {
    expect(
      isFlatDesktopMigrationOption({ id: "x", name: "Something else", role: "desktop-migration" }),
    ).toBe(true);
    expect(
      isFlatDesktopMigrationOption({ ...FLAT_OPTION, role: "something-else" }),
    ).toBe(true);
  });
});

describe("findSuppressedFlatMigrationOptions", () => {
  it("suppresses the flat option with a note when the sized migration is chosen", () => {
    const result = findSuppressedFlatMigrationOptions(
      [FLAT_OPTION, { id: "other", name: "Other" }],
      { choice: "full_history", historyYears: 2 },
    );
    expect(result.suppressedIds).toEqual(["migration"]);
    expect(result.note).toContain("QuickBooks Desktop to Online Migration");
    expect(result.note).toContain("sized Desktop migration");
  });

  it("suppresses a role-marked option and never stacks", () => {
    const roleMarked = { id: "flat", name: "Migration flat fee", role: "desktop-migration" };
    const result = findSuppressedFlatMigrationOptions([roleMarked, roleMarked], {
      choice: "fresh_start",
    });
    expect(result.suppressedIds).toEqual(["flat"]);
  });

  it("suppresses and prices nothing for legacy proposals (no selection)", () => {
    for (const selection of [null, {}, { choice: null }]) {
      expect(findSuppressedFlatMigrationOptions([FLAT_OPTION], selection)).toEqual({
        suppressedIds: [],
        note: "",
      });
    }
  });

  it("names nothing when no flat option is present", () => {
    expect(
      findSuppressedFlatMigrationOptions([{ id: "other", name: "Other" }], {
        choice: "fresh_start",
      }),
    ).toEqual({ suppressedIds: [], note: "" });
  });
});

describe("toPublicDesktopMigration", () => {
  it("whitelists labels and amounts only", () => {
    const priced = priceDesktopMigration({
      selection: { choice: "full_history", historyYears: 1 },
      band: "100-499",
    });
    expect(toPublicDesktopMigration(priced)).toEqual({
      lines: priced.lines.map(({ label, amount }) => ({ label, amount })),
      total: priced.total,
    });
    expect(toPublicDesktopMigration(priced)?.lines[0]).not.toHaveProperty("kind");
    expect(toPublicDesktopMigration(priced)?.lines[0]).not.toHaveProperty("id");
  });

  it("returns null for junk", () => {
    expect(toPublicDesktopMigration(null)).toBeNull();
    expect(toPublicDesktopMigration({ lines: [{ label: "x" }], total: 1 })).toBeNull();
  });
});

describe("sanitizeDesktopMigrationDefaults", () => {
  it("keeps finite non-negative fields and drops the rest", () => {
    expect(
      sanitizeDesktopMigrationDefaults({
        baseAmount: 700,
        historyPerYear: -5,
        historyYearCap: 3.7,
        bandAdd0to99: Number.NaN,
        extraFileAdd: 250,
        unknown: 1,
      }),
    ).toEqual({ baseAmount: 700, historyYearCap: 3, extraFileAdd: 250 });
    expect(sanitizeDesktopMigrationDefaults(null)).toEqual({});
  });
});
