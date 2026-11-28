import { describe, expect, it } from "vitest";
import {
  OPTIONS_TEMPLATE_SNAPSHOT_VERSION,
  buildOptionsTemplateSnapshot,
  parseComplexityDriverDefaultsInputs,
  parseOptionsTemplateSnapshot,
  reconcileOptionsTemplateSnapshot,
  type OptionsTemplateAssessmentSlice,
} from "./optionsTemplates";

const baseSlice: OptionsTemplateAssessmentSlice = {
  optionsCatalogOrder: [],
  additionalOptions: [],
  bonuses: [],
  bonusPackageSelections: {},
};

describe("spec 03 options-template complexity defaults", () => {
  it("keeps version 1 and round-trips stored defaults", () => {
    const snapshot = buildOptionsTemplateSnapshot({
      ...baseSlice,
      complexityDriverDefaults: {
        inventory_cogs: { monthly: 120 },
        loans_mca: { monthly: 80, cleanupPerMonth: 30 },
      },
    });
    expect(snapshot.version).toBe(OPTIONS_TEMPLATE_SNAPSHOT_VERSION);
    const roundTripped = parseOptionsTemplateSnapshot(JSON.parse(JSON.stringify(snapshot)));
    expect(roundTripped).toEqual(snapshot);
    expect(roundTripped?.complexityDriverDefaults).toEqual({
      inventory_cogs: { monthly: 120 },
      loans_mca: { monthly: 80, cleanupPerMonth: 30 },
    });
  });

  it("parses legacy snapshots that omit the key", () => {
    const legacy = {
      version: 1,
      productKind: "bookkeeping",
      optionsCatalogOrder: [],
      additionalOptions: [],
      bonuses: [],
      bonusPackageSelections: {},
    };
    const parsed = parseOptionsTemplateSnapshot(JSON.parse(JSON.stringify(legacy)));
    expect(parsed?.complexityDriverDefaults).toEqual({});
    expect(parsed?.version).toBe(OPTIONS_TEMPLATE_SNAPSHOT_VERSION);
  });

  it("preserves omission: unset drivers and fields never fill in code defaults", () => {
    const snapshot = buildOptionsTemplateSnapshot({
      ...baseSlice,
      complexityDriverDefaults: { inventory_cogs: { monthly: 120 } },
    });
    expect(snapshot.complexityDriverDefaults).toEqual({ inventory_cogs: { monthly: 120 } });
    expect(snapshot.complexityDriverDefaults?.pos_system).toBeUndefined();
  });

  it("drops junk values instead of storing them", () => {
    const snapshot = buildOptionsTemplateSnapshot({
      ...baseSlice,
      complexityDriverDefaults: {
        inventory_cogs: { monthly: -5, cleanupPerMonth: Number.NaN },
        // @ts-expect-error probe: unknown driver ids never survive
        unknown_driver: { monthly: 10 },
      },
    });
    expect(snapshot.complexityDriverDefaults).toEqual({});
  });

  it("reconciles without dropping the complexity defaults", () => {
    const snapshot = buildOptionsTemplateSnapshot({
      ...baseSlice,
      complexityDriverDefaults: { online_store: { monthly: 60, cleanupPerMonth: 0 } },
    });
    const { slice, skippedIds } = reconcileOptionsTemplateSnapshot(snapshot, []);
    expect(skippedIds).toEqual([]);
    expect(slice.complexityDriverDefaults).toEqual({ online_store: { monthly: 60, cleanupPerMonth: 0 } });
  });

  it("parses editor inputs: blank clears, invalid rejects", () => {
    expect(parseComplexityDriverDefaultsInputs({})).toEqual({});
    expect(
      parseComplexityDriverDefaultsInputs({
        inventory_cogs: { monthly: "", cleanupPerMonth: "" },
        pos_system: { monthly: "70", cleanupPerMonth: "" },
      }),
    ).toEqual({ pos_system: { monthly: 70 } });
    expect(
      parseComplexityDriverDefaultsInputs({
        loans_mca: { monthly: "abc", cleanupPerMonth: "" },
      }),
    ).toBeNull();
    expect(
      parseComplexityDriverDefaultsInputs({
        personal_commingling: { monthly: "-1", cleanupPerMonth: "" },
      }),
    ).toBeNull();
    // Existing-line drivers are not template-priced: their rows are ignored.
    expect(
      parseComplexityDriverDefaultsInputs({
        payroll: { monthly: "50", cleanupPerMonth: "" },
      } as never),
    ).toEqual({});
  });
});
