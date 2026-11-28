import { describe, expect, it } from "vitest";
import {
  complexityDriverDefs,
  complexityGrowMonthlyTotal,
  DEFAULT_COMPLEXITY_DRIVER_DEFAULTS,
  hasComplexitySelection,
  normalizeComplexitySelection,
  priceComplexityDrivers,
  resolveComplexityDriverDefaults,
  sanitizeComplexityDriverDefaults,
  toPublicComplexityWhy,
  type ComplexityDriverId,
  type ComplexitySelection,
  type ComplexityValue,
} from "./complexityDrivers";

function checked(id: ComplexityDriverId, extra: object = {}): ComplexitySelection {
  const drivers = normalizeComplexitySelection({}).drivers;
  return { drivers: { ...drivers, [id]: { checked: true, ...extra } as ComplexityValue } };
}

function checkedMany(ids: ComplexityDriverId[]): ComplexitySelection {
  const drivers = normalizeComplexitySelection({}).drivers;
  for (const id of ids) drivers[id] = { checked: true };
  return { drivers };
}

describe("complexityDriverDefs", () => {
  it("exposes all ten drivers in checklist order", () => {
    const defs = complexityDriverDefs();
    expect(defs.map((d) => d.id)).toEqual([
      "payroll",
      "sales_tax",
      "job_tracking",
      "mixed_books",
      "inventory_cogs",
      "pos_system",
      "online_store",
      "loans_mca",
      "personal_commingling",
      "filing_1099",
    ]);
    for (const def of defs) {
      expect(def.label.length).toBeGreaterThan(0);
      expect(def.clientWhy.length).toBeGreaterThan(0);
    }
  });

  it("maps the four existing drivers to their current lines", () => {
    const byId = Object.fromEntries(complexityDriverDefs().map((d) => [d.id, d]));
    expect(byId.payroll.mapsToExisting).toBe("staffing");
    expect(byId.sales_tax.mapsToExisting).toBe("salesTaxAddon");
    expect(byId.job_tracking.mapsToExisting).toBe("projectTrackingAddon");
    expect(byId.mixed_books.mapsToExisting).toBe("mixedBooks");
    for (const id of ["inventory_cogs", "pos_system", "online_store", "loans_mca", "personal_commingling", "filing_1099"] as const) {
      expect(byId[id].mapsToExisting).toBeNull();
    }
  });

  it("ships the maintain-tier code defaults", () => {
    expect(DEFAULT_COMPLEXITY_DRIVER_DEFAULTS.inventory_cogs).toEqual({ monthly: 95, cleanupPerMonth: 0 });
    expect(DEFAULT_COMPLEXITY_DRIVER_DEFAULTS.pos_system).toEqual({ monthly: 55, cleanupPerMonth: 0 });
    expect(DEFAULT_COMPLEXITY_DRIVER_DEFAULTS.online_store).toEqual({ monthly: 55, cleanupPerMonth: 0 });
    expect(DEFAULT_COMPLEXITY_DRIVER_DEFAULTS.loans_mca).toEqual({ monthly: 75, cleanupPerMonth: 25 });
    expect(DEFAULT_COMPLEXITY_DRIVER_DEFAULTS.personal_commingling).toEqual({ monthly: 110, cleanupPerMonth: 40 });
    expect(DEFAULT_COMPLEXITY_DRIVER_DEFAULTS.filing_1099).toEqual({ monthly: 8, cleanupPerMonth: 0, cap: 160 });
    const byId = Object.fromEntries(complexityDriverDefs().map((d) => [d.id, d]));
    expect(byId.inventory_cogs.defaultMonthly).toBe(95);
    expect(byId.loans_mca.cleanupPerMonthAdd).toBe(25);
    expect(byId.filing_1099.defaultMonthly).toBe(8);
    expect(byId.filing_1099.perPayeeCap).toBe(160);
    expect(byId.inventory_cogs.perPayeeCap).toBeUndefined();
  });

  it("applies a sparse defaults patch per field", () => {
    const defs = complexityDriverDefs({ inventory_cogs: { monthly: 100 } });
    const byId = Object.fromEntries(defs.map((d) => [d.id, d]));
    expect(byId.inventory_cogs.defaultMonthly).toBe(100);
    expect(byId.inventory_cogs.cleanupPerMonthAdd).toBe(0);
    expect(byId.pos_system.defaultMonthly).toBe(55);
  });
});

