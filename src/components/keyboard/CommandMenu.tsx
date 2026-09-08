"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { CornerDownLeft, Search } from "lucide-react";
import { Modal } from "@/components/Modal";
import { formatSequence } from "@/lib/keyboard/chords";
import { partitionByDepth, searchMenuEntries } from "@/lib/keyboard/menuSearch";
import {
  childrenOf,
  isGroup,
  subtreeCommands,
  toMenuEntries,
  type FlatCommand,
} from "@/lib/keyboard/registry";
import { useKeyboard } from "./KeyboardProvider";

/** Rows moved by a single PageUp/PageDown, matching Omarchy's menu. */
const PAGE_JUMP = 6;

type Row = { command: FlatCommand; section: "here" | "deeper" };

/**
 * The Go menu — this app's answer to `SUPER + SPACE`.
 *
 * The key contract is lifted from Omarchy's `Menu.qml` so the muscle memory
 * transfers exactly:
 *  - typing filters immediately; there is no "focus the search box" step
 *  - Backspace / ← goes up a level, but only when the filter is empty
 *  - Escape is two-stage: clear the filter, then close
 *  - Enter / → activates a row or descends into a submenu
 *  - search is scoped to the current subtree and splits into "here" and
 *    "deeper", so it widens your reach without moving you out of context
 *
 * There is deliberately no j/k here: printable characters belong to the filter.
 * Omarchy has the same constraint and resolves it the same way.
 */
export function CommandMenu() {
  const { commands, isMac, closeMenu, runCommand } = useKeyboard();
  const [query, setQuery] = useState("");
  const [parentId, setParentId] = useState<string | null>(null);
  const [requestedCursor, setCursor] = useState(0);

  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const parent = useMemo(
    () => (parentId ? commands.find((command) => command.id === parentId) ?? null : null),
    [commands, parentId],
  );
  const currentDepth = parent ? parent.depth + 1 : 0;

  const rows = useMemo<Row[]>(() => {
    if (query.trim() === "") {
      return childrenOf(commands, parentId).map((command) => ({ command, section: "here" as const }));
    }

    const scoped = subtreeCommands(commands, parentId);
    const results = searchMenuEntries(toMenuEntries(scoped), query);
    const { here, deeper } = partitionByDepth(results, currentDepth);
    return [
      ...here.map((result) => ({ command: result.entry.command, section: "here" as const })),
      ...deeper.map((result) => ({ command: result.entry.command, section: "deeper" as const })),
    ];
  }, [commands, parentId, query, currentDepth]);

  // Derived rather than corrected in an effect: as a narrowing query shrinks the
  // list, the cursor must already be in range on the very render that shows the
  // shorter list, or the wrong row is briefly marked active.
  const cursor = rows.length === 0 ? 0 : Math.min(requestedCursor, rows.length - 1);


  useEffect(() => {
    const active = listRef.current?.querySelector<HTMLElement>('[data-active="true"]');
    active?.scrollIntoView({ block: "nearest" });
  }, [cursor, rows]);

  const descend = useCallback((command: FlatCommand) => {
    setParentId(command.id);
    setQuery("");
    setCursor(0);
  }, []);

  const goBack = useCallback(() => {
    if (!parent) return false;
    setParentId(parent.parentId);
    setQuery("");
    setCursor(0);
    return true;
  }, [parent]);

  const activate = useCallback(
    (row: Row | undefined) => {
      if (!row) return;
      if (isGroup(row.command)) {
        descend(row.command);
        return;
      }
      runCommand(row.command);
    },
    [descend, runCommand],
  );

  const move = useCallback(
    (delta: number) => {
      setCursor((current) => {
        if (rows.length === 0) return 0;
        return Math.min(rows.length - 1, Math.max(0, current + delta));
      });
    },
    [rows.length],
  );

  const onKeyDown = useCallback(
    (event: React.KeyboardEvent) => {
      // The door toggles: pressing the open chord again closes the menu. The
      // global listener stands down while an overlay is open, so this has to be
      // handled here.
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        closeMenu();
        return;
      }

      switch (event.key) {
        case "ArrowDown":
          event.preventDefault();
          move(1);
          return;
        case "ArrowUp":
          event.preventDefault();
          move(-1);
          return;
        case "PageDown":
          event.preventDefault();
          move(PAGE_JUMP);
          return;
        case "PageUp":
          event.preventDefault();
          move(-PAGE_JUMP);
          return;
        case "Home":
          event.preventDefault();
          setCursor(0);
          return;
        case "End":
          event.preventDefault();
          setCursor(Math.max(0, rows.length - 1));
          return;
        case "Enter":
          event.preventDefault();
          activate(rows[cursor]);
          return;
        case "ArrowRight":
          // Only descends; never steals the caret from a mid-word cursor.
          if (query === "" && rows[cursor] && isGroup(rows[cursor].command)) {
            event.preventDefault();
            descend(rows[cursor].command);
          }
          return;
        case "ArrowLeft":
        case "Backspace":
          // Up a level, but only with an empty filter — otherwise Backspace is
          // just Backspace, which is what a typing user expects.
          if (query === "") {
            if (goBack()) event.preventDefault();
          }
          return;
        case "Escape":
          // Two-stage: clear the filter first, close only when already empty.
          // Preventing the default also stops <dialog>'s cancel from firing.
          if (query !== "") {
            event.preventDefault();
            setQuery("");
            setCursor(0);
          }
          return;
        case "u":
          if (event.ctrlKey) {
            event.preventDefault();
            setQuery("");
            setCursor(0);
          }
          return;
        default:
          break;
      }
    },
    [activate, closeMenu, cursor, descend, goBack, move, query, rows],
  );

  const activeRow = rows[cursor];
  const activeId = activeRow ? `command-menu-row-${activeRow.command.id}` : undefined;
  let renderedDeeperDivider = false;

  return (
    <Modal onClose={closeMenu} labelledBy="command-menu-title" className="ui-command-menu">
      <div className="flex h-full flex-col" onKeyDown={onKeyDown}>
        <h2 id="command-menu-title" className="sr-only">
          Command menu
        </h2>

        <div className="ui-command-menu-search">
          <Search size={16} aria-hidden="true" className="shrink-0 opacity-60" />
          {parent ? (
            <span className="ui-command-menu-crumb" title={[...parent.path, parent.title].join(" › ")}>
              {parent.title}
              <span aria-hidden="true"> ›</span>
            </span>
          ) : null}
          <input
            ref={inputRef}
            autoFocus
            type="text"
            role="combobox"
            aria-expanded="true"
            aria-controls="command-menu-list"
            aria-activedescendant={activeId}
            aria-autocomplete="list"
            aria-label={parent ? `Search ${parent.title}` : "Search commands"}
            placeholder={parent ? `Search ${parent.title.toLowerCase()}…` : "Go to…"}
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
              setCursor(0);
            }}
            className="ui-command-menu-input"
          />
        </div>

        <div
          ref={listRef}
          id="command-menu-list"
          role="listbox"
          aria-label="Commands"
          className="ui-command-menu-list"
        >
          {rows.length === 0 ? (
            <p className="ui-command-menu-empty">No matching commands</p>
          ) : (
            rows.map((row, index) => {
              const showDivider = row.section === "deeper" && !renderedDeeperDivider;
              if (showDivider) renderedDeeperDivider = true;
              return (
                <div key={row.command.id}>
                  {showDivider ? (
                    <p className="ui-command-menu-section" aria-hidden="true">
                      Deeper in {parent ? parent.title : "the menu"}
                    </p>
                  ) : null}
                  <CommandRow
                    row={row}
                    active={index === cursor}
                    isMac={isMac}
                    onSelect={() => activate(row)}
                    onHover={() => setCursor(index)}
                  />
                </div>
              );
            })
          )}
        </div>

        <div className="ui-command-menu-footer" aria-hidden="true">
          <Hint keys="↑ ↓" label="Move" />
          <Hint keys="↵" label={activeRow && isGroup(activeRow.command) ? "Open submenu" : "Run"} />
          {parent ? <Hint keys="⌫" label="Back" /> : null}
          <Hint keys="Esc" label={query ? "Clear" : "Close"} />
        </div>
      </div>
    </Modal>
  );
}

