import { describe, expect, it } from "vitest";
import { chordAllowedWhileTyping, isTypingContext, type ElementLike } from "./typingContext";

function element(partial: Partial<ElementLike>): ElementLike {
  return { getAttribute: () => null, closest: () => null, ...partial };
}

describe("isTypingContext", () => {
  it("is false for nothing focused", () => {
    expect(isTypingContext(null)).toBe(false);
    expect(isTypingContext(undefined)).toBe(false);
  });

  it("is true for text-bearing fields", () => {
    expect(isTypingContext(element({ tagName: "TEXTAREA" }))).toBe(true);
    expect(isTypingContext(element({ tagName: "SELECT" }))).toBe(true);
    expect(isTypingContext(element({ tagName: "INPUT", type: "text" }))).toBe(true);
    expect(isTypingContext(element({ tagName: "INPUT", type: "email" }))).toBe(true);
    expect(isTypingContext(element({ tagName: "INPUT", type: "search" }))).toBe(true);
  });

  it("defaults a typeless input to text", () => {
    expect(isTypingContext(element({ tagName: "INPUT" }))).toBe(true);
  });

  it("is false for inputs that hold no text", () => {
    ["checkbox", "radio", "button", "submit", "reset", "file", "range", "color"].forEach((type) => {
      expect(isTypingContext(element({ tagName: "INPUT", type }))).toBe(false);
    });
  });

  it("is case-insensitive about the input type", () => {
    expect(isTypingContext(element({ tagName: "INPUT", type: "CHECKBOX" }))).toBe(false);
  });

  it("respects contenteditable", () => {
    expect(isTypingContext(element({ tagName: "DIV", isContentEditable: true }))).toBe(true);
  });

  it("respects textual ARIA roles", () => {
    expect(isTypingContext(element({ tagName: "DIV", getAttribute: () => "textbox" }))).toBe(true);
    expect(isTypingContext(element({ tagName: "DIV", getAttribute: () => "combobox" }))).toBe(true);
    expect(isTypingContext(element({ tagName: "DIV", getAttribute: () => "button" }))).toBe(false);
  });

  it("honours an opted-out subtree", () => {
    expect(isTypingContext(element({ tagName: "DIV", closest: () => ({}) }))).toBe(true);
  });

  it("is false for ordinary buttons and links", () => {
    expect(isTypingContext(element({ tagName: "BUTTON" }))).toBe(false);
    expect(isTypingContext(element({ tagName: "A" }))).toBe(false);
  });
});

describe("chordAllowedWhileTyping", () => {
  it("lets modifier chords through", () => {
    expect(chordAllowedWhileTyping({ key: "k", mod: true })).toBe(true);
    expect(chordAllowedWhileTyping({ key: "p", alt: true })).toBe(true);
  });

  it("always lets escape through so a field is never a trap", () => {
    expect(chordAllowedWhileTyping({ key: "escape" })).toBe(true);
  });

  it("blocks bare letters and punctuation", () => {
    expect(chordAllowedWhileTyping({ key: "g" })).toBe(false);
    expect(chordAllowedWhileTyping({ key: "/" })).toBe(false);
    expect(chordAllowedWhileTyping({ key: "g", shift: true })).toBe(false);
  });
});