describe("priceComplexityDrivers tiers", () => {
  it("charges maintain defaults as-is", () => {
    const result = priceComplexityDrivers(
      checkedMany(["inventory_cogs", "pos_system", "online_store", "loans_mca", "personal_commingling"]),
      { packageId: "maintain", cleanupMonths: 0 },
    );
    expect(result.monthlyTotal).toBe(95 + 55 + 55 + 75 + 110);
  });

  it("scales improve by the complex-ops ratio (x1.25), ceil $5", () => {
    const result = priceComplexityDrivers(checked("inventory_cogs"), {
      packageId: "improve",
      cleanupMonths: 0,
    });
    expect(result.lines[0].monthly).toBe(120); // 95 x 1.25 = 118.75 -> 120
    const pos = priceComplexityDrivers(checked("pos_system"), { packageId: "improve", cleanupMonths: 0 });
    expect(pos.lines[0].monthly).toBe(70); // 55 x 1.25 = 68.75 -> 70
  });

  it("derives grow from maintain x 1.5 like applyGrowPriceOverride, ceil $5", () => {
    const result = priceComplexityDrivers(checked("inventory_cogs"), {
      packageId: "grow",
      cleanupMonths: 0,
    });
    expect(result.lines[0].monthly).toBe(145); // ceil5(95 x 1.5) = 145
    const commingling = priceComplexityDrivers(checked("personal_commingling"), {
      packageId: "grow",
      cleanupMonths: 0,
    });
    expect(commingling.lines[0].monthly).toBe(165); // ceil5(110 x 1.5) = 165
  });

  it("matches the pipeline grow total for a single line", () => {
    const maintain = priceComplexityDrivers(checked("inventory_cogs"), {
      packageId: "maintain",
      cleanupMonths: 0,
    });
    const grow = priceComplexityDrivers(checked("inventory_cogs"), {
      packageId: "grow",
      cleanupMonths: 0,
    });
    expect(grow.lines[0].monthly).toBe(complexityGrowMonthlyTotal(maintain.monthlyTotal));
  });

  it("rebalances multi-line grow lines to sum exactly to the pipeline total", () => {
    const ids = ["inventory_cogs", "pos_system", "online_store", "loans_mca", "personal_commingling"] as const;
    const maintain = priceComplexityDrivers(checkedMany([...ids]), {
      packageId: "maintain",
      cleanupMonths: 0,
    });
    expect(maintain.monthlyTotal).toBe(390);
    const grow = priceComplexityDrivers(checkedMany([...ids]), {
      packageId: "grow",
      cleanupMonths: 0,
    });
    const pipelineTotal = complexityGrowMonthlyTotal(maintain.monthlyTotal);
    expect(pipelineTotal).toBe(585); // ceil5(390 x 1.5)
    // Per-line ceils sum to 595 (145 + 85 + 85 + 115 + 165); the $10
    // rounding remainder sits on the largest line (commingling 165 -> 155).
    expect(grow.monthlyTotal).toBe(585);
    expect(grow.lines.map((line) => line.monthly).reduce((a, b) => a + b, 0)).toBe(585);
    expect(grow.lines.find((line) => line.id === "personal_commingling")?.monthly).toBe(155);
    expect(grow.lines.find((line) => line.id === "inventory_cogs")?.monthly).toBe(145);
  });

  it("prices the review basket grow figures (730 monthly, 585 cleanup)", () => {
    // Brief basket: inventory, POS Lightspeed, store Shopify, loans x2,
    // commingling, 1099 x12, sales tax ticked, 6 cleanup months.
    const selection = normalizeComplexitySelection({
      drivers: {
        inventory_cogs: { checked: true },
        pos_system: { checked: true, name: "Lightspeed" },
        online_store: { checked: true, name: "Shopify" },
        loans_mca: { checked: true, count: 2 },
        personal_commingling: { checked: true },
        filing_1099: { checked: true, count: 12 },
        sales_tax: { checked: true },
      },
    });
    const maintain = priceComplexityDrivers(selection, {
      packageId: "maintain",
      cleanupMonths: 6,
      existing: { salesTaxAddon: true },
    });
    // 95 + 55 + 55 + 75 + 110 + 96 (12 x $8); sales tax is included ($0).
    expect(maintain.monthlyTotal).toBe(486);
    expect(maintain.cleanupPerMonthTotal).toBe(65);
    expect(maintain.cleanupTotal).toBe(390);
    const grow = priceComplexityDrivers(selection, {
      packageId: "grow",
      cleanupMonths: 6,
      existing: { salesTaxAddon: true },
    });
    // Charged rule: ceil5(486 x 1.5) = 730; lines sum to it.
    expect(grow.monthlyTotal).toBe(730);
    expect(grow.lines.map((line) => line.monthly).reduce((a, b) => a + b, 0)).toBe(730);
    expect(grow.monthlyTotal).toBe(complexityGrowMonthlyTotal(maintain.monthlyTotal));
    // Cleanup follows the total-level rule ceil5(390 x 1.5) = 585.
    expect(grow.cleanupTotal).toBe(585);
  });

  it("complexityGrowMonthlyTotal follows ceil5(maintain x 1.5)", () => {
    expect(complexityGrowMonthlyTotal(390)).toBe(585);
    expect(complexityGrowMonthlyTotal(95)).toBe(145);
    expect(complexityGrowMonthlyTotal(0)).toBe(0);
    expect(complexityGrowMonthlyTotal(NaN)).toBe(0);
  });

  it("falls back to maintain for an unknown package", () => {
    const result = priceComplexityDrivers(checked("inventory_cogs"), {
      packageId: "nope",
      cleanupMonths: 0,
    });
    expect(result.lines[0].monthly).toBe(95);
  });
});

