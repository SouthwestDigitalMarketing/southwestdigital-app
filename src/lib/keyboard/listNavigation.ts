/**
 * Cursor arithmetic for keyboard-navigable lists.
 *
 * Pure and separate from the React hook so the edge cases — empty lists, a
 * cursor left dangling by a filter, wrap-around at the ends — are pinned by
 * tests rather than discovered in a table at 2am.
 */

export type ListCursorOptions = {
  /** Wrap past the ends. Off by default: silence at the boundary is a useful
   *  signal that you have reached the end of the list. */
  wrap?: boolean;
};

/** Move the cursor by `delta`, clamping or wrapping at the ends. */
export function moveCursor(
  current: number,
  length: number,
  delta: number,
  { wrap = false }: ListCursorOptions = {},
): number {
  if (length <= 0) return -1;

  // No cursor yet: the first move lands on an end rather than jumping to the
  // middle, so `j` from cold starts at the top and `k` starts at the bottom.
  if (current < 0) return delta > 0 ? 0 : length - 1;

  const next = current + delta;
  if (wrap) return ((next % length) + length) % length;
  return Math.min(length - 1, Math.max(0, next));
}

/**
 * Keep a cursor valid after the underlying list changes.
 *
 * Identity beats position: if the row the user was on still exists, follow it
 * to its new index rather than stranding the cursor on whatever slid into that
 * slot. A filter that removes rows above the cursor should not silently change
 * which row Enter opens.
 */
export function reconcileCursor(
  previousId: string | null,
  ids: readonly string[],
  previousIndex: number,
): number {
  if (ids.length === 0) return -1;

  if (previousId) {
    const moved = ids.indexOf(previousId);
    if (moved >= 0) return moved;
  }

  if (previousIndex < 0) return -1;
  return Math.min(ids.length - 1, previousIndex);
}

export function cursorId(ids: readonly string[], index: number): string | null {
  if (index < 0 || index >= ids.length) return null;
  return ids[index];
}
