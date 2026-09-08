"use client";

import { useRef, type ComponentProps } from "react";
import { useSearchFocusShortcut } from "./useListKeyboard";

/** A normal search field with the page's optional / shortcut. */
export function SearchInput(props: ComponentProps<"input">) {
  const ref = useRef<HTMLInputElement>(null);
  useSearchFocusShortcut(ref);
  return <input aria-label="Search this page" {...props} ref={ref} />;
}
