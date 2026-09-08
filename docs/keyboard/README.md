# Keyboard-first SWapp

The staff app provides keyboard navigation and native control access. This document is the reference for the
keymap, the reasoning behind it, and how to extend it.

Design brief: someone fluent in **Omarchy** keyboard use should find this app a
native-feeling keyboard experience, while mouse-first users notice no change at
all. Every shortcut is a *second* path to something that is already clickable.

---

## 1. Principles

1. **Additive, never substitutive.** No shortcut is the only way to do anything.
   If a keystroke is the sole path to a feature, that is a bug.
2. **Never steal a keystroke meant for text.** Single-key shortcuts do not fire
   in an input, textarea, select, contenteditable, or any subtree marked
   `data-keyboard-ignore`. Only modifier chords and `Escape` survive a text
   field, and IME composition is left strictly alone.
3. **One registry.** The keymap, the command menu and the help sheet are all
   generated from `src/lib/keyboard/commands.ts`. They cannot drift apart. This
   mirrors how `omarchy-menu.jsonc` drives Omarchy's menu, its keybinding
   browser and its dispatcher from one file.
4. **Discoverable or it does not exist.** `?` lists everything, the menu shows
   each row's chord as you browse, and an armed prefix is displayed on screen.
5. **Restraint.** A small set of memorable chords, everything else through the
   menu. Omarchy binds about twelve keys directly and leaves ~180 menu entries
   to `SUPER+SPACE`; that discipline is what keeps a keymap learnable.

---

## 2. The keymap

### Global

| Key | Action |
|---|---|
| `Ctrl`/`Cmd` + `K` | Open the **Go** menu (works even while typing) |
| `?` | Keyboard shortcuts — rows are runnable |
| `/` | Focus this page's search box |
| `Esc` | Close the top layer; in the menu, clear the filter first |

### Go to

`g` is a leader: press it, release, then press the second key.

| Chord | Destination | | Chord | Destination |
|---|---|---|---|---|
| `g d` | Dashboard | | `g s` | Services |
| `g w` | Website | | `g o` | Offers |
| `g y` | YouTube | | `g a` | Agreements |
| `g r` | Reviews | | `g l` | Clients |
| `g c` | Contacts | | `g ,` | Settings |
| `g p` | CRM | | | |

**Discounts, Team, Media and Tags have no chord on purpose.** They are lower
traffic, and an unmemorable chord is worse than none. Reach them through the
menu — each carries aliases, so `Ctrl+K` then `coupons`, `staff`, `images` or
`labels` finds them.

### Lists

Live on any list with a keyboard cursor.

| Key | Action |
|---|---|
| `j` | Next row |
| `k` | Previous row |
| `↓` / `↑` | Next / previous row, only when the row itself has focus |
| `Enter` / `o` | Open the focused row |
| `g g` | First row |
| `Shift` + `G` | Last row |

Lists use a **roving tabindex**: one row is tabbable at a time, and `j`/`k`
moves that row cursor. Inner buttons remain independently tabbable; the roving
cursor does not remove those native tab stops.

Coverage: Offers, Contacts, Clients, Agreements, Services, Tags, Discounts,
Media, the pipeline index, and cards within a pipeline. Enter opens an inline
editor on catalogue lists. On Offers it edits drafts, and opens authorized staff
preview for published offers so it cannot bypass the edit warning. Search `/`
focuses the existing search input on Contacts and Clients; on pages with no
search handler the key is left to the browser.

`o` respects the single-key opt-out; Enter and row-local arrows remain available
as ordinary focused-element controls. In a `g o` sequence, the `o` belongs to
navigation even if a row has focus. List shortcuts stand down during inline
editing and while a native modal or popover is open.

### Offer builder

| Key | Action |
|---|---|
| `1` … `8` | Jump to that step |
| `[` / `]` | Previous / next step |

Digits and menu step actions use the same offer-aware navigation as the stepper,
preserving the current query string. Bare digits are guarded while typing. Never
change them to `Ctrl`+digit — see §4.

---

## 3. The Go menu

`Ctrl+K` opens this app's answer to `SUPER+SPACE`. The key contract is lifted
from Omarchy's `Menu.qml` so the muscle memory transfers exactly:

| Key | Behaviour |
|---|---|
| any character | Filters immediately — there is no "focus the search box" step |
| `↓` / `↑` | Move the cursor |
| `PageDown` / `PageUp` | ±6 rows |
| `Enter` / `→` | Run the row, or descend into a submenu |
| `Backspace` / `←` | Up one level — **only when the filter is empty** |
| `Esc` | Filter non-empty: clear it. Filter empty: close. |
| `Ctrl+U` | Clear the filter |

Two properties are worth protecting when editing this:

