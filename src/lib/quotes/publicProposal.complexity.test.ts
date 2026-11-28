import { describe, expect, it } from "vitest";
import {
  publicComplexityWhyByTierForSnapshot,
  publicComplexityWhyForSnapshot,
  toPublicBookkeepingProposal,
} from "./publicProposal";

const pricing = { maintain: { monthly: 500 }, improve: { monthly: 600 }, grow: { monthly: 750 } };

describe("spec 03 public complexity whitelist", () => {
  it("returns null for legacy proposals without a selection", () => {
    expect(publicComplexityWhyForSnapshot({ assessment: {}, pricing })).toBeNull();
    const result = toPublicBookkeepingProposal({ assessment: {}, pricing });
    expect(result.complexityWhy).toBeNull();
  });

  it("publishes labels, reasons and monthlies from the maintain-tier lines", () => {
    const snapshot = {
      assessment: {
        complexity: {
          drivers: {
            inventory_cogs: { checked: true },
            sales_tax: { checked: true },
          },
        },
      },
      pricing: {
        maintain: {
          monthly: 500,
          complexity: {
            lines: [
              {
                id: "inventory_cogs",
                label: "Inventory and cost of goods",
                clientWhy: "We track stock and cost of goods sold each month.",
                monthly: 95,
                cleanupPerMonth: 0,
              },
              {
                id: "sales_tax",
                label: "Sales tax filing",
                clientWhy: "Covered by the Sales Tax Filing & Remittance add-on.",
                monthly: 0,
                includedNote: "Included in Sales Tax Filing & Remittance",
                cleanupPerMonth: 0,
              },
            ],
            monthlyTotal: 95,
            cleanupPerMonthTotal: 0,
            cleanupTotal: 0,
          },
        },
        improve: { monthly: 600 },
        grow: { monthly: 750 },
      },
    };
    expect(publicComplexityWhyForSnapshot(snapshot)).toEqual([
      {
        id: "inventory_cogs",
        label: "Inventory and cost of goods",
        why: "We track stock and cost of goods sold each month.",
        monthly: 95,
      },
      {
        id: "sales_tax",
        label: "Sales tax filing",
        why: "Covered by the Sales Tax Filing & Remittance add-on.",
        monthly: null,
      },
    ]);
    const result = toPublicBookkeepingProposal(snapshot);
    expect(result.complexityWhy).toEqual(publicComplexityWhyForSnapshot(snapshot));
    // Only the whitelisted keys leave the snapshot.
    expect(Object.keys(result.complexityWhy![0]).sort()).toEqual(["id", "label", "monthly", "why"]);
    expect(JSON.stringify(result)).not.toContain("includedNote");
    expect(JSON.stringify(result)).not.toContain("cleanupPerMonth");
  });

  it("returns null when a selection exists but the snapshot predates the lines", () => {
    const snapshot = {
      assessment: { complexity: { drivers: { inventory_cogs: { checked: true } } } },
      pricing,
    };
    expect(publicComplexityWhyForSnapshot(snapshot)).toBeNull();
  });

  it("carries per-tier lines so each tab shows its own amounts", () => {
    const inventoryLine = (monthly: number) => ({
      id: "inventory_cogs",
      label: "Inventory and cost of goods",
      clientWhy: "We track stock and cost of goods sold each month.",
      monthly,
      cleanupPerMonth: 0,
    });
    const salesTaxLine = {
      id: "sales_tax",
      label: "Sales tax filing",
      clientWhy: "Covered by the Sales Tax Filing & Remittance add-on.",
      monthly: 0,
      includedNote: "Included in Sales Tax Filing & Remittance",
      cleanupPerMonth: 0,
    };
    const snapshot = {
      assessment: {
        complexity: {
          drivers: {
            inventory_cogs: { checked: true },
            sales_tax: { checked: true },
          },
        },
      },
      pricing: {
        maintain: { monthly: 595, complexity: { lines: [inventoryLine(95), salesTaxLine], monthlyTotal: 95, cleanupPerMonthTotal: 0, cleanupTotal: 0 } },
        improve: { monthly: 620, complexity: { lines: [inventoryLine(120), salesTaxLine], monthlyTotal: 120, cleanupPerMonthTotal: 0, cleanupTotal: 0 } },
        grow: { monthly: 745, complexity: { lines: [inventoryLine(145), salesTaxLine], monthlyTotal: 145, cleanupPerMonthTotal: 0, cleanupTotal: 0 } },
      },
    };
    const byTier = publicComplexityWhyByTierForSnapshot(snapshot);
    expect(byTier?.maintain).toEqual([
      { id: "inventory_cogs", label: "Inventory and cost of goods", why: "We track stock and cost of goods sold each month.", monthly: 95 },
      { id: "sales_tax", label: "Sales tax filing", why: "Covered by the Sales Tax Filing & Remittance add-on.", monthly: null },
    ]);
    expect(byTier?.improve?.[0]).toEqual(
      expect.objectContaining({ id: "inventory_cogs", monthly: 120 }),
    );
    expect(byTier?.grow?.[0]).toEqual(
      expect.objectContaining({ id: "inventory_cogs", monthly: 145 }),
    );
    // Included/waiting drivers read null in every tier.
    for (const tier of [byTier?.maintain, byTier?.improve, byTier?.grow]) {
      expect(tier?.[1]).toEqual(expect.objectContaining({ id: "sales_tax", monthly: null }));
    }
    // The public payload carries the map alongside the maintain-tier alias.
    const result = toPublicBookkeepingProposal(snapshot);
    expect(result.complexityWhyByTier).toEqual(byTier);
    expect(result.complexityWhy).toEqual(byTier?.maintain);
    expect(Object.keys(result.complexityWhyByTier!.grow![0]).sort()).toEqual(["id", "label", "monthly", "why"]);
    expect(JSON.stringify(result)).not.toContain("includedNote");
    expect(JSON.stringify(result)).not.toContain("cleanupPerMonth");
  });

  it("returns a null map for legacy proposals and for snapshots that predate the lines", () => {
    expect(publicComplexityWhyByTierForSnapshot({ assessment: {}, pricing })).toBeNull();
    expect(
      publicComplexityWhyByTierForSnapshot({
        assessment: { complexity: { drivers: { inventory_cogs: { checked: true } } } },
        pricing,
      }),
    ).toBeNull();
    expect(toPublicBookkeepingProposal({ assessment: {}, pricing }).complexityWhyByTier).toBeNull();
  });

  it("keeps raw selection input out of the public payload", () => {
    const privateValue = "MONTHLY_OVERRIDE_SENTINEL";
    const result = toPublicBookkeepingProposal({
      assessment: {
        complexity: {
          drivers: { inventory_cogs: { checked: true, monthlyOverride: privateValue } },
        },
      },
      pricing,
    });
    expect(result.complexityWhy).toBeNull();
    expect(JSON.stringify(result)).not.toContain(privateValue);
  });
});
