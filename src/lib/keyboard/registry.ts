/**
 * The command registry: one source of truth for shortcuts, the command menu and
 * the help sheet.
 *
 * Keeping all three off the same data is the whole point. A keymap in one place
 * and a help dialog in another will drift within a month, and a shortcut nobody
 * can discover may as well not exist. This mirrors how Omarchy drives its menu,
 * its keybinding browser and its dispatcher from a single `omarchy-menu.jsonc`.
 */

import { parseSequence, type Chord } from "./chords";
import type { MenuEntry } from "./menuSearch";
import type { SequenceBinding } from "./sequences";

/**
 * Where a command is live.
 * - `global`  — everywhere in the authenticated app
 * - `list`    — only while a keyboard-navigable list is mounted
 * - `builder` — only inside the offer builder
 */
export type CommandScope = "global" | "list" | "builder";

export type Command = {
  id: string;
  title: string;
  /**
   * Established names a user might actually type. Kept sparse on purpose —
   * Omarchy's own guidance is that aliases are "reserved for established names
   * users already type", not a dumping ground for synonyms.
   */
  aliases?: string[];
  description?: string;
  group: string;
  /** Binding string such as `"g o"`. Omit for menu-only commands. */
  keys?: string;
  scope?: CommandScope;
  /** Internal path to navigate to. Must start with a single "/". */
  href?: string;
  /** Named action dispatched to whichever component registered it. */
  action?: string;
  /** Nested commands, for omarchy-menu style descent. */
  children?: Command[];
  /** Keep out of the help sheet (mechanical keys like Escape). */
  hiddenFromHelp?: boolean;
  /** Keep out of the menu (pure motions like j/k, which make no sense there). */
  hiddenFromMenu?: boolean;
};

export type FlatCommand = Command & {
  /** Ancestor titles, for the menu's breadcrumb and parent-path subtitle. */
  path: string[];
  parentId: string | null;
  depth: number;
  order: number;
  sequence: Chord[] | null;
};

/** Depth-first flatten, recording tree position for search ranking. */
export function flattenCommands(commands: readonly Command[]): FlatCommand[] {
  const flat: FlatCommand[] = [];
  let order = 0;

  function walk(items: readonly Command[], path: string[], parentId: string | null, depth: number) {
    items.forEach((command) => {
      flat.push({
        ...command,
        path,
        parentId,
        depth,
        order: order++,
        sequence: command.keys ? parseSequence(command.keys) : null,
      });
      if (command.children?.length) {
        walk(command.children, [...path, command.title], command.id, depth + 1);
      }
    });
  }

  walk(commands, [], null, 0);
  return flat;
}

export function isRunnable(command: Command): boolean {
  return Boolean(command.href || command.action);
}

export function isGroup(command: Command): boolean {
  return Boolean(command.children?.length);
}

/** Direct children of a menu level (null = root). */
export function childrenOf(commands: readonly FlatCommand[], parentId: string | null): FlatCommand[] {
  return commands.filter((command) => command.parentId === parentId && !command.hiddenFromMenu);
}

/** Adapt commands to the shape the Omarchy-style matcher searches. */
export function toMenuEntries(commands: readonly FlatCommand[]): Array<MenuEntry & { command: FlatCommand }> {
  return commands.map((command) => ({
    id: command.id,
    label: command.title,
    aliases: command.aliases,
    description: command.description,
    isGroup: isGroup(command),
    depth: command.depth,
    order: command.order,
    command,
  }));
}

/**
 * Commands reachable from a menu level: the subtree under `parentId`.
 *
 * Scoping search to the current subtree — rather than always searching
 * everything — is what lets the menu widen your reach without yanking you out
 * of the context you navigated into.
 */
export function subtreeCommands(
  commands: readonly FlatCommand[],
  parentId: string | null,
): FlatCommand[] {
  if (parentId === null) return commands.filter((command) => !command.hiddenFromMenu);

  const included = new Set<string>([parentId]);
  const result: FlatCommand[] = [];
  commands.forEach((command) => {
    if (command.parentId && included.has(command.parentId)) {
      included.add(command.id);
      if (!command.hiddenFromMenu) result.push(command);
    }
  });
  return result;
}

/** Bindings for the sequence matcher, filtered to the currently active scopes. */
export function activeBindings(
  commands: readonly FlatCommand[],
  scopes: ReadonlySet<CommandScope>,
): SequenceBinding[] {
  return commands
    .filter((command) => command.sequence && scopes.has(command.scope ?? "global"))
    .map((command) => ({ id: command.id, sequence: command.sequence as Chord[] }));
}

export type HelpGroup = {
  group: string;
  commands: FlatCommand[];
};

/** Bound, non-hidden commands grouped for the help sheet, in declaration order. */
export function helpGroups(commands: readonly FlatCommand[]): HelpGroup[] {
  const order: string[] = [];
  const byGroup = new Map<string, FlatCommand[]>();

  commands.forEach((command) => {
    if (!command.keys || command.hiddenFromHelp) return;
    if (!byGroup.has(command.group)) {
      byGroup.set(command.group, []);
      order.push(command.group);
    }
    byGroup.get(command.group)!.push(command);
  });

  return order.map((group) => ({ group, commands: byGroup.get(group)! }));
}

/**
 * Structural problems that should fail a test rather than reach a user.
 *
 * The href rule is a security check, not a style one: Next's router will happily
 * execute a `javascript:` URL handed to `router.push`, so commands are held to
 * same-origin internal paths.
 */
export function validateCommands(commands: readonly FlatCommand[]): string[] {
  const problems: string[] = [];
  const seenIds = new Set<string>();

  commands.forEach((command) => {
    if (seenIds.has(command.id)) problems.push(`Duplicate command id: ${command.id}`);
    seenIds.add(command.id);

    if (command.href && command.action) {
      problems.push(`Command "${command.id}" sets both href and action`);
    }
    if (command.href && !command.href.startsWith("/")) {
      problems.push(`Command "${command.id}" href must be an internal path starting with "/"`);
    }
    if (command.href && command.href.startsWith("//")) {
      problems.push(`Command "${command.id}" href "${command.href}" is protocol-relative and leaves the app`);
    }
    if (!isRunnable(command) && !isGroup(command)) {
      problems.push(`Command "${command.id}" does nothing and has no children`);
    }
    if (command.keys && !isRunnable(command)) {
      problems.push(`Command "${command.id}" has a shortcut but nothing to run`);
    }
  });

  return problems;
}
