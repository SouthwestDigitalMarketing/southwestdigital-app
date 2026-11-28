import { describe, expect, it } from "vitest";
import {
  hashPromiseText,
  scanPromiseRisks,
  unresolvedPromiseHits,
  type PromiseConfirmation,
} from "./promiseCheck";

function confirm(hit: { where: string; phrase: string; textHash: string }, extra?: Partial<PromiseConfirmation>): PromiseConfirmation {
  return { where: hit.where, phrase: hit.phrase, textHash: hit.textHash, confirmedAt: new Date().toISOString(), ...extra };
}

describe("scanPromiseRisks", () => {
  it("flags each risky phrase with where, match, index and snippet", () => {
    const hits = scanPromiseRisks([{ where: "intro", text: "We offer unlimited revisions, guaranteed." }]);
    expect(hits.map((hit) => hit.phrase)).toEqual(["unlimited", "guarantee"]);
    expect(hits[0]).toMatchObject({ where: "intro", phrase: "unlimited", match: "unlimited", index: 9 });
    expect(hits[0].snippet).toContain("unlimited");
    expect(hits[1]).toMatchObject({ where: "intro", phrase: "guarantee", match: "guaranteed" });
  });

  it("flags 24/7 variants: slash, spaced slash, and x", () => {
    const hits = scanPromiseRisks([
      { where: "a", text: "on call 24/7 for you" },
      { where: "b", text: "on call 24 / 7 for you" },
      { where: "c", text: "on call 24x7 for you" },
      { where: "d", text: "on call 24X7 for you" },
    ]);
    expect(hits.map((hit) => hit.phrase)).toEqual(["24/7", "24/7", "24/7", "24/7"]);
    expect(hits.map((hit) => hit.match)).toEqual(["24/7", "24 / 7", "24x7", "24X7"]);
  });

  it("flags same day and same-day with the canonical phrase", () => {
    const hits = scanPromiseRisks([{ where: "bonus", text: "Same day turnaround, or same-day turnaround." }]);
    expect(hits.map((hit) => hit.phrase)).toEqual(["same day", "same day"]);
    expect(hits.map((hit) => hit.match)).toEqual(["Same day", "same-day"]);
  });

  it("flags tax filing, file your taxes, and file taxes", () => {
    const hits = scanPromiseRisks([
      { where: "a", text: "We handle your tax filing each quarter." },
      { where: "b", text: "We will file your taxes for you." },
      { where: "c", text: "We file taxes fast." },
    ]);
    expect(hits.map((hit) => hit.phrase)).toEqual(["tax filing", "file your taxes", "file taxes"]);
  });

  it("flags the natural plural tax filings", () => {
    const hits = scanPromiseRisks([
      { where: "a", text: "We handle your tax filings each quarter." },
      { where: "b", text: "We handle your tax filing each quarter." },
    ]);
    expect(hits.map((hit) => hit.match)).toEqual(["tax filings", "tax filing"]);
    expect(hits.map((hit) => hit.phrase)).toEqual(["tax filing", "tax filing"]);
  });

  it("flags audit, audits and audited but not auditorium", () => {
    const hits = scanPromiseRisks([
      { where: "a", text: "Survive any audit with clean books." },
      { where: "b", text: "We handle audits and audited statements." },
      { where: "quiet", text: "Our office is next to the auditorium." },
    ]);
    expect(hits.map((hit) => ({ phrase: hit.phrase, match: hit.match }))).toEqual([
      { phrase: "audit", match: "audit" },
      { phrase: "audit", match: "audits" },
      { phrase: "audit", match: "audited" },
    ]);
  });

  it("flags CPA case-insensitively on word boundaries", () => {
    const hits = scanPromiseRisks([
      { where: "a", text: "Reviewed by a cpa every month." },
      { where: "b", text: "A (CPA) signs off." },
    ]);
    expect(hits.map((hit) => hit.phrase)).toEqual(["CPA", "CPA"]);
    expect(hits[0].match).toBe("cpa");
  });

  it("does not flag innocent words", () => {
    const hits = scanPromiseRisks([{
      where: "intro",
      text: "Clean books, useful reports, and clear answers with limited wait and no auditorium nearby.",
    }]);
    expect(hits).toEqual([]);
  });

  it("skips empty text and keeps field order then match order", () => {
    const hits = scanPromiseRisks([
      { where: "second", text: "guarantee" },
      { where: "empty", text: "" },
      { where: "first", text: "unlimited guarantee" },
    ]);
    expect(hits.map((hit) => `${hit.where}:${hit.phrase}`)).toEqual([
      "second:guarantee",
      "first:unlimited",
      "first:guarantee",
    ]);
    expect(hits[1].index).toBeLessThan(hits[2].index);
  });

  it("stamps every hit with the hash of its field text", () => {
    const text = "unlimited support, guaranteed.";
    const hits = scanPromiseRisks([{ where: "intro", text }]);
    expect(hits.length).toBeGreaterThan(0);
    for (const hit of hits) expect(hit.textHash).toBe(hashPromiseText(text));
  });
});

describe("hashPromiseText", () => {
  it("is stable and changes when the text changes", () => {
    expect(hashPromiseText("hello")).toBe(hashPromiseText("hello"));
    expect(hashPromiseText("hello")).not.toBe(hashPromiseText("hello!"));
  });
});

describe("unresolvedPromiseHits", () => {
  it("a confirmation resolves its hit while the text is unchanged", () => {
    const hits = scanPromiseRisks([{ where: "intro", text: "unlimited revisions, guaranteed." }]);
    expect(hits).toHaveLength(2);
    const confirmed = unresolvedPromiseHits(hits, [confirm(hits[0])]);
    expect(confirmed.map((hit) => hit.phrase)).toEqual(["guarantee"]);
  });

  it("a confirmation stops counting once the text at that place is edited", () => {
    const before = scanPromiseRisks([{ where: "intro", text: "unlimited revisions." }]);
    const confirmations = [confirm(before[0])];
    expect(unresolvedPromiseHits(before, confirmations)).toEqual([]);
    const after = scanPromiseRisks([{ where: "intro", text: "unlimited revisions, truly." }]);
    expect(after).toHaveLength(1);
    expect(unresolvedPromiseHits(after, confirmations)).toHaveLength(1);
  });

  it("a confirmation only covers its own place and phrase", () => {
    const hits = scanPromiseRisks([
      { where: "intro", text: "unlimited revisions." },
      { where: "bonus", text: "unlimited revisions." },
    ]);
    const confirmations = [confirm(hits[0])];
    expect(unresolvedPromiseHits(hits, confirmations).map((hit) => hit.where)).toEqual(["bonus"]);
  });

  it("accepts an optional confirmedBy", () => {
    const hits = scanPromiseRisks([{ where: "intro", text: "guaranteed results." }]);
    const resolved = unresolvedPromiseHits(hits, [confirm(hits[0], { confirmedBy: "tom@x.com" })]);
    expect(resolved).toEqual([]);
  });
});