describe("priceComplexityDrivers no-double-charge", () => {
  it("emits $0 included lines for the existing drivers", () => {
    const result = priceComplexityDrivers(
      checkedMany(["payroll", "sales_tax", "job_tracking", "mixed_books"]),
      { packageId: "maintain", cleanupMonths: 0 },
    );
    expect(result.lines).toHaveLength(4);
    expect(result.monthlyTotal).toBe(0);
    for (const line of result.lines) {
      expect(line.monthly).toBe(0);
      expect(line.includedNote).toMatch(/^Included in /);
    }
    expect(result.lines[0].includedNote).toBe("Included in staffing line");
    expect(result.lines[1].includedNote).toBe("Included in Sales Tax Filing & Remittance");
    expect(result.lines[2].includedNote).toBe("Included in Project Tracking");
    expect(result.lines[3].includedNote).toBe("Included in books type adjustment");
  });

  it("ignores a monthlyOverride on an existing driver", () => {
    const result = priceComplexityDrivers(checked("payroll", { monthlyOverride: 500 }), {
      packageId: "maintain",
      cleanupMonths: 0,
    });
    expect(result.lines[0].monthly).toBe(0);
    expect(result.monthlyTotal).toBe(0);
  });

  it("marks the missing line when the existing line is absent", () => {
    const result = priceComplexityDrivers(
      checkedMany(["sales_tax", "job_tracking", "mixed_books", "payroll"]),
      {
        packageId: "maintain",
        cleanupMonths: 0,
        existing: {
          salesTaxAddon: false,
          projectTrackingAddon: false,
          mixedBooks: false,
          staffingHeadcount: 0,
        },
      },
    );
    expect(result.lines).toHaveLength(4);
    expect(result.monthlyTotal).toBe(0);
    const byId = Object.fromEntries(result.lines.map((line) => [line.id, line]));
    expect(byId.sales_tax.requiresExistingLine).toBe("salesTaxAddon");
    expect(byId.job_tracking.requiresExistingLine).toBe("projectTrackingAddon");
    expect(byId.mixed_books.requiresExistingLine).toBe("mixedBooks");
    expect(byId.payroll.requiresExistingLine).toBe("staffing");
    for (const line of result.lines) {
      expect(line.monthly).toBe(0);
      expect(line.includedNote).toBeUndefined();
    }
  });

  it("keeps the Included note when the existing line is present", () => {
    const result = priceComplexityDrivers(
      checkedMany(["sales_tax", "job_tracking", "mixed_books", "payroll"]),
      {
        packageId: "maintain",
        cleanupMonths: 0,
        existing: {
          salesTaxAddon: true,
          projectTrackingAddon: true,
          mixedBooks: true,
          staffingHeadcount: 3,
        },
      },
    );
    for (const line of result.lines) {
      expect(line.monthly).toBe(0);
      expect(line.includedNote).toMatch(/^Included in /);
      expect(line.requiresExistingLine).toBeUndefined();
    }
  });

  it("treats a string headcount as a headcount", () => {
    const zero = priceComplexityDrivers(checked("payroll"), {
      packageId: "maintain",
      cleanupMonths: 0,
      existing: {
        salesTaxAddon: true,
        projectTrackingAddon: true,
        mixedBooks: true,
        staffingHeadcount: "0",
      },
    });
    expect(zero.lines[0].requiresExistingLine).toBe("staffing");
  });

  it("emits nothing for unchecked drivers", () => {
    const result = priceComplexityDrivers(normalizeComplexitySelection({}), {
      packageId: "maintain",
      cleanupMonths: 0,
    });
    expect(result.lines).toEqual([]);
    expect(result.monthlyTotal).toBe(0);
    expect(result.cleanupPerMonthTotal).toBe(0);
    expect(result.cleanupTotal).toBe(0);
  });
});

