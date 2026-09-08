/**
 * "Is the user typing right now?" — the single most important guard in a
 * keyboard-first app. Single-letter shortcuts must never steal a keystroke that
 * was meant for a text field, or the app becomes unusable for everyone.
 *
 * Kept dependency-free (a structural element shape rather than `HTMLElement`) so
 * the node-environment vitest suite can exercise it without a DOM.
 */

import type { Chord } from "./chords";

export type ElementLike = {
  tagName?: string;
  type?: string;
  isContentEditable?: boolean;
  getAttribute?: (name: string) => string | null;
  closest?: (selector: string) => unknown;
  readOnly?: boolean;
};

/**
 * `<input>` types that hold no text. Shortcuts stay live on these because there
 * is no text cursor to interrupt — a checkbox does not care about `j`.
 */
const NON_TEXT_INPUT_TYPES = new Set([
  "checkbox",
  "radio",
  "button",
  "submit",
  "reset",
  "file",
  "range",
  "color",
  "image",
]);

/** ARIA roles that behave like a text field even on a non-input element. */
const TEXTUAL_ROLES = new Set(["textbox", "searchbox", "combobox", "spinbutton"]);

/**
 * Escape hatch for any subtree that wants raw keys (a code editor, a canvas, a
 * custom grid). Put `data-keyboard-ignore` on the container and global
 * single-key shortcuts stop firing inside it.
 */
export const KEYBOARD_IGNORE_ATTRIBUTE = "data-keyboard-ignore";

export function isTypingContext(target: ElementLike | null | undefined): boolean {
  if (!target) return false;

  if (target.isContentEditable) return true;

  const tag = target.tagName?.toUpperCase();
  if (tag === "TEXTAREA" || tag === "SELECT") return true;
  if (tag === "INPUT") {
    const type = (target.type ?? "text").toLowerCase();
    if (!NON_TEXT_INPUT_TYPES.has(type)) return true;
  }

  const role = target.getAttribute?.("role");
  if (role && TEXTUAL_ROLES.has(role.toLowerCase())) return true;

  if (target.closest?.(`[${KEYBOARD_IGNORE_ATTRIBUTE}]`)) return true;

  return false;
}

/**
 * Chords that stay live even while typing.
 *
 * Anything holding Ctrl/Cmd or Alt is unambiguous — it cannot be part of the
 * text being entered — and Escape must always be able to dismiss the surface
 * the user is typing into, otherwise a focused field becomes a trap.
 */
export function chordAllowedWhileTyping(chord: Chord): boolean {
  if (chord.mod || chord.alt) return true;
  if (chord.key === "escape") return true;
  return false;
}