function CommandRow({
  row,
  active,
  isMac,
  onSelect,
  onHover,
}: {
  row: Row;
  active: boolean;
  isMac: boolean;
  onSelect: () => void;
  onHover: () => void;
}) {
  const { command } = row;
  const group = isGroup(command);

  return (
    <div
      id={`command-menu-row-${command.id}`}
      role="option"
      aria-selected={active}
      data-active={active}
      onClick={onSelect}
      onMouseMove={onHover}
      className="ui-command-menu-row"
    >
      <div className="min-w-0">
        <p className="ui-command-menu-row-title">{command.title}</p>
        {row.section === "deeper" && command.path.length > 0 ? (
          <p className="ui-command-menu-row-path">{command.path.join(" › ")}</p>
        ) : command.description ? (
          <p className="ui-command-menu-row-path">{command.description}</p>
        ) : null}
      </div>
      {command.sequence ? (
        <kbd className="ui-kbd">{formatSequence(command.sequence, isMac)}</kbd>
      ) : group ? (
        <span aria-hidden="true" className="ui-command-menu-row-chevron">
          ›
        </span>
      ) : active ? (
        <CornerDownLeft size={14} aria-hidden="true" className="opacity-50" />
      ) : null}
    </div>
  );
}

function Hint({ keys, label }: { keys: string; label: string }) {
  return (
    <span className="ui-command-menu-hint">
      <kbd className="ui-kbd">{keys}</kbd>
      {label}
    </span>
  );
}
