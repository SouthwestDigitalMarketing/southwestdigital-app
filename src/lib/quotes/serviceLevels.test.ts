import { describe, expect, it } from "vitest";
import {
  LEGACY_SUPPORT_COPY,
  SUPPORT_COPY,
  SERVICE_LEVEL_COPY,
  resolveSupportCopy,
  serviceLevelDescription,
  serviceLevelTitle,
  supportCopyForPublish,
} from "./serviceLevels";
import { proposalIncludedServices } from "./proposalServices";

describe("service level names", () => {
  it("shows one name per support level everywhere", () => {
    expect(serviceLevelTitle("Standard Client Support")).toBe("Steady Support");
    expect(serviceLevelTitle("Monthly Bookkeeping")).toBe("Monthly Bookkeeping");
  });

  it("uses the same name in the agreement's included services", () => {
    const included = proposalIncludedServices({
      bonuses: [
        { id: "monthly-bookkeeping", name: "Monthly Bookkeeping", description: "", archived: false, defaultPackageIds: ["maintain"] },
        { id: "standard-client-support", name: "Standard Client Support", description: "1-2 days", archived: false, defaultPackageIds: ["maintain"] },
      ],
    }, "maintain");
    expect(included.map((item) => item.name)).toEqual(["Monthly Bookkeeping", "Steady Support"]);
  });
});

describe("legacy freeze", () => {
  it("LEGACY_SUPPORT_COPY is byte-equal to the pre-Spec-07 SERVICE_LEVEL_COPY", () => {
    expect(LEGACY_SUPPORT_COPY).toEqual(SERVICE_LEVEL_COPY);
    expect(JSON.stringify(LEGACY_SUPPORT_COPY)).toBe(JSON.stringify(SERVICE_LEVEL_COPY));
    expect(Object.keys(LEGACY_SUPPORT_COPY)).toEqual(Object.keys(SERVICE_LEVEL_COPY));
  });

  it("current SUPPORT_COPY keeps Standard/Priority and fixes Concierge", () => {
    expect(SUPPORT_COPY["Standard Client Support"]).toEqual(LEGACY_SUPPORT_COPY["Standard Client Support"]);
    expect(SUPPORT_COPY["Priority Client Support"]).toEqual(LEGACY_SUPPORT_COPY["Priority Client Support"]);
    expect(SUPPORT_COPY["Concierge Client Support"].meaning).toContain("2 business hours");
    expect(SUPPORT_COPY["Concierge Client Support"].meaning).not.toContain("24/7");
    expect(SUPPORT_COPY["Concierge Client Support"].emphasis).toBe("2 business hours");
  });
});

describe("supportCopyForPublish", () => {
  it("stores the current wording as version 2", () => {
    const stored = supportCopyForPublish();
    expect(stored.version).toBe(2);
    expect(stored.levels).toEqual(SUPPORT_COPY);
    expect(stored.levels["Concierge Client Support"].meaning).toContain("2 business hours");
  });

  it("returns a copy the caller cannot mutate", () => {
    const stored = supportCopyForPublish();
    stored.levels["Concierge Client Support"].meaning = "edited";
    expect(SUPPORT_COPY["Concierge Client Support"].meaning).toContain("2 business hours");
  });
});

describe("resolveSupportCopy", () => {
  it("returns stored copy when valid", () => {
    const stored = supportCopyForPublish();
    expect(resolveSupportCopy(stored)).toEqual(stored);
  });

  it.each([undefined, null, 0, "copy", [], {}, { version: 2 }, { levels: {} }, { version: "2", levels: SUPPORT_COPY }, { version: 2, levels: { "X": { title: "X" } } }])(
    "falls back to legacy for invalid stored copy (%p)", (stored) => {
      const resolved = resolveSupportCopy(stored);
      expect(resolved.levels).toEqual(LEGACY_SUPPORT_COPY);
      expect(resolved.levels["Concierge Client Support"].meaning).toContain("24/7");
    },
  );

  it("never returns the current wording for a snapshot without copy", () => {
    const resolved = resolveSupportCopy(undefined);
    expect(resolved.levels["Concierge Client Support"].meaning).not.toContain("2 business hours");
  });
});

describe("serviceLevelDescription", () => {
  it("resolves to stored copy when passed, else legacy", () => {
    const stored = supportCopyForPublish();
    expect(serviceLevelDescription("Standard Client Support", "old", stored)).toContain("2–3 business days");
    expect(serviceLevelDescription("Steady Support", "Responses within 1–2 business days", stored)).toContain("2–3 business days");
    expect(serviceLevelDescription("Concierge Client Support", "old", stored)).toContain("2 business hours");
    expect(serviceLevelDescription("Concierge Client Support", "old")).toContain("24/7");
    expect(serviceLevelDescription("White-Glove Concierge", "old")).toContain("24/7");
  });
  it("keeps the stored text for other services", () => {
    expect(serviceLevelDescription("Bookkeeping", "kept")).toBe("kept");
    expect(serviceLevelDescription("Bookkeeping", "kept", supportCopyForPublish())).toBe("kept");
  });
});

describe("serviceLevelTitle with copy", () => {
  it("reads titles from the passed copy and falls back to legacy without one", () => {
    const stored = supportCopyForPublish();
    expect(serviceLevelTitle("Standard Client Support", stored)).toBe("Steady Support");
    expect(serviceLevelTitle("Standard Client Support")).toBe("Steady Support");
    expect(serviceLevelTitle("Monthly Bookkeeping", stored)).toBe("Monthly Bookkeeping");
  });
});
