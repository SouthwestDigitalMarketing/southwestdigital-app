import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { APP_COMMANDS, BUILDER_STEPS, NAV_DESTINATIONS } from "./commands";
import { activeBindings, flattenCommands, helpGroups, validateCommands } from "./registry";
import { detectSequenceConflicts } from "./sequences";
import { chordAllowedWhileTyping } from "./typingContext";

const flat = flattenCommands(APP_COMMANDS);

describe("the app keymap", () => {
  it("is structurally valid", () => {
    expect(validateCommands(flat)).toEqual([]);
  });

  it("has no shadowed or duplicated key sequences in any scope combination", () => {
    // Every scope set a user can actually be in: global alone, and global plus
    // each contextual scope. A conflict only matters within a live combination.
    const combinations: Array<Set<"global" | "list" | "builder">> = [
      new Set(["global"]),
      new Set(["global", "list"]),
      new Set(["global", "builder"]),
      new Set(["global", "list", "builder"]),
    ];

    combinations.forEach((scopes) => {
      const conflicts = detectSequenceConflicts(activeBindings(flat, scopes));
      expect(conflicts, `conflicts in scopes [${[...scopes].join(", ")}]`).toEqual([]);
    });
  });

  it("binds nothing that a browser reserves", () => {
    // Ctrl+digit switches Chrome tabs; Ctrl+Shift+K opens the Firefox console;
    // Ctrl+Alt+<key> is AltGr on EU layouts. None may appear in the keymap.
    flat.forEach((command) => {
      (command.sequence ?? []).forEach((chord) => {
        expect(
          Boolean(chord.mod) && /^[0-9]$/.test(chord.key),
          `${command.id} binds a reserved Ctrl+digit`,
        ).toBe(false);
        expect(
          Boolean(chord.mod) && Boolean(chord.alt),
          `${command.id} binds Ctrl+Alt, which is AltGr on EU layouts`,
        ).toBe(false);
        expect(
          Boolean(chord.mod) && Boolean(chord.shift) && chord.key === "k",
          `${command.id} binds Ctrl+Shift+K, the Firefox console`,
        ).toBe(false);
        expect(chord.key, `${command.id} binds the space bar`).not.toBe("space");
      });
    });
  });

  it("never dispatches Enter from the document", () => {
    // A global Enter binding must call preventDefault whenever its scope is
    // live, which swallows Enter on every focused link and button on the page.
    // Enter belongs to whichever element is focused; the row handles its own.
    activeBindings(flat, new Set(["global", "list", "builder"])).forEach((binding) => {
      binding.sequence.forEach((chord) => {
        expect(chord.key, `${String(binding.id)} dispatches Enter globally`).not.toBe("enter");
      });
    });
  });

  it("keeps focused-widget arrows out of the global dispatcher", () => {
    const bindings = activeBindings(flat, new Set(["global", "list", "builder"]));
    for (const binding of bindings) {
      expect(binding.sequence.some((chord) => ["up", "down"].includes(chord.key))).toBe(false);
    }
  });

  it("dispatches builder steps through offer-aware handlers", () => {
    for (const step of BUILDER_STEPS) {
      const command = flat.find((item) => item.id === step.id);
      expect(command?.action).toBe(step.id);
      expect(command?.href).toBeUndefined();
    }
  });

  it("still documents Enter and o in the help sheet", () => {
    // Documentation-only commands must remain visible, or a working shortcut
    // becomes undiscoverable.
    const shown = helpGroups(flat).flatMap((group) => group.commands.map((c) => c.id));
    expect(shown).toContain("list.open");
  });

  it("keeps the command menu reachable from inside a text field", () => {
    const menu = flat.find((command) => command.id === "menu.open");
    expect(menu?.sequence).toHaveLength(1);
    expect(chordAllowedWhileTyping(menu!.sequence![0])).toBe(true);
  });

  it("uses only single-key or two-key sequences, so nothing is a memory test", () => {
    flat.forEach((command) => {
      expect((command.sequence ?? []).length, `${command.id}`).toBeLessThanOrEqual(2);
    });
  });

  it("routes every navigation command to an internal path", () => {
    flat
      .filter((command) => command.href)
      .forEach((command) => {
        expect(command.href!.startsWith("/"), command.id).toBe(true);
        expect(command.href!.startsWith("//"), command.id).toBe(false);
      });
  });

  it("shows every bound command in the help sheet unless deliberately hidden", () => {
    const groups = helpGroups(flat);
    const shown = groups.flatMap((group) => group.commands.map((command) => command.id));
    const bound = flat.filter((command) => command.keys && !command.hiddenFromHelp).map((command) => command.id);
    expect(shown.sort()).toEqual(bound.sort());
  });

  it("gives menu-only destinations aliases, since they have no chord to remember", () => {
    NAV_DESTINATIONS.filter((destination) => !destination.keys).forEach((destination) => {
      expect(destination.aliases?.length, `${destination.id} needs aliases`).toBeGreaterThan(0);
    });
  });

  it("numbers the builder steps 1..8 in flow order", () => {
    expect(BUILDER_STEPS.map((step) => step.digit)).toEqual(["1", "2", "3", "4", "5", "6", "7", "8"]);
  });
});

describe("keymap drift guards", () => {
  /**
   * The sidebar is the other place these destinations are declared. Importing
   * AppShell here would drag React, lucide and next/navigation into a
   * node-environment test, so we read it as text instead — cheap, and it still
   * fails loudly the moment the two lists disagree.
   */
  it("covers every destination in the AppShell sidebar", () => {
    const source = readFileSync("src/app/(app)/AppShell.tsx", "utf8");
    const navBlock = source.slice(source.indexOf("const NAV"), source.indexOf("const TOOL_ICONS"));
    const hrefs = [...navBlock.matchAll(/href:\s*"([^"]+)"/g)].map((match) => match[1]);

    expect(hrefs.length).toBeGreaterThan(0);
    const commandHrefs = new Set(NAV_DESTINATIONS.map((destination) => destination.href));
    hrefs.forEach((href) => {
      expect(commandHrefs.has(href), `sidebar route ${href} is missing from NAV_DESTINATIONS`).toBe(true);
    });
  });

  it("points every builder step at a real stepper route", () => {
    const source = readFileSync("src/app/(app)/offers/builder/ProposalAppDemoStepper.tsx", "utf8");
    const hrefs = new Set([...source.matchAll(/href:\s*"([^"]+)"/g)].map((match) => match[1]));

    expect(hrefs.size).toBeGreaterThan(0);
    BUILDER_STEPS.forEach((step) => {
      expect(hrefs.has(step.href), `builder step ${step.id} points at ${step.href}, which the stepper does not define`).toBe(true);
    });
  });
});
