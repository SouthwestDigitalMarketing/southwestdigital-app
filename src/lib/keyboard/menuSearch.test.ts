import { describe, expect, it } from "vitest";
import {
  matchTier,
  matchesQuery,
  partitionByDepth,
  rankEntry,
  searchMenuEntries,
  type MenuEntry,
} from "./menuSearch";

function entry(partial: Partial<MenuEntry> & { label: string }): MenuEntry {
  return { id: partial.label.toLowerCase(), depth: 0, order: 0, ...partial };
}

describe("matchesQuery", () => {
  it("matches an empty query", () => {
    expect(matchesQuery(entry({ label: "Offers" }), "")).toBe(true);
  });

  it("matches a literal substring", () => {
    expect(matchesQuery(entry({ label: "Agreements" }), "agree")).toBe(true);
  });

  it("requires every term to match", () => {
    const item = entry({ label: "Real estate portfolio", description: "property tracking" });
    expect(matchesQuery(item, "real estate")).toBe(true);
    expect(matchesQuery(item, "real zebra")).toBe(false);
  });

  it("matches an alias", () => {
    expect(matchesQuery(entry({ label: "Pipeline", aliases: ["crm"] }), "crm")).toBe(true);
  });

  it("matches the trailing segment of a dotted id", () => {
    expect(matchesQuery(entry({ label: "Go there", id: "nav.discounts" }), "discounts")).toBe(true);
  });

  it("matches a whole word of the description but not a fragment of one", () => {
    const item = entry({ label: "Offers", description: "manage proposals" });
    expect(matchesQuery(item, "proposals")).toBe(true);
    expect(matchesQuery(item, "propos")).toBe(false);
  });

  it("does not do subsequence matching, unlike a fuzzy matcher", () => {
    // The deliberate divergence: "thm" must NOT find "Theme".
    expect(matchesQuery(entry({ label: "Theme" }), "thm")).toBe(false);
  });
});

describe("matchTier", () => {
  it("ranks an exact label highest", () => {
    expect(matchTier(entry({ label: "Offers" }), "offers")).toBe("exact");
  });

  it("ranks a prefix above a mid-string substring", () => {
    expect(matchTier(entry({ label: "Offers" }), "off")).toBe("prefix");
    expect(matchTier(entry({ label: "Payoff plan" }), "off")).toBe("substring");
  });

  it("falls to the alias tier when only an alias matches", () => {
    expect(matchTier(entry({ label: "Pipeline", aliases: ["crm"] }), "crm")).toBe("alias");
  });

  it("falls to the description tier when only the description matches", () => {
    expect(matchTier(entry({ label: "Offers", description: "manage proposals" }), "proposals")).toBe("description");
  });

  it("returns null for a miss", () => {
    expect(matchTier(entry({ label: "Offers" }), "zebra")).toBeNull();
  });
});

describe("rankEntry", () => {
  it("lets tier dominate depth and order", () => {
    const shallowSubstring = rankEntry(entry({ label: "a", depth: 0, order: 0 }), "substring");
    const deepPrefix = rankEntry(entry({ label: "b", depth: 9, order: 99 }), "prefix");
    expect(deepPrefix).toBeLessThan(shallowSubstring);
  });

  it("prefers shallower entries within a tier", () => {
    const shallow = rankEntry(entry({ label: "a", depth: 0, order: 0 }), "prefix");
    const deep = rankEntry(entry({ label: "a", depth: 3, order: 0 }), "prefix");
    expect(shallow).toBeLessThan(deep);
  });

  it("gives submenus a small edge over leaves", () => {
    const group = rankEntry(entry({ label: "a", isGroup: true }), "prefix");
    const leaf = rankEntry(entry({ label: "a" }), "prefix");
    expect(group).toBeLessThan(leaf);
  });
});

describe("searchMenuEntries", () => {
  const entries: MenuEntry[] = [
    entry({ label: "Offers", id: "nav.offers", order: 0 }),
    entry({ label: "Agreements", id: "nav.agreements", order: 1 }),
    entry({ label: "Pipeline", id: "nav.pipeline", aliases: ["crm"], order: 2 }),
    entry({ label: "Payoff report", id: "nav.payoff", order: 3, depth: 1 }),
    entry({ label: "Theme", id: "style.theme", order: 4, depth: 1 }),
  ];

  it("returns everything in declaration order for an empty query", () => {
    const results = searchMenuEntries(entries, "");
    expect(results).toHaveLength(5);
    expect(results.map((result) => result.entry.label)).toEqual([
      "Offers",
      "Agreements",
      "Pipeline",
      "Payoff report",
      "Theme",
    ]);
  });

  it("ranks a prefix match above a mid-word one", () => {
    const results = searchMenuEntries(entries, "off");
    expect(results[0].entry.label).toBe("Offers");
    expect(results.map((result) => result.entry.label)).toContain("Payoff report");
  });

  it("finds an entry by alias", () => {
    const results = searchMenuEntries(entries, "crm");
    expect(results[0].entry.label).toBe("Pipeline");
    expect(results[0].tier).toBe("alias");
  });

  it("returns nothing rather than a surprise for a miss", () => {
    expect(searchMenuEntries(entries, "zebra")).toEqual([]);
  });

  it("falls back to subsequence only when literal matching finds nothing", () => {
    const results = searchMenuEntries(entries, "thm");
    expect(results).toHaveLength(1);
    expect(results[0].entry.label).toBe("Theme");
    expect(results[0].tier).toBe("subsequence");
  });

  it("prefers a literal match over any subsequence candidate", () => {
    // "the" is a literal prefix of Theme, so no fallback tier should appear.
    const results = searchMenuEntries(entries, "the");
    expect(results.every((result) => result.tier !== "subsequence")).toBe(true);
  });

  it("is stable for equal ranks", () => {
    const first = searchMenuEntries(entries, "e").map((result) => result.entry.label);
    const second = searchMenuEntries(entries, "e").map((result) => result.entry.label);
    expect(first).toEqual(second);
  });
});

describe("partitionByDepth", () => {
  it("splits results into the current level and deeper ones", () => {
    const results = searchMenuEntries(
      [
        entry({ label: "Style", depth: 0, order: 0 }),
        entry({ label: "Style theme", depth: 1, order: 1 }),
        entry({ label: "Style theme accent", depth: 2, order: 2 }),
      ],
      "style",
    );
    const { here, deeper } = partitionByDepth(results, 0);
    expect(here.map((result) => result.entry.label)).toEqual(["Style"]);
    expect(deeper).toHaveLength(2);
  });

  it("puts everything in 'here' when nothing is deeper", () => {
    const results = searchMenuEntries([entry({ label: "Offers", depth: 0 })], "off");
    expect(partitionByDepth(results, 0).deeper).toEqual([]);
  });
});