- **Search is scoped to the current subtree and drills down.** Results split
  into rows at your current level and rows deeper in the tree, divided, with the
  deeper ones subtitled by their parent path. Search widens your reach without
  moving you out of context.
- **Matching is substring + aliases, not fuzzy subsequence.** Typing `thm` does
  *not* find "Theme". This is deliberate and matches Omarchy: literal matching
  is more predictable, and aliases carry the slack. Subsequence survives only as
  a last-resort tier so the pane is never empty. Add an alias rather than
  loosening the matcher.

There is deliberately **no `j`/`k` in the menu** — printable characters belong
to the filter. Omarchy has the same constraint and resolves it the same way.

---

## 4. What is never bound, and why

Do not bind any of these. Each is either impossible to override or actively
hostile, and `src/lib/keyboard/commands.test.ts` fails the build on the first
three.

| Chord | Why |
|---|---|
| `Ctrl`+digit | Chrome tab switching. This is why builder steps use **bare** digits. |
| `Ctrl+Shift+K` | Firefox Web Console. Very tempting as a second palette door. |
| `Ctrl+Alt+<key>` | **AltGr is Ctrl+Alt on EU layouts.** A German or Polish user typing `@`, `{`, `}` or `€` would fire the shortcut. |
| bare `Space` | Page scroll is the most-used key in a browser. |
| `Ctrl+F` | Find-in-page is a keyboard user's universal fallback. |
| `Ctrl+T` / `N` / `W`, `Ctrl+Tab`, `Ctrl+L`, `F5`, `F11`, `F12` | Reserved by the browser; `preventDefault` is ignored. |

Two non-obvious rules the implementation depends on:

- **The queued prefix is prevented too, not just the completed chord.** Press
  `g` and we call `preventDefault` immediately. Without that, Firefox's
  quick-find swallows the second key of every sequence.
- **`preventDefault` only fires once a binding actually matches.** Anything we
  do not handle reaches the browser untouched.

### Keyboard layouts

