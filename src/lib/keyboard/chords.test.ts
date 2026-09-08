import { describe, expect, it } from "vitest";
import {
  chordCandidates,
  chordFromKeyboardEvent,
  chordsEqual,
  codeFallbackChord,
  formatChord,
  formatSequence,
  parseChord,
  parseSequence,
  serializeChord,
} from "./chords";

describe("parseChord", () => {
  it("parses a bare letter", () => {
    expect(parseChord("g")).toEqual({ key: "g" });
  });

  it("parses modifier combinations", () => {
    expect(parseChord("mod+k")).toEqual({ key: "k", mod: true });
    expect(parseChord("shift+g")).toEqual({ key: "g", shift: true });
    expect(parseChord("mod+shift+p")).toEqual({ key: "p", mod: true, shift: true });
  });

  it("treats cmd, ctrl and meta as the same portable modifier", () => {
    expect(parseChord("cmd+k")).toEqual(parseChord("ctrl+k"));
    expect(parseChord("meta+k")).toEqual(parseChord("mod+k"));
  });

  it("canonicalizes named keys", () => {
    expect(parseChord("Escape").key).toBe("escape");
    expect(parseChord("ArrowDown").key).toBe("down");
    expect(parseChord("Enter").key).toBe("enter");
  });

  it("keeps a bare punctuation key intact", () => {
    expect(parseChord("?")).toEqual({ key: "?" });
    expect(parseChord("/")).toEqual({ key: "/" });
    expect(parseChord("+")).toEqual({ key: "+" });
  });

  it("rejects an empty chord", () => {
    expect(() => parseChord("   ")).toThrow();
  });
});

describe("parseSequence", () => {
  it("splits on whitespace", () => {
    expect(parseSequence("g o")).toEqual([{ key: "g" }, { key: "o" }]);
  });

  it("tolerates extra spacing", () => {
    expect(parseSequence("  g   o  ")).toHaveLength(2);
  });
});

describe("chordFromKeyboardEvent", () => {
  it("reads a plain letter", () => {
    expect(chordFromKeyboardEvent({ key: "g" })).toEqual({ key: "g" });
  });

  it("keeps shift distinct for letters so G and g can differ", () => {
    expect(chordFromKeyboardEvent({ key: "G", shiftKey: true })).toEqual({ key: "g", shift: true });
    expect(chordsEqual(chordFromKeyboardEvent({ key: "G", shiftKey: true }), { key: "g" })).toBe(false);
  });

  it("drops shift when it was consumed producing a punctuation character", () => {
    // On a US layout "?" is Shift+/ and the browser reports key "?".
    expect(chordFromKeyboardEvent({ key: "?", shiftKey: true })).toEqual({ key: "?" });
  });

  it("uses ctrl as the portable modifier off mac and cmd on mac", () => {
    expect(chordFromKeyboardEvent({ key: "k", ctrlKey: true }, false)).toEqual({ key: "k", mod: true });
    expect(chordFromKeyboardEvent({ key: "k", ctrlKey: true }, true)).toEqual({ key: "k" });
    expect(chordFromKeyboardEvent({ key: "k", metaKey: true }, true)).toEqual({ key: "k", mod: true });
  });

  it("normalizes the space bar", () => {
    expect(chordFromKeyboardEvent({ key: " " })).toEqual({ key: "space" });
  });

  it("keeps shift on named keys, where it is not consumed", () => {
    expect(chordFromKeyboardEvent({ key: "Enter", shiftKey: true })).toEqual({ key: "enter", shift: true });
  });
});

describe("codeFallbackChord", () => {
  it("recovers the latin letter on a non-latin layout", () => {
    expect(codeFallbackChord({ key: "г", code: "KeyG" })).toEqual({ key: "g" });
  });

  it("returns null when the layout already produced a latin character", () => {
    expect(codeFallbackChord({ key: "g", code: "KeyG" })).toBeNull();
  });

  it("returns null for non letter or digit codes", () => {
    expect(codeFallbackChord({ key: "Enter", code: "Enter" })).toBeNull();
  });
});

describe("chordCandidates", () => {
  it("offers one candidate on a latin layout", () => {
    expect(chordCandidates({ key: "g", code: "KeyG" })).toHaveLength(1);
  });

  it("offers the physical-key fallback on a non-latin layout", () => {
    const candidates = chordCandidates({ key: "г", code: "KeyG" });
    expect(candidates).toHaveLength(2);
    expect(candidates[1]).toEqual({ key: "g" });
  });
});

describe("serializeChord", () => {
  it("orders modifiers deterministically", () => {
    expect(serializeChord({ key: "p", shift: true, mod: true, alt: true })).toBe("mod+alt+shift+p");
  });

  it("round-trips through parseChord", () => {
    ["mod+k", "shift+g", "g", "?", "mod+alt+shift+p"].forEach((input) => {
      expect(serializeChord(parseChord(input))).toBe(input);
    });
  });
});

describe("formatChord", () => {
  it("uses word modifiers off mac", () => {
    expect(formatChord({ key: "k", mod: true }, false)).toBe("Ctrl K");
    expect(formatChord({ key: "g", shift: true }, false)).toBe("Shift G");
  });

  it("uses symbols on mac", () => {
    expect(formatChord({ key: "k", mod: true }, true)).toBe("⌘K");
  });

  it("labels named keys readably", () => {
    expect(formatChord({ key: "escape" })).toBe("Esc");
    expect(formatChord({ key: "down" })).toBe("↓");
  });

  it("joins a sequence with 'then'", () => {
    expect(formatSequence(parseSequence("g o"))).toBe("G then O");
  });
});

describe("positional fallback for punctuation and digits", () => {
  it("recovers a bracket that sits behind AltGr on a german layout", () => {
    // German layout: "[" is AltGr+8, so an unmodified BracketLeft press reports "ü".
    expect(codeFallbackChord({ key: "ü", code: "BracketLeft" })).toEqual({ key: "[" });
  });

  it("recovers a digit from the azerty number row", () => {
    // AZERTY unshifted "1" emits "&".
    expect(codeFallbackChord({ key: "&", code: "Digit1" })).toEqual({ key: "1" });
  });

  it("adds nothing when the layout already produced the character", () => {
    expect(codeFallbackChord({ key: "[", code: "BracketLeft" })).toBeNull();
    expect(codeFallbackChord({ key: "1", code: "Digit1" })).toBeNull();
    expect(codeFallbackChord({ key: ",", code: "Comma" })).toBeNull();
  });

  it("does not record shift for a positional punctuation match", () => {
    // US layout: Shift+/ is "?", and the Slash code should still offer "/".
    expect(codeFallbackChord({ key: "?", code: "Slash", shiftKey: true })).toEqual({ key: "/" });
  });

  it("offers both the typed character and the physical key", () => {
    const candidates = chordCandidates({ key: "&", code: "Digit1" });
    expect(candidates).toEqual([{ key: "&" }, { key: "1" }]);
  });
});
