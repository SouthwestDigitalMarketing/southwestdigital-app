import { describe, expect, it } from "vitest";
import { cursorId, moveCursor, reconcileCursor } from "./listNavigation";

describe("moveCursor", () => {
  it("returns no cursor for an empty list", () => {
    expect(moveCursor(-1, 0, 1)).toBe(-1);
    expect(moveCursor(3, 0, -1)).toBe(-1);
  });

  it("lands on the first row when moving down from cold", () => {
    expect(moveCursor(-1, 5, 1)).toBe(0);
  });

  it("lands on the last row when moving up from cold", () => {
    expect(moveCursor(-1, 5, -1)).toBe(4);
  });

  it("steps one row at a time", () => {
    expect(moveCursor(2, 5, 1)).toBe(3);
    expect(moveCursor(2, 5, -1)).toBe(1);
  });

  it("clamps at the ends by default", () => {
    expect(moveCursor(4, 5, 1)).toBe(4);
    expect(moveCursor(0, 5, -1)).toBe(0);
  });

  it("wraps when asked", () => {
    expect(moveCursor(4, 5, 1, { wrap: true })).toBe(0);
    expect(moveCursor(0, 5, -1, { wrap: true })).toBe(4);
  });

  it("handles a page-sized jump", () => {
    expect(moveCursor(0, 30, 10)).toBe(10);
    expect(moveCursor(28, 30, 10)).toBe(29);
  });

  it("wraps a jump larger than the list", () => {
    expect(moveCursor(0, 3, 7, { wrap: true })).toBe(1);
    expect(moveCursor(0, 3, -7, { wrap: true })).toBe(2);
  });
});

describe("reconcileCursor", () => {
  it("clears the cursor when the list empties", () => {
    expect(reconcileCursor("a", [], 0)).toBe(-1);
  });

  it("follows the focused row to its new index", () => {
    expect(reconcileCursor("c", ["a", "b", "c"], 0)).toBe(2);
  });

  it("keeps the row identity when rows above it are filtered out", () => {
    // Was index 3 of [a,b,c,d]; a and b are gone, so d is now index 1.
    expect(reconcileCursor("d", ["c", "d"], 3)).toBe(1);
  });

  it("falls back to position when the focused row disappears", () => {
    expect(reconcileCursor("z", ["a", "b", "c"], 1)).toBe(1);
  });

  it("clamps the fallback position to the shortened list", () => {
    expect(reconcileCursor("z", ["a"], 4)).toBe(0);
  });

  it("stays uncursored when it was uncursored and the row is gone", () => {
    expect(reconcileCursor(null, ["a", "b"], -1)).toBe(-1);
  });
});

describe("cursorId", () => {
  it("resolves the id at the cursor", () => {
    expect(cursorId(["a", "b"], 1)).toBe("b");
  });

  it("returns null when uncursored or out of range", () => {
    expect(cursorId(["a", "b"], -1)).toBeNull();
    expect(cursorId(["a", "b"], 5)).toBeNull();
  });
});
