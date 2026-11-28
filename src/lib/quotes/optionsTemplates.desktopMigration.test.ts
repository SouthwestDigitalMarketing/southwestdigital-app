import { describe, expect, it } from "vitest";
import { DEFAULT_DESKTOP_MIGRATION_OPTIONS } from "./desktopMigration";
import {
  DESKTOP_MIGRATION_DEFAULT_FIELDS,
  OPTIONS_TEMPLATE_SNAPSHOT_VERSION,
  buildOptionsTemplateSnapshot,
  parseDesktopMigrationDefaultsInputs,
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

describe("spec 05 options-template migration defaults", () => {
  it("keeps version 1 with the new key present", () => {
    const snapshot = buildOptionsTemplateSnapshot({
      ...baseSlice,
      desktopMigrationDefaults: { baseAmount: 700 },
    });
    expect(snapshot.version).toBe(OPTIONS_TEMPLATE_SNAPSHOT_VERSION);
    expect(OPTIONS_TEMPLATE_SNAPSHOT_VERSION).toBe(1);
    expect(snapshot.desktopMigrationDefaults).toEqual({ baseAmount: 700 });
  });

  it("round-trips a Partial through build and parse", () => {
    const snapshot = buildOptionsTemplateSnapshot({
      ...baseSlice,
      desktopMigrationDefaults: { baseAmount: 700, historyYearCap: 3, extraFileAdd: 200 },
    });
    const roundTripped = parseOptionsTemplateSnapshot(JSON.parse(JSON.stringify(snapshot)));
    expect(roundTripped).toEqual(snapshot);
    expect(roundTripped?.desktopMigrationDefaults).toEqual({
      baseAmount: 700,
      historyYearCap: 3,
      extraFileAdd: 200,
    });
  });

  it("parses pre-Spec-05 snapshots with the defaults left unset", () => {
    const legacy = {
      version: 1,
      productKind: "bookkeeping",
      optionsCatalogOrder: [],
      additionalOptions: [],
      bonuses: [],
      bonusPackageSelections: {},
    };
    const parsed = parseOptionsTemplateSnapshot(JSON.parse(JSON.stringify(legacy)));
    expect(parsed?.desktopMigrationDefaults).toEqual({});
    // Omission resolves to the code defaults, never to zeros.
    expect({ ...DEFAULT_DESKTOP_MIGRATION_OPTIONS, ...parsed?.desktopMigrationDefaults }).toEqual(
      DEFAULT_DESKTOP_MIGRATION_OPTIONS,
    );
  });

  it("leaves omitted keys unset so resolution can fall through", () => {
    const snapshot = buildOptionsTemplateSnapshot(baseSlice);
    expect(snapshot.desktopMigrationDefaults).toEqual({});
  });

  it("sanitizes out-of-range and non-finite defaults per field, leaving gaps unset", () => {
    const snapshot = buildOptionsTemplateSnapshot({
      ...baseSlice,
      desktopMigrationDefaults: {
        baseAmount: 700,
        historyPerYear: -5,
        historyYearCap: -1,
        bandAdd0to99: Number.NaN,
        extraFileAdd: 250,
        // @ts-expect-error junk key never stored
        unknown: 1,
      },
    });
    expect(snapshot.desktopMigrationDefaults).toEqual({ baseAmount: 700, extraFileAdd: 250 });
  });

  it("carries the defaults through reconciliation (they are not catalog items)", () => {
    const snapshot = buildOptionsTemplateSnapshot({
      ...baseSlice,
      desktopMigrationDefaults: { baseAmount: 700 },
    });
    const result = reconcileOptionsTemplateSnapshot(snapshot, ["something-else"]);
    expect(result.slice.desktopMigrationDefaults).toEqual({ baseAmount: 700 });
    const missing = reconcileOptionsTemplateSnapshot(
      { ...snapshot, desktopMigrationDefaults: undefined },
      ["something-else"],
    );
    expect(missing.slice.desktopMigrationDefaults).toEqual({});
  });

  it("parses the manager's text inputs, with blank clearing the key", () => {
    expect(
      parseDesktopMigrationDefaultsInputs({ baseAmount: "700", historyYearCap: "3" }),
    ).toEqual({ baseAmount: 700, historyYearCap: 3 });
    expect(parseDesktopMigrationDefaultsInputs({})).toEqual({});
    expect(
      parseDesktopMigrationDefaultsInputs({ baseAmount: "  ", extraFileAdd: "250" }),
    ).toEqual({ extraFileAdd: 250 });
  });

  it("rejects non-numeric and negative manager inputs", () => {
    expect(parseDesktopMigrationDefaultsInputs({ baseAmount: "abc" })).toBeNull();
    expect(parseDesktopMigrationDefaultsInputs({ historyPerYear: "-5" })).toBeNull();
    expect(parseDesktopMigrationDefaultsInputs({ historyYearCap: "Infinity" })).toBeNull();
  });

  it("covers every pricing knob in the editor field list", () => {
    expect(DESKTOP_MIGRATION_DEFAULT_FIELDS.map((field) => field.key).sort()).toEqual(
      (Object.keys(DEFAULT_DESKTOP_MIGRATION_OPTIONS) as string[]).sort(),
    );
  });
});

describe("spec 05 additional-option role", () => {
  it("keeps the desktop-migration role on an add-on when a draft is saved", () => {
    const slice = buildOptionsTemplateSnapshot({
      ...baseSlice,
      additionalOptions: [
        {
          id: "migration",
          name: "QuickBooks Desktop to Online Migration",
          description: "",
          monthlyPrice: 640,
          showInProposal: true,
          archived: false,
          billingCadence: "one-time",
          required: true,
          role: "desktop-migration",
        },
        { id: "plain", name: "Plain", description: "", monthlyPrice: 10, showInProposal: true, archived: false },
      ],
    });
    expect(slice.additionalOptions.find((o) => o.id === "migration")?.role).toBe(
      "desktop-migration",
    );
    expect(slice.additionalOptions.find((o) => o.id === "plain")?.role).toBeUndefined();
  });

  it("round-trips the role through parse", () => {
    const snapshot = buildOptionsTemplateSnapshot({
      ...baseSlice,
      additionalOptions: [
        {
          id: "migration",
          name: "Migration",
          description: "",
          monthlyPrice: 640,
          showInProposal: true,
          archived: false,
          role: "desktop-migration",
        },
      ],
    });
    expect(parseOptionsTemplateSnapshot(JSON.parse(JSON.stringify(snapshot)))).toEqual(snapshot);
  });

  it("drops junk roles instead of storing them", () => {
    const snapshot = buildOptionsTemplateSnapshot({
      ...baseSlice,
      additionalOptions: [
        {
          id: "a",
          name: "A",
          description: "",
          monthlyPrice: 1,
          showInProposal: true,
          archived: false,
          // @ts-expect-error junk role never stored
          role: "migration",
        },
      ],
    });
    expect(snapshot.additionalOptions[0]?.role).toBeUndefined();
  });

  it("keeps the role through reconciliation", () => {
    const snapshot = buildOptionsTemplateSnapshot({
      ...baseSlice,
      optionsCatalogOrder: ["migration"],
      additionalOptions: [
        {
          id: "migration",
          name: "Migration",
          description: "",
          monthlyPrice: 640,
          showInProposal: true,
          archived: false,
          role: "desktop-migration",
        },
      ],
    });
    const result = reconcileOptionsTemplateSnapshot(snapshot, ["migration"]);
    expect(result.slice.additionalOptions[0]?.role).toBe("desktop-migration");
  });
});