describe("priceComplexityDrivers overrides and counts", () => {
  it("honors a per-proposal monthlyOverride exactly", () => {
    const result = priceComplexityDrivers(checked("inventory_cogs", { monthlyOverride: 97 }), {
      packageId: "grow",
      cleanupMonths: 0,
    });
    expect(result.lines[0].monthly).toBe(97);
  });

  it("ignores an override on an unchecked driver", () => {
    const result = priceComplexityDrivers(normalizeComplexitySelection({}), {
      packageId: "maintain",
      cleanupMonths: 0,
    });
    expect(result.lines).toEqual([]);
  });

  it("prices filing_1099 per payee", () => {
    const result = priceComplexityDrivers(checked("filing_1099", { count: 10 }), {
      packageId: "maintain",
      cleanupMonths: 0,
    });
    expect(result.lines[0].monthly).toBe(80);
  });

  it("caps filing_1099 at the tier-scaled cap", () => {
    const maintain = priceComplexityDrivers(checked("filing_1099", { count: 100 }), {
      packageId: "maintain",
      cleanupMonths: 0,
    });
    expect(maintain.lines[0].monthly).toBe(160);
    const improve = priceComplexityDrivers(checked("filing_1099", { count: 100 }), {
      packageId: "improve",
      cleanupMonths: 0,
    });
    expect(improve.lines[0].monthly).toBe(200); // 10/payee x 100, capped at 160 x 1.25
    const grow = priceComplexityDrivers(checked("filing_1099", { count: 100 }), {
      packageId: "grow",
      cleanupMonths: 0,
    });
    expect(grow.lines[0].monthly).toBe(240); // ceil5(maintain 160 x 1.5)
  });

  it("never rebalances exact overrides: the lines win in an override-only basket", () => {
    const result = priceComplexityDrivers(
      normalizeComplexitySelection({
        drivers: {
          inventory_cogs: { checked: true, monthlyOverride: 100 },
          pos_system: { checked: true, monthlyOverride: 50 },
        },
      }),
      { packageId: "grow", cleanupMonths: 0 },
    );
    expect(result.lines.map((line) => line.monthly)).toEqual([100, 50]);
    expect(result.monthlyTotal).toBe(150);
  });

  it("derives grow 1099 from the maintain monthly", () => {
    const maintain = priceComplexityDrivers(checked("filing_1099", { count: 10 }), {
      packageId: "maintain",
      cleanupMonths: 0,
    });
    expect(maintain.lines[0].monthly).toBe(80);
    const grow = priceComplexityDrivers(checked("filing_1099", { count: 10 }), {
      packageId: "grow",
      cleanupMonths: 0,
    });
    expect(grow.lines[0].monthly).toBe(complexityGrowMonthlyTotal(80)); // 120
  });

  it("emits no line for 1099 with no payee count", () => {
    for (const extra of [{}, { count: 0 }]) {
      const result = priceComplexityDrivers(checked("filing_1099", extra), {
        packageId: "maintain",
        cleanupMonths: 0,
      });
      expect(result.lines).toEqual([]);
      expect(result.monthlyTotal).toBe(0);
    }
  });

  it("emits an exact override line for 1099 even without a payee count", () => {
    const result = priceComplexityDrivers(checked("filing_1099", { monthlyOverride: 100 }), {
      packageId: "maintain",
      cleanupMonths: 0,
    });
    expect(result.lines).toHaveLength(1);
    expect(result.lines[0].monthly).toBe(100);
  });

  it("treats a monthlyOverride as exact, bypassing the 1099 cap and tier scaling", () => {
    const result = priceComplexityDrivers(checked("filing_1099", { count: 100, monthlyOverride: 5000 }), {
      packageId: "grow",
      cleanupMonths: 0,
    });
    expect(result.lines[0].monthly).toBe(5000);
  });

  it("does not scale loans_mca by its count", () => {
    const result = priceComplexityDrivers(checked("loans_mca", { count: 5 }), {
      packageId: "maintain",
      cleanupMonths: 0,
    });
    expect(result.lines[0].monthly).toBe(75);
  });
});

