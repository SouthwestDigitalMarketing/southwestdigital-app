import { describe, expect, it } from "vitest";
import {
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
