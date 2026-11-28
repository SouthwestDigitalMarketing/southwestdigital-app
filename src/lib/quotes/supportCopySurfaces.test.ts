import { describe, expect, it } from "vitest";
import { hasStoredSupportCopy, supportCopyForPublish } from "./serviceLevels";
import {
  publicSupportCopyForSnapshot,
  toPublicBookkeepingProposal,
} from "./publicProposal";

describe("hasStoredSupportCopy", () => {
  it("accepts a publish-stamped copy", () => {
    expect(hasStoredSupportCopy(supportCopyForPublish())).toBe(true);
  });

  it.each([undefined, null, 0, "copy", [], {}, { version: 2 }, { version: 2, levels: {} }])(
    "rejects %p",
    (stored) => {
      expect(hasStoredSupportCopy(stored)).toBe(false);
    },
  );
});

describe("publicSupportCopyForSnapshot", () => {
  it("whitelists titles, meanings, and emphasis only", () => {
    const stored = supportCopyForPublish();
    const withJunk = {
      version: stored.version,
      levels: Object.fromEntries(
        Object.entries(stored.levels).map(([name, copy]) => [name, { ...copy, internal: "PRIVATE", version: 99 }]),
      ),
      extra: "PRIVATE",
    };
    const result = publicSupportCopyForSnapshot({ supportCopy: withJunk });
    expect(result).not.toBeNull();
    expect(JSON.stringify(result)).not.toContain("PRIVATE");
    expect(Object.values(result!.levels)[0]).toEqual({ title: expect.any(String), meaning: expect.any(String), emphasis: expect.any(String) });
    expect(Object.keys(Object.values(result!.levels)[0]).sort()).toEqual(["emphasis", "meaning", "title"]);
  });

  it("returns null for legacy or malformed snapshots", () => {
    expect(publicSupportCopyForSnapshot({})).toBeNull();
    expect(publicSupportCopyForSnapshot({ supportCopy: { version: 2, levels: {} } })).toBeNull();
    expect(publicSupportCopyForSnapshot(null)).toBeNull();
  });
});

describe("public proposal support copy", () => {
  const pricing = { maintain: { monthly: 500 }, improve: { monthly: 600 }, grow: { monthly: 750 } };

  it("omits the key entirely for legacy snapshots", () => {
    const result = toPublicBookkeepingProposal({
      assessment: { introHeadline: "Legacy plan" },
      pricing,
    });
    expect(result).not.toHaveProperty("supportCopy");
  });

  it("carries the frozen copy for new publishes", () => {
    const stored = supportCopyForPublish();
    const result = toPublicBookkeepingProposal({
      assessment: { introHeadline: "New plan" },
      pricing,
      supportCopy: stored,
    });
    expect(result).toHaveProperty("supportCopy");
    expect(result.supportCopy).toEqual({ version: 2, levels: stored.levels });
    expect(result.supportCopy!.levels["Concierge Client Support"].meaning).toContain("2 business hours");
  });
});
