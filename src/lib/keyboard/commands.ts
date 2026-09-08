/**
 * The app's keymap and command menu.
 *
 * Shaped after Omarchy's own conventions, which this app's primary user lives
 * in daily:
 *  - A small set of memorable direct chords, and everything else reachable
 *    through the menu. Omarchy binds ~12 keys directly and leaves ~180 menu
 *    items to `SUPER+SPACE`; that restraint is what keeps a keymap learnable.
 *  - `g` as a press-then-press leader, the closest web analogue to a held SUPER.
 *  - Menu-only entries carry aliases instead of strained mnemonics.
 *
 * Deliberately NOT bound (each of these is actively hostile in a browser):
 *  - `Ctrl+digit`      — Chrome tab switching. Builder steps use bare digits.
 *  - `Ctrl+Shift+K`    — Firefox Web Console.
 *  - `Ctrl+Alt+<key>`  — AltGr is Ctrl+Alt on EU layouts; would fire while
 *                        typing `@`, `{`, `}` or `€`.
 *  - bare `Space`      — page scroll is too valuable to take.
 *  - `Ctrl+F`          — find-in-page is a keyboard user's universal fallback.
 */

import type { Command } from "./registry";

/**
 * Primary destinations, in sidebar order.
 *
 * `keys` is present only where a first-letter mnemonic is genuinely memorable.
 * Discounts, Team, Media and Tags are menu-only by design — an unmemorable
 * chord is worse than no chord.
 */
export const NAV_DESTINATIONS: Array<{
  id: string;
  title: string;
  href: string;
  keys?: string;
  aliases?: string[];
}> = [
  { id: "nav.dashboard", title: "Dashboard", href: "/dashboard", keys: "g d", aliases: ["home"] },
  { id: "nav.website", title: "Website", href: "/website", keys: "g w" },
  { id: "nav.youtube", title: "YouTube", href: "/youtube", keys: "g y" },
  { id: "nav.reviews", title: "Reviews", href: "/reviews", keys: "g r" },
  { id: "nav.contacts", title: "Contacts", href: "/contacts", keys: "g c", aliases: ["people", "leads"] },
  { id: "nav.pipeline", title: "CRM", href: "/pipeline", keys: "g p", aliases: ["crm", "pipeline", "deals"] },
  { id: "nav.services", title: "Services", href: "/services", keys: "g s", aliases: ["catalog", "catalogue"] },
  { id: "nav.offers", title: "Offers", href: "/offers", keys: "g o", aliases: ["proposals", "quotes"] },
  { id: "nav.agreements", title: "Agreements", href: "/agreements", keys: "g a", aliases: ["contracts"] },
  { id: "nav.discounts", title: "Discounts", href: "/discounts", aliases: ["coupons", "promos"] },
  { id: "nav.clients", title: "Clients", href: "/clients", keys: "g l", aliases: ["customers", "accounts"] },
  { id: "nav.team", title: "Team", href: "/team", aliases: ["staff", "users", "members"] },
  { id: "nav.media", title: "Media", href: "/media", aliases: ["images", "files", "library"] },
  { id: "nav.tags", title: "Tags", href: "/tags", aliases: ["labels"] },
  { id: "nav.settings", title: "Settings", href: "/settings", keys: "g ,", aliases: ["preferences", "config"] },
];

/** Offer-builder steps, in flow order. Bare digits jump straight to one. */
export const BUILDER_STEPS: Array<{ id: string; title: string; href: string; digit: string }> = [
  { id: "builder.step.contact", title: "Contact", href: "/offers/contact", digit: "1" },
  { id: "builder.step.scale", title: "Scale", href: "/offers/scale", digit: "2" },
  { id: "builder.step.complexity", title: "Complexity", href: "/offers/complexity", digit: "3" },
  { id: "builder.step.services", title: "Services", href: "/offers/add-ons", digit: "4" },
  { id: "builder.step.adjustments", title: "Adjustments", href: "/offers/adjustments", digit: "5" },
  { id: "builder.step.style", title: "Style", href: "/offers/intro", digit: "6" },
  { id: "builder.step.publish", title: "Publish", href: "/offers/finalize", digit: "7" },
  { id: "builder.step.email", title: "Email", href: "/offers/cover", digit: "8" },
];