describe("priceComplexityDrivers cleanup", () => {
  it("adds nothing when cleanupMonths is 0", () => {
    const result = priceComplexityDrivers(
      checkedMany(["loans_mca", "personal_commingling"]),
      { packageId: "maintain", cleanupMonths: 0 },
    );
    expect(result.cleanupPerMonthTotal).toBe(0);
    expect(result.cleanupTotal).toBe(0);
    expect(result.lines.every((line) => line.cleanupPerMonth === 0)).toBe(true);
  });

  it("adds per-cleanup-month for loans and commingling only", () => {
    const result = priceComplexityDrivers(
      checkedMany(["loans_mca", "personal_commingling", "inventory_cogs", "payroll"]),
      { packageId: "maintain", cleanupMonths: 3 },
    );
    const byId = Object.fromEntries(result.lines.map((line) => [line.id, line]));
    expect(byId.loans_mca.cleanupPerMonth).toBe(25);
    expect(byId.personal_commingling.cleanupPerMonth).toBe(40);
    expect(byId.inventory_cogs.cleanupPerMonth).toBe(0);
    expect(byId.payroll.cleanupPerMonth).toBe(0);
    expect(result.cleanupPerMonthTotal).toBe(65);
    expect(result.cleanupTotal).toBe(195);
  });

  it("scales the cleanup add by tier", () => {
    const result = priceComplexityDrivers(checked("loans_mca"), {
      packageId: "improve",
      cleanupMonths: 2,
    });
    expect(result.lines[0].cleanupPerMonth).toBe(35); // 25 x 1.25 = 31.25 -> 35
    expect(result.cleanupTotal).toBe(70);
  });

  it("derives the grow cleanup total from maintain x 1.5 at the total level", () => {
    const result = priceComplexityDrivers(checked("loans_mca"), {
      packageId: "grow",
      cleanupMonths: 2,
    });
    // Per-month display rate stays per-line ceiled; the charged total is
    // the total-level rule ceil5(50 x 1.5) = 75.
    expect(result.lines[0].cleanupPerMonth).toBe(40); // ceil5(25 x 1.5)
    expect(result.cleanupTotal).toBe(75);
  });
});

