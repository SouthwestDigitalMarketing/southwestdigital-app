/**
 * Pure key-chord parsing and matching.
 *
 * Lives in `src/lib/**` as plain TypeScript (no React, no DOM globals at module
 * scope) so the existing node-environment vitest suite can cover it directly —
 * `vitest.config.mts` only globs `src/**\/*.test.ts`.
 */

/** A single normalized key press: one key token plus its non-consumed modifiers. */
export type Chord = {
  key: string;
  mod?: boolean;
  alt?: boolean;
  shift?: boolean;
};

/**
 * `event.key` values that are not single characters, mapped to the short tokens
 * we use in binding strings. Anything not listed falls back to the lowercased
 * `event.key`, so unusual keys still round-trip rather than silently vanishing.
 */
const NAMED_KEYS: Record<string, string> = {
  escape: "escape",
  esc: "escape",
  enter: "enter",
  return: "enter",
  tab: "tab",
  backspace: "backspace",
  delete: "delete",
  home: "home",
  end: "end",
  pageup: "pageup",
  pagedown: "pagedown",
  arrowup: "up",
  arrowdown: "down",
  arrowleft: "left",
  arrowright: "right",
  " ": "space",
  spacebar: "space",
};

/** Human-facing labels, keyed by canonical token. */
const KEY_LABELS: Record<string, string> = {
  escape: "Esc",
  enter: "Enter",
  tab: "Tab",
  backspace: "Backspace",
  delete: "Del",
  home: "Home",
  end: "End",
  pageup: "PgUp",
  pagedown: "PgDn",
  up: "↑",
  down: "↓",
  left: "←",
  right: "→",
  space: "Space",
};

function canonicalKeyToken(rawKey: string): string {
  const lower = rawKey.toLowerCase();
  const named = NAMED_KEYS[lower];
  if (named) return named;
  return lower;
}

/**
 * Parse a binding string such as `"mod+k"`, `"shift+g"`, `"g"` or `"?"`.
 *
 * Shift is only meaningful for keys where it does not already change the
 * produced character — see `chordFromKeyboardEvent` for why.
 */
export function parseChord(input: string): Chord {
  const trimmed = input.trim();
  if (!trimmed) throw new Error("Empty chord");

  // A bare "+" is a legitimate key, so only split on "+" that joins parts.
  const parts = trimmed.length === 1 ? [trimmed] : trimmed.split("+").filter((part) => part !== "");
  if (parts.length === 0) return { key: "+" };

  const chord: Chord = { key: "" };
  parts.forEach((part, index) => {
    const lower = part.toLowerCase();
    const isLast = index === parts.length - 1;
    if (!isLast || parts.length === 1) {
      if (lower === "mod" || lower === "cmd" || lower === "ctrl" || lower === "control" || lower === "meta") {
        chord.mod = true;
        return;
      }
      if (lower === "alt" || lower === "option") {
        chord.alt = true;
        return;
      }
      if (lower === "shift") {
        chord.shift = true;
        return;
      }
    }
    chord.key = canonicalKeyToken(part);
  });

  if (!chord.key) throw new Error(`Chord "${input}" has no key`);
  return chord;
}

/** Parse a whole sequence: `"g o"` becomes two chords. */
export function parseSequence(input: string): Chord[] {
  return input
    .split(/\s+/)
    .filter((part) => part !== "")
    .map(parseChord);
}

/** Stable string form, so chords can be compared and used as map keys. */
export function serializeChord(chord: Chord): string {
  const parts: string[] = [];
  if (chord.mod) parts.push("mod");
  if (chord.alt) parts.push("alt");
  if (chord.shift) parts.push("shift");
  parts.push(chord.key);
  return parts.join("+");
}

export function chordsEqual(a: Chord, b: Chord): boolean {
  return serializeChord(a) === serializeChord(b);
}

/** Minimal shape we need from a KeyboardEvent — keeps these helpers testable. */
export type KeyboardEventLike = {
  key: string;
  code?: string;
  ctrlKey?: boolean;
  metaKey?: boolean;
  altKey?: boolean;
  shiftKey?: boolean;
};

/**
 * Normalize a keyboard event into a chord.
 *
 * The subtle rule is Shift. On a US layout `?` is Shift+`/`, and the browser
 * reports `event.key === "?"`. Recording that as `shift+?` would mean no binding
 * could ever spell it naturally. So: when Shift has already been *consumed* to
 * produce a different printable character, we drop it. Letters are the
 * exception — Shift+g still reports `"G"`, and we want `shift+g` to stay
 * distinct from `g` so vim's `G` (jump to end) can coexist with `g` (the go-to
 * prefix).
 */
