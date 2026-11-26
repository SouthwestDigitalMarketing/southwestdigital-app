import { describe, expect, it } from "vitest";
import { SPOT_KINDS, parseItem } from "./plan";
import { SUGGESTED_SPOTS, suggestionsFor } from "./spots";
import { remoteMonthsPlan } from "./starter";

describe("suggested spots", () => {
  it("covers every starter option with valid spots", () => {
    const options = remoteMonthsPlan().sections.options.map((option) => String(option.place));
    for (const option of options) expect(suggestionsFor(option, []).length, option).toBeGreaterThanOrEqual(10);
    for (const spot of SUGGESTED_SPOTS) {
      expect(options).toContain(spot.option);
      expect(SPOT_KINDS).toContain(spot.kind);
      expect(() => parseItem("spots", { id: "00000000-0000-4000-8000-000000000001", ...spot })).not.toThrow();
    }
  });

  it("skips spots the option already has, ignoring case", () => {
    const all = suggestionsFor("fukuoka, japan", []);
    const rest = suggestionsFor("Fukuoka, Japan", ["tenjin", "ENGINEER CAFE"]);
    expect(rest.length).toBe(all.length - 2);
    expect(rest.map((spot) => spot.name)).not.toContain("Tenjin");
    expect(suggestionsFor("Mexico City", [])).toEqual([]);
    expect(suggestionsFor("Atlantis", [])).toEqual([]);
  });
});
