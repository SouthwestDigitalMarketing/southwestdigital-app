"use client";

import { useKeyboardAction } from "./KeyboardProvider";

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