export function chordFromKeyboardEvent(event: KeyboardEventLike, isMac = false): Chord {
  const mod = isMac ? Boolean(event.metaKey) : Boolean(event.ctrlKey);
  const chord: Chord = { key: "" };
  if (mod) chord.mod = true;
  if (event.altKey) chord.alt = true;

  const raw = event.key;
  // Named keys are resolved first: the space bar reports `" "`, which is length
  // 1 and would otherwise be treated as a printable character rather than the
  // `space` token.
  const named = NAMED_KEYS[raw.toLowerCase()];
  if (named) {
    chord.key = named;
    if (event.shiftKey) chord.shift = true;
  } else if (raw.length === 1) {
    if (/[a-z]/i.test(raw)) {
      chord.key = raw.toLowerCase();
      if (event.shiftKey) chord.shift = true;
    } else {
      // Shift (if held) produced this character; do not record it separately.
      chord.key = raw;
    }
  } else {
    chord.key = canonicalKeyToken(raw);
    if (event.shiftKey) chord.shift = true;
  }

  return chord;
}

/**
 * Physical-key codes for the punctuation we bind positionally.
 *
 * Hyprland makes the same distinction: Omarchy's own config binds workspaces as
 * `code:10`..`code:19` (the physical number row) and resize as `code:20`/`code:21`,
 * while binding mnemonic letters by keysym. We mirror that split — mnemonics
 * follow the printed letter, positions follow the physical key.
 */
const POSITIONAL_CODES: Record<string, string> = {
  BracketLeft: "[",
  BracketRight: "]",
  Comma: ",",
  Period: ".",
  Slash: "/",
  Semicolon: ";",
  Quote: "'",
  Backquote: "`",
  Minus: "-",
  Equal: "=",
  Backslash: "\\",
};

/**
 * Physical-key fallback, for layouts where `event.key` cannot produce the bound
 * character.
 *
 * Two real cases:
 *  - Non-Latin layouts: on Cyrillic the `g` key reports `"г"`, so a `g o`
 *    binding would be unreachable. `event.code` still says `"KeyG"`.
 *  - AZERTY / German / Nordic: the unshifted number row emits `& é " '` and the
 *    brackets sit behind AltGr, so `event.key === "1"` or `"["` never arrives.
 *
 * This is an *additional* candidate, never a replacement, so a user on a Latin
 * layout keeps matching the letters printed on their keycaps.
 */
export function codeFallbackChord(event: KeyboardEventLike, isMac = false): Chord | null {
  const code = event.code;
  if (!code) return null;

  let key: string | null = null;
  if (/^Key[A-Z]$/.test(code)) key = code.slice(3).toLowerCase();
  else if (/^Digit[0-9]$/.test(code)) key = code.slice(5);
  else if (POSITIONAL_CODES[code]) key = POSITIONAL_CODES[code];
  if (!key) return null;

  // The layout already produced exactly this character; nothing to add.
  if (event.key === key) return null;
  // A Latin letter or digit came through as itself; the primary chord covers it.
  if (event.key.length === 1 && /[a-z0-9]/i.test(event.key) && key === event.key.toLowerCase()) return null;

  const chord: Chord = { key };
  if (isMac ? event.metaKey : event.ctrlKey) chord.mod = true;
  if (event.altKey) chord.alt = true;
  // Shift is not recorded for a positional punctuation match: on the layouts
  // this fallback exists to serve, the character usually *requires* a modifier.
  if (event.shiftKey && !POSITIONAL_CODES[code]) chord.shift = true;
  return chord;
}

/** All chords an event could reasonably mean, most-specific first. */
export function chordCandidates(event: KeyboardEventLike, isMac = false): Chord[] {
  const primary = chordFromKeyboardEvent(event, isMac);
  const fallback = codeFallbackChord(event, isMac);
  if (!fallback || chordsEqual(primary, fallback)) return [primary];
  return [primary, fallback];
}

/** Render a chord for the help sheet, e.g. `Ctrl K`, `⌘K`, `Shift G`. */
export function formatChord(chord: Chord, isMac = false): string {
  const parts: string[] = [];
  if (chord.mod) parts.push(isMac ? "⌘" : "Ctrl");
  if (chord.alt) parts.push(isMac ? "⌥" : "Alt");
  if (chord.shift) parts.push(isMac ? "⇧" : "Shift");
  parts.push(KEY_LABELS[chord.key] ?? (chord.key.length === 1 ? chord.key.toUpperCase() : chord.key));
  return parts.join(isMac ? "" : " ");
}

export function formatSequence(chords: Chord[], isMac = false): string {
  return chords.map((chord) => formatChord(chord, isMac)).join(" then ");
}
