import { describe, expect, it } from "vitest";
import { DEFAULT_DRAFT, parseAdDraft } from "./draft";

function form(overrides: Record<string, string> = {}) {
  const data = new FormData();
  const values = {
    areaId: "bentwater",
    headline: DEFAULT_DRAFT.headline,
    primaryText: DEFAULT_DRAFT.primaryText,
    callToAction: DEFAULT_DRAFT.callToAction,
    landingPage: DEFAULT_DRAFT.landingPage,
    ...overrides,
  };
  for (const [key, value] of Object.entries(values)) data.set(key, value);
  return data;
}

describe("parseAdDraft", () => {
  it("names the draft after the area and keeps its pins", () => {
    const draft = parseAdDraft(form());
    expect(draft.name).toBe("Bentwater");
    expect(draft.pins).toHaveLength(2);
    expect(draft.dailyBudgetCents).toBeNull();
  });

  it("turns a dollar budget into cents", () => {
    expect(parseAdDraft(form({ dailyBudget: "$7.50" })).dailyBudgetCents).toBe(750);
  });

  it("rejects an unknown area, a bad button, a plain-http link and a silly budget", () => {
    expect(() => parseAdDraft(form({ areaId: "nowhere" }))).toThrow("Choose an area.");
    expect(() => parseAdDraft(form({ callToAction: "Buy" }))).toThrow("Choose a button.");
    expect(() => parseAdDraft(form({ landingPage: "http://x.com" }))).toThrow("https://");
    expect(() => parseAdDraft(form({ dailyBudget: "5000" }))).toThrow("between $1 and $500");
  });

  it("requires a headline and ad text", () => {
    expect(() => parseAdDraft(form({ headline: " " }))).toThrow("Write a headline.");
    expect(() => parseAdDraft(form({ primaryText: "" }))).toThrow("Write the ad text.");
  });
});