describe("normalizeComplexitySelection", () => {
  it("normalizes junk to all-unchecked", () => {
    for (const raw of [null, undefined, 42, "x", [], { drivers: null }]) {
      const selection = normalizeComplexitySelection(raw);
      expect(Object.values(selection.drivers).every((v) => v.checked === false)).toBe(true);
    }
  });

  it("coerces numeric strings for count and monthlyOverride", () => {
    const selection = normalizeComplexitySelection({
      drivers: {
        filing_1099: { checked: true, count: "12", monthlyOverride: "100" },
      },
    });
    expect(selection.drivers.filing_1099).toEqual({ checked: true, count: 12, monthlyOverride: 100 });
    const priced = priceComplexityDrivers(selection, {
      packageId: "maintain",
      cleanupMonths: 0,
    });
    expect(priced.lines).toHaveLength(1);
    expect(priced.lines[0].monthly).toBe(100);
  });

  it("drops non-numeric override strings", () => {
    const selection = normalizeComplexitySelection({
      drivers: {
        inventory_cogs: { checked: true, monthlyOverride: "lots" },
      },
    });
    expect(selection.drivers.inventory_cogs).toEqual({ checked: true });
  });

  it("keeps checked drivers with name, count, and override", () => {
    const selection = normalizeComplexitySelection({
      drivers: {
        pos_system: { checked: true, name: "  Lightspeed  " },
        filing_1099: { checked: true, count: 12 },
        inventory_cogs: { checked: true, monthlyOverride: 100 },
      },
    });
    expect(selection.drivers.pos_system).toEqual({ checked: true, name: "Lightspeed" });
    expect(selection.drivers.filing_1099).toEqual({ checked: true, count: 12 });
    expect(selection.drivers.inventory_cogs).toEqual({ checked: true, monthlyOverride: 100 });
    expect(selection.drivers.payroll).toEqual({ checked: false });
  });

  it("keeps an explicit payoutPlatform and drops blanks", () => {
    const selection = normalizeComplexitySelection({
      drivers: {
        online_store: { checked: true, name: "Shopify", payoutPlatform: "stripe" },
        pos_system: { checked: true, payoutPlatform: "   " },
      },
    });
    expect(selection.drivers.online_store).toEqual({
      checked: true,
      name: "Shopify",
      payoutPlatform: "stripe",
    });
    expect(selection.drivers.pos_system).toEqual({ checked: true });
  });

  it("drops unknown ids and invalid fields", () => {
    const selection = normalizeComplexitySelection({
      drivers: {
        nope: { checked: true },
        payroll: { checked: "yes" },
        loans_mca: { checked: true, count: -3, monthlyOverride: NaN },
        online_store: { checked: true, name: "   " },
      },
    });
    expect("nope" in selection.drivers).toBe(false);
    expect(selection.drivers.payroll).toEqual({ checked: false });
    expect(selection.drivers.loans_mca).toEqual({ checked: true });
    expect(selection.drivers.online_store).toEqual({ checked: true });
  });
});

describe("sanitizeComplexityDriverDefaults", () => {
  it("preserves omission", () => {
    expect(sanitizeComplexityDriverDefaults({})).toEqual({});
    expect(sanitizeComplexityDriverDefaults(null)).toEqual({});
    expect(sanitizeComplexityDriverDefaults({ inventory_cogs: { monthly: 100 } })).toEqual({
      inventory_cogs: { monthly: 100 },
    });
  });

  it("drops non-finite and negative values", () => {
    expect(
      sanitizeComplexityDriverDefaults({
        inventory_cogs: { monthly: -5, cleanupPerMonth: NaN },
        loans_mca: { monthly: Infinity },
      }),
    ).toEqual({});
  });
});

