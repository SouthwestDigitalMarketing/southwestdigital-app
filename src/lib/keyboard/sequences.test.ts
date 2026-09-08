import { describe, expect, it } from "vitest";
import { parseSequence } from "./chords";
import {
  detectSequenceConflicts,
  EMPTY_SEQUENCE_STATE,
  feedSequence,
  SEQUENCE_TIMEOUT_MS,
  type SequenceBinding,
} from "./sequences";

const bindings: SequenceBinding[] = [
  { id: "go-offers", sequence: parseSequence("g o") },
  { id: "go-dashboard", sequence: parseSequence("g d") },
  { id: "top", sequence: parseSequence("g g") },
  { id: "palette", sequence: parseSequence("mod+k") },
  { id: "bottom", sequence: parseSequence("shift+g") },
];

describe("feedSequence", () => {
  it("matches a single-chord binding immediately", () => {
    const result = feedSequence(bindings, EMPTY_SEQUENCE_STATE, { key: "k", mod: true }, 0);
    expect(result).toMatchObject({ type: "match", id: "palette" });
  });

  it("holds a prefix pending, then matches", () => {
    const first = feedSequence(bindings, EMPTY_SEQUENCE_STATE, { key: "g" }, 0);
    expect(first.type).toBe("pending");

    const second = feedSequence(bindings, first.state, { key: "o" }, 100);
    expect(second).toMatchObject({ type: "match", id: "go-offers" });
    expect(second.state.pending).toEqual([]);
  });

  it("distinguishes g g from g o", () => {
    const first = feedSequence(bindings, EMPTY_SEQUENCE_STATE, { key: "g" }, 0);
    const second = feedSequence(bindings, first.state, { key: "g" }, 50);
    expect(second).toMatchObject({ type: "match", id: "top" });
  });

  it("keeps shift+g separate from the g prefix", () => {
    const result = feedSequence(bindings, EMPTY_SEQUENCE_STATE, { key: "g", shift: true }, 0);
    expect(result).toMatchObject({ type: "match", id: "bottom" });
  });

  it("expires a stale prefix rather than swallowing the next key", () => {
    const first = feedSequence(bindings, EMPTY_SEQUENCE_STATE, { key: "g" }, 0);
    const late = feedSequence(bindings, first.state, { key: "o" }, SEQUENCE_TIMEOUT_MS + 1);
    expect(late.type).toBe("none");
  });

  it("restarts a sequence when a dead-end chord could begin a new one", () => {
    const first = feedSequence(bindings, EMPTY_SEQUENCE_STATE, { key: "g" }, 0);
    const second = feedSequence(bindings, first.state, { key: "g" }, 10);
    expect(second.type).toBe("match");

    const restart = feedSequence(bindings, first.state, { key: "z" }, 10);
    expect(restart.type).toBe("none");
  });

  it("reports no match for an unbound chord", () => {
    const result = feedSequence(bindings, EMPTY_SEQUENCE_STATE, { key: "z" }, 0);
    expect(result).toEqual({ type: "none", state: EMPTY_SEQUENCE_STATE });
  });
});

describe("detectSequenceConflicts", () => {
  it("finds nothing wrong with a well-formed keymap", () => {
    expect(detectSequenceConflicts(bindings)).toEqual([]);
  });

  it("flags a duplicate sequence", () => {
    const conflicts = detectSequenceConflicts([
      { id: "a", sequence: parseSequence("g o") },
      { id: "b", sequence: parseSequence("g o") },
    ]);
    expect(conflicts).toEqual([{ kind: "duplicate", id: "b", conflictsWith: "a" }]);
  });

  it("flags a longer sequence shadowed by its own prefix", () => {
    const conflicts = detectSequenceConflicts([
      { id: "short", sequence: parseSequence("g") },
      { id: "long", sequence: parseSequence("g o") },
    ]);
    expect(conflicts).toEqual([{ kind: "shadowed", id: "long", conflictsWith: "short" }]);
  });
});
