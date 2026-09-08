import { describe, expect, it } from "vitest";
import { fuzzyMatch, fuzzyMatchFields } from "./fuzzy";

function score(haystack: string, needle: string): number {
  const match = fuzzyMatch(haystack, needle);
  if (!match) throw new Error(`expected "${needle}" to match "${haystack}"`);
  return match.score;
}

describe("fuzzyMatch", () => {
  it("matches an exact prefix", () => {
    expect(fuzzyMatch("Offers", "off")).not.toBeNull();
  });

  it("matches a scattered subsequence", () => {
    expect(fuzzyMatch("Go to Agreements", "gta")).not.toBeNull();
  });

  it("returns null when a character is missing", () => {
    expect(fuzzyMatch("Offers", "offz")).toBeNull();
  });

  it("returns null when characters appear in the wrong order", () => {
    expect(fuzzyMatch("Offers", "sreffo")).toBeNull();
  });

  it("treats an empty needle as a neutral match", () => {
    expect(fuzzyMatch("Offers", "")).toEqual({ score: 1, indices: [] });
  });

  it("returns null for an empty haystack", () => {
    expect(fuzzyMatch("", "a")).toBeNull();
  });

  it("is case-insensitive", () => {
    expect(fuzzyMatch("Offers", "OFF")).not.toBeNull();
    expect(fuzzyMatch("OFFERS", "off")).not.toBeNull();
  });

  it("reports the matched indices for highlighting", () => {
    expect(fuzzyMatch("Offers", "ofs")?.indices).toEqual([0, 1, 5]);
  });

  it("ignores spaces in the needle so multi-word typing works", () => {
    expect(fuzzyMatch("Go to Offers", "go off")).not.toBeNull();
  });

  it("ranks a prefix match above a late match", () => {
    expect(score("Offers", "of")).toBeGreaterThan(score("Payoff", "of"));
  });

  it("ranks consecutive characters above scattered ones", () => {
    expect(score("Discounts", "disc")).toBeGreaterThan(score("Duplicate invoice submission check", "disc"));
  });

  it("ranks a word-start acronym above the same letters buried mid-word", () => {
    expect(score("Publish and send", "pas")).toBeGreaterThan(score("Xpxaxsx", "pas"));
  });

  it("still prefers a tight consecutive prefix over an acronym, which is what short needles want", () => {
    // Typing "pas" should surface "Paste" before "Publish and send"; acronym
    // matching earns its keep on needles like "pns" that no single word contains.
    expect(score("Paste", "pas")).toBeGreaterThan(score("Publish and send", "pas"));
  });

  it("finds an acronym that no single word could satisfy", () => {
    expect(fuzzyMatch("Publish and send", "pns")).not.toBeNull();
  });

  it("prefers the shorter of two similar targets", () => {
    expect(score("Tags", "tag")).toBeGreaterThan(score("Tags and automation settings", "tag"));
  });

  it("finds camelCase boundaries", () => {
    expect(fuzzyMatch("openOfferBuilder", "oob")).not.toBeNull();
  });
});

describe("fuzzyMatchFields", () => {
  const fields = (title: string, keywords: string) => [
    { text: title, weight: 1 },
    { text: keywords, weight: 0.5 },
  ];

  it("matches on the primary field and keeps its indices", () => {
    const match = fuzzyMatchFields(fields("Offers", "quotes proposals"), "off");
    expect(match?.indices).toEqual([0, 1, 2]);
  });

  it("matches via a keyword when the title does not contain it", () => {
    const match = fuzzyMatchFields(fields("Offers", "quotes proposals"), "proposal");
    expect(match).not.toBeNull();
  });

  it("drops indices from a secondary field so highlights never point at hidden text", () => {
    const match = fuzzyMatchFields(fields("Offers", "quotes proposals"), "proposal");
    expect(match?.indices).toEqual([]);
  });

  it("returns null when no field matches", () => {
    expect(fuzzyMatchFields(fields("Offers", "quotes"), "zzz")).toBeNull();
  });

  it("weights a title hit above a keyword hit", () => {
    const titleHit = fuzzyMatchFields(fields("Discounts", "unrelated"), "disc");
    const keywordHit = fuzzyMatchFields(fields("Unrelated", "discounts"), "disc");
    expect(titleHit!.score).toBeGreaterThan(keywordHit!.score);
  });
});