describe("resolveComplexityDriverDefaults", () => {
  it("resolves override over template over code, per field", () => {
    const resolved = resolveComplexityDriverDefaults({
      override: { inventory_cogs: { monthly: 120 } },
      template: { inventory_cogs: { monthly: 100, cleanupPerMonth: 10 }, pos_system: { monthly: 60 } },
    });
    expect(resolved.inventory_cogs).toEqual({ monthly: 120, cleanupPerMonth: 10 });
    expect(resolved.pos_system).toEqual({ monthly: 60, cleanupPerMonth: 0 });
    expect(resolved.online_store).toEqual({ monthly: 55, cleanupPerMonth: 0 });
  });

  it("falls back to code defaults when empty", () => {
    expect(resolveComplexityDriverDefaults({})).toEqual(DEFAULT_COMPLEXITY_DRIVER_DEFAULTS);
  });

  it("keeps a cap only on filing_1099", () => {
    const resolved = resolveComplexityDriverDefaults({
      override: { inventory_cogs: { cap: 999 }, filing_1099: { cap: 200 } },
    });
    expect(resolved.inventory_cogs.cap).toBeUndefined();
    expect(resolved.filing_1099.cap).toBe(200);
  });
});

describe("toPublicComplexityWhy", () => {
  it("publishes labels, reasons, and amounts with no internal notes", () => {
    const withPayees = priceComplexityDrivers(
      {
        drivers: {
          ...normalizeComplexitySelection({}).drivers,
          payroll: { checked: true },
          inventory_cogs: { checked: true },
          filing_1099: { checked: true, count: 5 },
        },
      },
      { packageId: "maintain", cleanupMonths: 0 },
    );
    expect(withPayees.lines).toHaveLength(3);
    const pub = toPublicComplexityWhy(withPayees.lines);
    expect(pub).toEqual([
      { id: "payroll", label: "Payroll", why: withPayees.lines[0].clientWhy, monthly: null },
      { id: "inventory_cogs", label: "Inventory and cost of goods", why: withPayees.lines[1].clientWhy, monthly: 95 },
      { id: "filing_1099", label: "1099 filing", why: withPayees.lines[2].clientWhy, monthly: 40 },
    ]);
    for (const entry of pub) {
      expect(Object.keys(entry).sort()).toEqual(["id", "label", "monthly", "why"]);
    }
  });

  it("publishes null for a driver waiting on its existing line, hiding the line name", () => {
    const result = priceComplexityDrivers(checked("sales_tax"), {
      packageId: "maintain",
      cleanupMonths: 0,
      existing: {
        salesTaxAddon: false,
        projectTrackingAddon: true,
        mixedBooks: true,
        staffingHeadcount: 1,
      },
    });
    expect(result.lines[0].requiresExistingLine).toBe("salesTaxAddon");
    const pub = toPublicComplexityWhy(result.lines);
    expect(pub).toEqual([
      { id: "sales_tax", label: "Sales tax filing", why: result.lines[0].clientWhy, monthly: null },
    ]);
  });

  it("publishes nothing for junk", () => {
    expect(toPublicComplexityWhy(null)).toEqual([]);
    expect(toPublicComplexityWhy([{ id: "nope", label: "x", clientWhy: "y", monthly: 1 }])).toEqual([]);
  });
});

