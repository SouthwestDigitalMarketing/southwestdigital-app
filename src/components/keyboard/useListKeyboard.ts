"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { cursorId, moveCursor, reconcileCursor } from "@/lib/keyboard/listNavigation";
import { useKeyboardAction, useKeyboardScope } from "./KeyboardProvider";

/**
 * Keyboard cursor for a list or table.
 *
 * Uses a **roving tabindex**: exactly one row is tabbable at a time, so Tab
 * still steps past the whole list in one press while j/k move within it. A list
 * where every row is its own tab stop is worse for keyboard users, not better.
 *
 * The DOM row is focused directly rather than tracked with
 * `aria-activedescendant`, because these are real table rows whose inner
 * buttons must stay independently reachable.
 */
export function useListKeyboardNavigation({
  ids,
  onOpen,
  enabled = true,
}: {
  /** Row ids in render order. Must match the order rows appear on screen. */
  ids: readonly string[];
  /** What Enter (or `o`) does on the focused row. */
  onOpen?: (id: string) => void;
  enabled?: boolean;
}) {
  const [activeIndex, setActiveIndex] = useState(-1);
  const rowElements = useRef(new Map<string, HTMLElement>());
  const activeId = cursorId(ids, activeIndex);

  const activeIdRef = useRef<string | null>(null);
  activeIdRef.current = activeId;

  const activeIndexRef = useRef(activeIndex);
  activeIndexRef.current = activeIndex;

  const idsRef = useRef(ids);
  idsRef.current = ids;

  // Rows change identity as filters and sorts are applied; follow the focused
  // row rather than whatever slid into the index it used to occupy.
  const idsKey = useMemo(() => ids.join("|"), [ids]);

  useEffect(() => {
    setActiveIndex((previous) => reconcileCursor(activeIdRef.current, idsRef.current, previous));
    // idsKey is the value-identity of `ids`; depending on the array itself would
    // re-run on every render for callers that build it inline.
  }, [idsKey]);

  /** Move the cursor and give the row real DOM focus. */
  const focusIndex = useCallback((index: number) => {
    setActiveIndex(index);
    const id = cursorId(idsRef.current, index);
    if (!id) return;
    rowElements.current.get(id)?.focus({ preventScroll: false });
  }, []);

  const move = useCallback(
    (delta: number) => {
      focusIndex(moveCursor(activeIndexRef.current, idsRef.current.length, delta));
    },
    [focusIndex],
  );

  useKeyboardScope("list", enabled && ids.length > 0);

  useKeyboardAction("list.next", () => move(1), enabled);
  useKeyboardAction("list.previous", () => move(-1), enabled);
  useKeyboardAction("list.top", () => focusIndex(0), enabled);
  useKeyboardAction("list.bottom", () => focusIndex(idsRef.current.length - 1), enabled);
  useKeyboardAction(
    "list.open",
    () => {
      const id = cursorId(idsRef.current, activeIndexRef.current);
      if (id && onOpen) onOpen(id);
    },
    enabled && Boolean(onOpen),
  );

  /**
   * Props for each row. Spread onto the row element.
   *
   * `onFocus` keeps the cursor in step when focus arrives by Tab or by click,
   * so the two input methods never disagree about which row is current.
   */
  const rowProps = useCallback(
    (id: string, index: number) => ({
      // Roving tabindex: the cursor row is the single tab stop, falling back to
      // the first row so Tab can enter a list that has not been touched yet.
      tabIndex:
        index === activeIndexRef.current || (activeIndexRef.current < 0 && index === 0) ? 0 : -1,
      "data-keyboard-active": index === activeIndexRef.current ? "true" : undefined,
      ref: (element: HTMLElement | null) => {
        if (element) rowElements.current.set(id, element);
        else rowElements.current.delete(id);
      },
      onFocus: () => setActiveIndex(index),
    }),
    [],
  );

  return { activeId, activeIndex, rowProps, focusIndex };
}

/**
 * Wire `/` to focus this page's search box.
 *
 * `/` filters where you already are; the command menu is the thing that takes
 * you somewhere else. Keeping those two jobs separate is what makes both
 * predictable.
 */
export function useSearchFocusShortcut(
  ref: React.RefObject<HTMLInputElement | null>,
  enabled = true,
) {
  useKeyboardAction(
    "search.focus",
    () => {
      const input = ref.current;
      if (!input) return;
      input.focus();
      input.select();
    },
    enabled,
  );
}