Mnemonics match `event.key`, so `g c` follows the letter printed on the keycap
on Dvorak, Colemak and AZERTY alike. Digits and brackets additionally match
`event.code`, because AZERTY's unshifted number row emits `& é " '` and German
keyboards put `[` behind AltGr — `event.key` never produces them.

Hyprland makes exactly the same split: Omarchy binds workspaces as `code:10`..
`code:19` (physical number row) while binding mnemonic letters by keysym.

---

## 5. Accessibility

Single-character shortcuts are a known problem for speech-input and switch-
device users, whose input can emit stray characters. **The help sheet (`?`)
carries a "Turn off single-key shortcuts" toggle**, persisted per browser.
With it on, only modifier chords fire. GitHub ships the same setting.

Also present: a skip-to-content link (the sidebar is ~18 tab stops and is the
first thing focused on every page load), `aria-current` on the active nav and
builder step, and `:focus-visible` rings on every interactive control so
clicking never paints a ring.

---

## 6. Adding a command

Edit `src/lib/keyboard/commands.ts`. Nothing else needs touching — the menu,
the help sheet and the key dispatcher all read from it.

```ts
{
  id: "offers.new.hourly",          // unique; dotted ids imply hierarchy
  title: "New hourly offer",
  href: "/offers/hourly",           // OR action: "some.action"
  group: "Offers",                  // heading in the help sheet
  keys: "g h",                      // optional chord; omit for menu-only
  aliases: ["consulting", "coaching"],
  scope: "global",                  // global | list | builder
}
```

- `href` must be an **internal path** starting with a single `/`. Next's router
  will execute a `javascript:` URL handed to `router.push`, so this is enforced
  by `validateCommands` and pinned by a test.
- Use `action` for anything that is not navigation, then register a handler with
  `useKeyboardAction("some.action", handler)` in the component that owns it. The
  most recently mounted handler wins, so a modal naturally takes precedence over
  the page behind it.
- Use `documentationOnly: true` for keys owned by a focused element, such as
  Enter and arrows. They appear in help but are never global bindings.
- Action commands without a mounted handler are inactive and do not consume a
  key. The menu filters out unavailable contextual commands; help shows them
  disabled. Documentation-only help rows are also disabled.
- Scoped commands only fire while a component has called
  `useKeyboardScope("list" | "builder")`.
- Run `npx vitest run src/lib/keyboard` after any change. The suite checks for
  shadowed and duplicate sequences in every scope combination, reserved-key
  violations, and drift against the sidebar and the builder stepper.

---

## 7. Optional: bringing SUPER into the app (Hyprland only)

The browser never sees the SUPER key — Hyprland consumes it, and a bare Super
keypress is not delivered to the page. `Ctrl+K` is the in-app door and is
entirely self-sufficient.

If you want `SUPER+SPACE` to open the Go menu *while the app is focused* and
still open `omarchy-menu` everywhere else, Hyprland can translate the chord and
inject it into the focused window. Omarchy already ships this technique for
universal copy/paste — see `/usr/share/omarchy/default/hypr/bindings/clipboard.lua`,
which branches on the focused window before dispatching `send_key_state`.

This belongs in your dotfiles, not in the app. Sketch for
`~/.config/hypr/bindings.lua`:

```lua
-- Find your app window's class first:  hyprctl activewindow | grep class
local SWAPP_CLASS_PATTERN = "app%.bookkeepingconroe%.com"

local function active_window_is_swapp()
  local window = hl.get_active_window()
  if not window then return false end
  return (window.class or ""):match(SWAPP_CLASS_PATTERN) ~= nil
end

-- Down/up split, per the note in clipboard.lua: Hyprland's send_shortcut can
-- otherwise leave synthetic key state stuck.
local function send_ctrl_k()
  hl.dispatch(hl.dsp.send_key_state({ mods = "CTRL", key = "k", state = "down" }))
  hl.timer(function()
    hl.dispatch(hl.dsp.send_key_state({ mods = "CTRL", key = "k", state = "up" }))
  end, { timeout = 50, type = "oneshot" })
end

o.bind("SUPER + SPACE", "Omarchy menu / SWapp menu", function()
  if active_window_is_swapp() then send_ctrl_k()
  else hl.system("omarchy-menu toggle") end
end)
```

Worth pairing with a launcher bind, matching how Omarchy treats web apps as
first-class windows in `applications.lua`:

```lua
o.bind("SUPER + SHIFT + S", "SWapp", { webapp = "https://app.bookkeepingconroe.com" })
```

`omarchy-launch-webapp` opens Chromium with `--app=`, i.e. no tab strip and no
address bar — which also means no browser chrome competing for your keystrokes.

---

## 8. Where the code lives

| Path | What |
|---|---|
| `src/lib/keyboard/commands.ts` | **The keymap.** Start here. |
| `src/lib/keyboard/chords.ts` | Key normalization, layout fallbacks, display |
| `src/lib/keyboard/sequences.ts` | Multi-key sequence state machine + conflict detection |
| `src/lib/keyboard/menuSearch.ts` | Omarchy-style substring/alias ranking |
| `src/lib/keyboard/typingContext.ts` | The "is the user typing" guard |
| `src/lib/keyboard/listNavigation.ts` | Pure list-cursor math |
| `src/lib/keyboard/registry.ts` | Flattening, scoping, help grouping, validation |
| `src/components/keyboard/KeyboardProvider.tsx` | The single global key listener |
| `src/components/keyboard/CommandMenu.tsx` | The Go menu |
| `src/components/keyboard/ShortcutHelp.tsx` | The `?` sheet |
| `src/components/keyboard/KeyboardListRegion.tsx` | Shared cursor for server tables and client lists |
| `src/components/keyboard/useListKeyboard.ts` | `useSearchFocusShortcut` |
| `src/components/keyboard/SearchInput.tsx` | Reusable input with the page search shortcut |

Everything in `src/lib/keyboard/` is pure TypeScript with no React and no DOM
globals at module scope, so the node-environment vitest suite covers it
directly. Keep it that way: the React layer should stay thin enough that its
logic is not worth testing.


## 9. Resizing, stage movement, and browser checks

The sidebar separator is tabbable: Left/Right resize by 16 pixels, Home
collapses, and End expands to its maximum. Pointer dragging uses the same width
state. Its grab area stays inside the sidebar so it cannot add horizontal overflow.

Pipeline cards open with Enter or a click. Their details dialog already provides
**Move to stage** buttons; Tab to the desired stage and press Enter. This reuses
the same authorized action as dragging a card.

Run `npm run dev`, then `npm run test:e2e`. The browser suite fails explicitly if
the server is unavailable; record-dependent cases identify missing fixtures as
skips. Run a single Playwright process at a time: overlapping runs sharing the
default output directory overwrite each other's traces. Authentication cookies
are reused in memory within a worker; every test gets fresh localStorage and a
fresh browser context. Cookies are never saved as an auth-state file.

`e2e/keyboard-completion.spec.ts` covers query preservation, native control keys,
modal isolation, opt-out, list editors and sorting, safe offer opening, and sidebar
resizing. Overlay tests exercise the contact-detail assignment picker, template
popover, fullscreen preview and logo file chooser. They do not toggle real client
assignments or move real pipeline cards.

A query-only fullscreen-preview exit uses Next.js's integrated native History API
so closing the modal does not wait for a server/database refetch.