describe("lead copy rulings (Spec 03/A)", () => {
  it("names what each new driver covers in its why", () => {
    const byId = Object.fromEntries(complexityDriverDefs().map((d) => [d.id, d]));
    expect(byId.loans_mca.label).toBe(
      "Merchant cash advances and loans with principal / interest / fee splits",
    );
    expect(byId.loans_mca.clientWhy).toMatch(/principal/i);
    expect(byId.loans_mca.clientWhy).toMatch(/interest/i);
    expect(byId.loans_mca.clientWhy).toMatch(/fees/i);
    expect(byId.loans_mca.clientWhy).toMatch(/balance/i);
    expect(byId.loans_mca.clientWhy).toMatch(/reconciliation line/i);
    expect(byId.filing_1099.clientWhy).toMatch(/W-9/);
    expect(byId.filing_1099.clientWhy).toMatch(/1099/);
    expect(byId.filing_1099.clientWhy).toMatch(/payees/i);
    expect(byId.filing_1099.clientWhy).toMatch(/contractor bookkeeping/i);
    expect(byId.personal_commingling.clientWhy).toMatch(/personal spending/i);
    expect(byId.personal_commingling.clientWhy).toMatch(/business transactions/i);
    expect(byId.personal_commingling.clientWhy).toMatch(/mixed books/i);
    expect(byId.online_store.clientWhy).toMatch(/sales/i);
    expect(byId.online_store.clientWhy).toMatch(/fees/i);
    expect(byId.online_store.clientWhy).toMatch(/refunds/i);
    expect(byId.online_store.clientWhy).toMatch(/payouts/i);
    expect(byId.pos_system.clientWhy).toMatch(/daily sales/i);
    expect(byId.pos_system.clientWhy).toMatch(/tips/i);
    expect(byId.pos_system.clientWhy).toMatch(/fees/i);
    expect(byId.inventory_cogs.clientWhy).toMatch(/stock/i);
    expect(byId.inventory_cogs.clientWhy).toMatch(/cost of goods/i);
  });

  it("names the covering existing line in each existing driver's why", () => {
    const byId = Object.fromEntries(complexityDriverDefs().map((d) => [d.id, d]));
    expect(byId.payroll.clientWhy).toMatch(/staffing line/i);
    expect(byId.sales_tax.clientWhy).toMatch(/Sales Tax Filing & Remittance/);
    expect(byId.job_tracking.clientWhy).toMatch(/Project Tracking/);
    expect(byId.mixed_books.clientWhy).toMatch(/books-type adjustment/i);
  });

  it("carries a builderHint on loans_mca, pos_system and online_store only", () => {
    const byId = Object.fromEntries(complexityDriverDefs().map((d) => [d.id, d]));
    expect(byId.loans_mca.builderHint).toMatch(/reconciliation line/i);
    expect(byId.online_store.builderHint).toMatch(/counted once here/i);
    expect(byId.online_store.builderHint).toMatch(/choose it below/i);
    expect(byId.pos_system.builderHint).toMatch(/counted once here/i);
    for (const id of ["payroll", "sales_tax", "job_tracking", "mixed_books", "inventory_cogs", "personal_commingling", "filing_1099"] as const) {
      expect(byId[id].builderHint).toBeUndefined();
    }
  });

  it("names the system in priced POS / online-store lines", () => {
    const pos = priceComplexityDrivers(checked("pos_system", { name: "Lightspeed" }), {
      packageId: "maintain",
      cleanupMonths: 0,
    });
    expect(pos.lines[0].clientWhy).toMatch(/Lightspeed/);
    expect(pos.lines[0].clientWhy).toMatch(/daily sales/i);
    const store = priceComplexityDrivers(checked("online_store", { name: "Shopify" }), {
      packageId: "maintain",
      cleanupMonths: 0,
    });
    expect(store.lines[0].clientWhy).toMatch(/Shopify/);
    expect(store.lines[0].clientWhy).toMatch(/payouts/i);
    const generic = priceComplexityDrivers(checked("pos_system"), {
      packageId: "maintain",
      cleanupMonths: 0,
    });
    expect(generic.lines[0].clientWhy).toMatch(/point-of-sale system/i);
  });

  it("names the payee count in priced 1099 lines", () => {
    const result = priceComplexityDrivers(checked("filing_1099", { count: 10 }), {
      packageId: "maintain",
      cleanupMonths: 0,
    });
    expect(result.lines[0].clientWhy).toMatch(/10 payees/);
    expect(result.lines[0].clientWhy).toMatch(/W-9/);
    const one = priceComplexityDrivers(checked("filing_1099", { count: 1 }), {
      packageId: "maintain",
      cleanupMonths: 0,
    });
    expect(one.lines[0].clientWhy).toMatch(/1 payee/);
  });
});

describe("hasComplexitySelection", () => {
  it("is false for empty or junk selections", () => {
    expect(hasComplexitySelection(null)).toBe(false);
    expect(hasComplexitySelection({})).toBe(false);
    expect(hasComplexitySelection(normalizeComplexitySelection({}))).toBe(false);
  });

  it("is true when any driver is checked", () => {
    expect(hasComplexitySelection(checked("pos_system"))).toBe(true);
    expect(hasComplexitySelection({ drivers: { payroll: { checked: true } } })).toBe(true);
  });
});
