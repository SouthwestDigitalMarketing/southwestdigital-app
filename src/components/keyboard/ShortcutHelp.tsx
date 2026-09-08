"use client";

import { useMemo, useState } from "react";
import { Modal } from "@/components/Modal";
import { formatSequence } from "@/lib/keyboard/chords";
import { helpGroups, isRunnable, type FlatCommand } from "@/lib/keyboard/registry";
import { useKeyboard } from "./KeyboardProvider";

/**
 * The keyboard help sheet.
 *
 * Rows are **executable**, not just listed. That is the most Omarchy thing in
 * here: `SUPER + K` runs `omarchy-menu-keybindings`, which ends by dispatching
 * whichever binding you picked. There is no dead cheat-sheet anywhere in that
 * system, and there should not be one here either — the help screen is a way to
 * *do* the thing while you learn its key.
 */
export function ShortcutHelp() {
  const {
    commands,
    isMac,
    closeHelp,
    runCommand,
    isCommandAvailable,
    singleKeyShortcutsEnabled,
    setSingleKeyShortcutsEnabled,
  } = useKeyboard();

  const [filter, setFilter] = useState("");

  const groups = useMemo(() => {
    const all = helpGroups(commands);
    const needle = filter.trim().toLowerCase();
    if (!needle) return all;
    return all
      .map((group) => ({
        group: group.group,
        commands: group.commands.filter(
          (command) =>
            command.title.toLowerCase().includes(needle) ||
            group.group.toLowerCase().includes(needle) ||
            (command.keys ?? "").toLowerCase().includes(needle),
        ),
      }))
      .filter((group) => group.commands.length > 0);
  }, [commands, filter]);

  return (
    <Modal onClose={closeHelp} labelledBy="shortcut-help-title" className="ui-shortcut-help">
      <div className="flex h-full flex-col">
        <div className="ui-shortcut-help-header">
          <div>
            <h2 id="shortcut-help-title" className="text-xl font-semibold">
              Keyboard shortcuts
            </h2>
            <p className="ui-shortcut-help-subtitle">
              Press an available row to run it. Enter opens a row when that row has focus.
            </p>
          </div>
          <kbd className="ui-kbd">?</kbd>
        </div>

        <div className="ui-shortcut-help-search">
          <label className="sr-only" htmlFor="shortcut-help-filter">
            Filter shortcuts
          </label>
          <input
            id="shortcut-help-filter"
            autoFocus
            type="text"
            value={filter}
            onChange={(event) => setFilter(event.target.value)}
            placeholder="Filter shortcuts…"
            className="ui-shortcut-help-input"
          />
        </div>

        <div className="ui-shortcut-help-body">
          {groups.length === 0 ? (
            <p className="ui-command-menu-empty">No matching shortcuts</p>
          ) : (
            groups.map((group) => (
              <section key={group.group} className="ui-shortcut-help-group">
                <h3 className="ui-shortcut-help-group-title">{group.group}</h3>
                <ul className="ui-shortcut-help-list">
                  {group.commands.map((command) => (
                    <ShortcutRow
                      key={command.id}
                      command={command}
                      isMac={isMac}
                      /* A scoped binding only fires where it applies; saying so
                         prevents "I pressed j and nothing happened". */
                      available={isCommandAvailable(command)}
                      onRun={() => runCommand(command)}
                    />
                  ))}
                </ul>
              </section>
            ))
          )}
        </div>

        <div className="ui-shortcut-help-footer">
          <label className="ui-shortcut-help-toggle">
            <input
              type="checkbox"
              checked={!singleKeyShortcutsEnabled}
              onChange={(event) => setSingleKeyShortcutsEnabled(!event.target.checked)}
            />
            <span>
              Turn off single-key shortcuts
              <span className="ui-shortcut-help-toggle-note">
                Keeps {formatSequence([{ key: "k", mod: true }], isMac)} and other modifier shortcuts working.
              </span>
            </span>
          </label>
          <button type="button" onClick={closeHelp} className="ui-action-secondary rounded-lg px-3 py-2 text-sm font-semibold">
            Close
          </button>
        </div>
      </div>
    </Modal>
  );
}

function ShortcutRow({
  command,
  isMac,
  available,
  onRun,
}: {
  command: FlatCommand;
  isMac: boolean;
  available: boolean;
  onRun: () => void;
}) {
  const label = command.sequence ? formatSequence(command.sequence, isMac) : "";
  const runnable = isRunnable(command) && available && !command.documentationOnly;

  return (
    <li>
      <button
        type="button"
        onClick={onRun}
        disabled={!runnable}
        title={command.documentationOnly ? "Use this key on the focused row" : available ? undefined : "Unavailable on this page"}
        className="ui-shortcut-help-row"
      >
        <span className="ui-shortcut-help-row-title">{command.title}</span>
        <kbd className="ui-kbd">{label}</kbd>
      </button>
    </li>
  );
}
