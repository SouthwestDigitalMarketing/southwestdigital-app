import { describe, expect, it } from "vitest";
import {
  complexityDriverDefs,
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

  it("scales grow by the complex-ops ratio (x190/120), ceil $5", () => {
    const result = priceComplexityDrivers(checked("inventory_cogs"), {
      packageId: "grow",
      cleanupMonths: 0,
    });
    expect(result.lines[0].monthly).toBe(155); // 95 x 190/120 = 150.42 -> 155
    const commingling = priceComplexityDrivers(checked("personal_commingling"), {
      packageId: "grow",
      cleanupMonths: 0,
    });
    expect(commingling.lines[0].monthly).toBe(175); // 110 x 190/120 = 174.17 -> 175
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
    expect(grow.lines[0].monthly).toBe(255); // capped at ceil5(160 x 190/120)
  });

  it("charges $0 for 1099 with no payee count", () => {
    const result = priceComplexityDrivers(checked("filing_1099"), {
      packageId: "maintain",
      cleanupMonths: 0,
    });
    expect(result.lines).toHaveLength(1);
    expect(result.lines[0].monthly).toBe(0);
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
});

describe("normalizeComplexitySelection", () => {
  it("normalizes junk to all-unchecked", () => {
    for (const raw of [null, undefined, 42, "x", [], { drivers: null }]) {
      const selection = normalizeComplexitySelection(raw);
      expect(Object.values(selection.drivers).every((v) => v.checked === false)).toBe(true);
    }
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
      { label: "Payroll", why: withPayees.lines[0].clientWhy, monthly: null },
      { label: "Inventory and cost of goods", why: withPayees.lines[1].clientWhy, monthly: 95 },
      { label: "1099 filing", why: withPayees.lines[2].clientWhy, monthly: 40 },
    ]);
    for (const entry of pub) {
      expect(Object.keys(entry).sort()).toEqual(["label", "monthly", "why"]);
    }
  });

  it("publishes nothing for junk", () => {
    expect(toPublicComplexityWhy(null)).toEqual([]);
    expect(toPublicComplexityWhy([{ id: "nope", label: "x", clientWhy: "y", monthly: 1 }])).toEqual([]);
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