export const APP_COMMANDS: Command[] = [
  {
    id: "go",
    title: "Go",
    group: "Navigation",
    description: "Jump to a section of the app",
    aliases: ["navigate", "open"],
    children: NAV_DESTINATIONS.map((destination) => ({
      id: destination.id,
      title: destination.title,
      href: destination.href,
      keys: destination.keys,
      aliases: destination.aliases,
      group: "Go to",
    })),
  },
  {
    id: "offers",
    title: "Offers",
    group: "Offers",
    description: "Create and manage proposals",
    aliases: ["proposals", "quotes"],
    children: [
      {
        id: "offers.new.bookkeeping",
        title: "New bookkeeping offer",
        href: "/offers/contact",
        group: "Offers",
        aliases: ["create proposal", "new quote"],
      },
      {
        id: "offers.new.hourly",
        title: "New hourly offer",
        href: "/offers/hourly",
        group: "Offers",
        aliases: ["consulting", "coaching"],
      },
      { id: "offers.manage", title: "Manage offers", href: "/offers", group: "Offers" },
      {
        id: "offers.optionsTemplates",
        title: "Options templates",
        href: "/offers/options-templates",
        group: "Offers",
        aliases: ["service templates"],
      },
    ],
  },
  {
    id: "agreements",
    title: "Agreements",
    group: "Agreements",
    aliases: ["contracts"],
    children: [
      { id: "agreements.issued", title: "Issued agreements", href: "/agreements", group: "Agreements" },
      {
        id: "agreements.templates",
        title: "Agreement templates",
        href: "/agreements/templates",
        group: "Agreements",
      },
    ],
  },
  {
    id: "builder",
    title: "Offer builder step",
    group: "Builder",
    description: "Jump to a step of the current offer",
    aliases: ["step"],
    children: BUILDER_STEPS.map((step) => ({
      id: step.id,
      title: step.title,
      href: step.href,
      keys: step.digit,
      scope: "builder" as const,
      group: "Builder step",
    })),
  },
  {
    id: "settings.group",
    title: "Settings",
    group: "Settings",
    aliases: ["preferences"],
    children: [
      { id: "settings.general", title: "General settings", href: "/settings", group: "Settings" },
      { id: "settings.tags", title: "Tag settings", href: "/settings/tags", group: "Settings" },
    ],
  },
  {
    id: "keyboard",
    title: "Keyboard",
    group: "Keyboard",
    aliases: ["shortcuts", "keys", "keybindings"],
    children: [
      {
        id: "keyboard.help",
        title: "Keyboard shortcuts",
        action: "help.open",
        keys: "?",
        group: "Keyboard",
        aliases: ["cheat sheet", "bindings"],
      },
      {
        id: "keyboard.toggleSingleKey",
        title: "Toggle single-key shortcuts",
        action: "prefs.toggleSingleKeyShortcuts",
        group: "Keyboard",
        description: "Turn off shortcuts that fire without a modifier",
        aliases: ["accessibility"],
      },
    ],
  },

  // --- Bound but not shown as menu rows ------------------------------------
  // These are motions and doors, not destinations; listing them in the menu
  // would be noise. They still appear in the help sheet.
  {
    id: "menu.open",
    title: "Open command menu",
    action: "menu.open",
    keys: "mod+k",
    group: "Global",
    hiddenFromMenu: true,
  },
  {
    id: "search.focus",
    title: "Search this page",
    action: "search.focus",
    keys: "/",
    group: "Global",
    hiddenFromMenu: true,
  },
  {
    id: "list.next",
    title: "Next row",
    action: "list.next",
    keys: "j",
    scope: "list",
    group: "Lists",
    hiddenFromMenu: true,
  },
  {
    id: "list.next.arrow",
    title: "Next row",
    action: "list.next",
    keys: "down",
    scope: "list",
    group: "Lists",
    hiddenFromMenu: true,
    hiddenFromHelp: true,
  },
  {
    id: "list.previous",
    title: "Previous row",
    action: "list.previous",
    keys: "k",
    scope: "list",
    group: "Lists",
    hiddenFromMenu: true,
  },
  {
    id: "list.previous.arrow",
    title: "Previous row",
    action: "list.previous",
    keys: "up",
    scope: "list",
    group: "Lists",
    hiddenFromMenu: true,
    hiddenFromHelp: true,
  },
  {
    id: "list.open",
    title: "Open focused row",
    action: "list.open",
    keys: "enter",
    scope: "list",
    group: "Lists",
    hiddenFromMenu: true,
  },
  {
    id: "list.open.alias",
    title: "Open focused row",
    action: "list.open",
    keys: "o",
    scope: "list",
    group: "Lists",
    hiddenFromMenu: true,
    hiddenFromHelp: true,
  },
  {
    id: "list.top",
    title: "First row",
    action: "list.top",
    keys: "g g",
    scope: "list",
    group: "Lists",
    hiddenFromMenu: true,
  },
  {
    id: "list.bottom",
    title: "Last row",
    action: "list.bottom",
    keys: "shift+g",
    scope: "list",
    group: "Lists",
    hiddenFromMenu: true,
  },
  {
    id: "builder.previousStep",
    title: "Previous step",
    action: "builder.previousStep",
    keys: "[",
    scope: "builder",
    group: "Builder",
    hiddenFromMenu: true,
  },
  {
    id: "builder.nextStep",
    title: "Next step",
    action: "builder.nextStep",
    keys: "]",
    scope: "builder",
    group: "Builder",
    hiddenFromMenu: true,
  },
];
