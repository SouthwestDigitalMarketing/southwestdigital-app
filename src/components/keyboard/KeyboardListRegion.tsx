"use client";

import { useCallback, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { cursorId, moveCursor, reconcileCursor } from "@/lib/keyboard/listNavigation";
import { useKeyboard, useKeyboardAction, useKeyboardScope } from "./KeyboardProvider";
import { useLatestRef } from "./useLatestRef";

export const KEYBOARD_ROW_ATTRIBUTE = "data-keyboard-row";

/**
 * One cursor implementation for server tables and client lists. DOM order is the
 * rendered order; a child-list observer reconciles client filtering and sorting.
 * Identity, rather than an index, keeps the cursor on the same record after sort.
 * Wrap the table, never its tbody (a div there would produce invalid HTML).
 */
export function KeyboardListRegion({
  openHrefs = {},
  onOpen,
  enabled = true,
  children,
}: {
  openHrefs?: Record<string, string>;
  onOpen?: (id: string) => void;
  enabled?: boolean;
  children: React.ReactNode;
}) {
  const router = useRouter();
  const { singleKeyShortcutsEnabled, pending } = useKeyboard();
  const containerRef = useRef<HTMLDivElement>(null);
  const activeId = useRef<string | null>(null);
  const returnToId = useRef<string | null>(null);
  const options = useLatestRef({ openHrefs, onOpen });

  const rows = useCallback(() => Array.from(
    containerRef.current?.querySelectorAll<HTMLElement>(`[${KEYBOARD_ROW_ATTRIBUTE}]`) ?? [],
  ).filter((row) => row.getClientRects().length > 0), []);

  const reflectCursor = useCallback(() => {
    const elements = rows();
    const ids = elements.map((row) => row.getAttribute(KEYBOARD_ROW_ATTRIBUTE)!);
    activeId.current = cursorId(ids, reconcileCursor(activeId.current, ids, -1));
    elements.forEach((row, index) => {
      const active = row.getAttribute(KEYBOARD_ROW_ATTRIBUTE) === activeId.current;
      row.tabIndex = active || (!activeId.current && index === 0) ? 0 : -1;
      if (active) row.setAttribute("data-keyboard-active", "true");
      else row.removeAttribute("data-keyboard-active");
      row.classList.add("ui-row-cursor");
    });
  }, [rows]);

  useEffect(() => {
    reflectCursor();
    const container = containerRef.current;
    if (!container) return;
    const observer = new MutationObserver(reflectCursor);
    observer.observe(container, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, [reflectCursor]);

  const focusIndex = useCallback((index: number) => {
    const elements = rows();
    const row = elements[Math.max(0, Math.min(elements.length - 1, index))];
    if (!row) return;
    activeId.current = row.getAttribute(KEYBOARD_ROW_ATTRIBUTE);
    reflectCursor();
    row.focus({ preventScroll: true });
    row.scrollIntoView({ block: "nearest", inline: "nearest" });
  }, [reflectCursor, rows]);

  useEffect(() => {
    if (!enabled || !returnToId.current) return;
    const index = rows().findIndex((row) => row.getAttribute(KEYBOARD_ROW_ATTRIBUTE) === returnToId.current);
    if (index < 0) return;
    returnToId.current = null;
    focusIndex(index);
  }, [enabled, focusIndex, rows]);

  const move = useCallback((delta: number) => {
    const elements = rows();
    const index = elements.findIndex((row) => row.getAttribute(KEYBOARD_ROW_ATTRIBUTE) === activeId.current);
    focusIndex(moveCursor(index, elements.length, delta));
  }, [focusIndex, rows]);

  useKeyboardScope("list", enabled);
  useKeyboardAction("list.next", () => move(1), enabled);
  useKeyboardAction("list.previous", () => move(-1), enabled);
  useKeyboardAction("list.top", () => focusIndex(0), enabled);
  useKeyboardAction("list.bottom", () => focusIndex(rows().length - 1), enabled);

  return (
    <div
      ref={containerRef}
      className="contents"
      onFocusCapture={(event) => {
        const row = (event.target as HTMLElement).closest<HTMLElement>(`[${KEYBOARD_ROW_ATTRIBUTE}]`);
        if (!row) return;
        activeId.current = row.getAttribute(KEYBOARD_ROW_ATTRIBUTE);
        reflectCursor();
      }}
      onKeyDown={(event) => {
        if (!enabled || event.defaultPrevented || event.nativeEvent.isComposing || event.nativeEvent.keyCode === 229 ||
          event.ctrlKey || event.metaKey || event.altKey || event.shiftKey) return;
        const row = event.target as HTMLElement;
        // Native controls inside the row retain Enter, Space, and arrow behavior.
        if (!row.hasAttribute(KEYBOARD_ROW_ATTRIBUTE)) return;
        if (event.key === "ArrowDown" || event.key === "ArrowUp") {
          event.preventDefault();
          move(event.key === "ArrowDown" ? 1 : -1);
          return;
        }
        if (event.key !== "Enter" && event.key !== "o") return;
        // An o completing g o belongs to the global sequence, not this row.
        if (event.key === "o" && (!singleKeyShortcutsEnabled || pending.length > 0)) return;
        const id = row.getAttribute(KEYBOARD_ROW_ATTRIBUTE);
        if (!id) return;
        const { onOpen: open, openHrefs: hrefs } = options.current;
        if (open) {
          event.preventDefault();
          returnToId.current = id;
          open(id);
        } else {
          const href = hrefs[id];
          if (href?.startsWith("/") && !href.startsWith("//")) {
            event.preventDefault();
            router.push(href);
          }
        }
      }}
    >
      {children}
    </div>
  );
}
