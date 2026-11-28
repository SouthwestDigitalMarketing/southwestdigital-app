import { existsSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { audioOptionsFor } from "./audio-options";

describe("audioOptionsFor", () => {
  it("gives TREB 261127 SM7B EQ variants first, then the earlier clips", () => {
    const options = audioOptionsFor("mwzglzlj-5643aa");
    expect(options.map((option) => option.id)).toEqual([
      "sm7b",
      "sm7b-chest",
      "sm7b-stern",
      "original",
      "loudnorm",
      "isolator",
      "light",
    ]);
    expect(options.every((option) => option.src.startsWith("/showrunner/audio-ab/") && option.src.endsWith(".mp3"))).toBe(true);
    expect(options.every((option) => option.label && option.blurb)).toBe(true);
    for (const option of options) {
      expect(existsSync(join(process.cwd(), "public", option.src.slice(1)))).toBe(true);
    }
  });

  it("hides the players on every other episode", () => {
    expect(audioOptionsFor("mwql4qoy-c42d57")).toEqual([]);
  });
});
