/**
 * Multi-key sequence matching, e.g. `g` then `o` to open Offers.
 *
 * Modelled as a pure state machine so it is fully unit-testable: feed it chords
 * and a clock, get back a decision plus the next state. The React layer owns the
 * state and the real clock; none of the timing logic lives in a component.
 */

import { chordsEqual, type Chord } from "./chords";

export type SequenceBinding<T = string> = {
  id: T;
  sequence: Chord[];
};

export type SequenceState = {
  /** Chords accepted so far that form a prefix of at least one binding. */
  pending: Chord[];
  /** Timestamp of the most recent accepted chord, for the idle timeout. */
  lastChordAt: number;
};

export type SequenceResult<T = string> =
  | { type: "none"; state: SequenceState }
  | { type: "pending"; state: SequenceState }
  | { type: "match"; id: T; state: SequenceState };

export const EMPTY_SEQUENCE_STATE: SequenceState = { pending: [], lastChordAt: 0 };

/**
 * How long a partial sequence stays armed. Long enough to be forgiving for a
 * deliberate two-key press, short enough that a forgotten `g` does not silently
 * swallow the next keystroke.
 */
export const SEQUENCE_TIMEOUT_MS = 1200;

function startsWith(sequence: Chord[], prefix: Chord[]): boolean {
  if (prefix.length > sequence.length) return false;
  return prefix.every((chord, index) => chordsEqual(chord, sequence[index]));
}

/**
 * Advance the matcher by one chord.
 *
 * Resolution order matters: an exact match wins immediately, so a single-chord
 * binding is never held hostage waiting to see whether a longer one follows.
 * That means a binding cannot be both `g` and a prefix of `g o` — `detectSequenceConflicts`
 * surfaces exactly that mistake at startup rather than at 2am.
 */
export function feedSequence<T = string>(
  bindings: ReadonlyArray<SequenceBinding<T>>,
  state: SequenceState,
  chord: Chord,
  now: number,
  timeoutMs: number = SEQUENCE_TIMEOUT_MS,
): SequenceResult<T> {
  const expired = state.pending.length > 0 && now - state.lastChordAt > timeoutMs;
  const basePending = expired ? [] : state.pending;
  const candidate = [...basePending, chord];

  const exact = bindings.find((binding) => binding.sequence.length === candidate.length && startsWith(candidate, binding.sequence));
  if (exact) {
    return { type: "match", id: exact.id, state: { ...EMPTY_SEQUENCE_STATE } };
  }

  const isPrefix = bindings.some((binding) => binding.sequence.length > candidate.length && startsWith(binding.sequence, candidate));
  if (isPrefix) {
    return { type: "pending", state: { pending: candidate, lastChordAt: now } };
  }

  // Not a match and not on the way to one. If we were mid-sequence, this chord
  // may itself start a fresh sequence — retry from scratch so `g` `g` `o` still
  // reaches `g o` instead of dead-ending.
  if (basePending.length > 0) {
    return feedSequence(bindings, EMPTY_SEQUENCE_STATE, chord, now, timeoutMs);
  }

  return { type: "none", state: { ...EMPTY_SEQUENCE_STATE } };
}

/**
 * Startup validation: report bindings that can never fire.
 *
 * Two shapes are broken — a duplicate sequence (second one is dead) and a
 * sequence that is a strict prefix of a longer one (the longer one is dead,
 * because the prefix matches exactly and wins first).
 */
export function detectSequenceConflicts<T = string>(
  bindings: ReadonlyArray<SequenceBinding<T>>,
): Array<{ kind: "duplicate" | "shadowed"; id: T; conflictsWith: T }> {
  const conflicts: Array<{ kind: "duplicate" | "shadowed"; id: T; conflictsWith: T }> = [];

  bindings.forEach((binding, index) => {
    bindings.forEach((other, otherIndex) => {
      if (index >= otherIndex) return;
      if (binding.sequence.length === other.sequence.length && startsWith(binding.sequence, other.sequence)) {
        conflicts.push({ kind: "duplicate", id: other.id, conflictsWith: binding.id });
        return;
      }
      if (binding.sequence.length < other.sequence.length && startsWith(other.sequence, binding.sequence)) {
        conflicts.push({ kind: "shadowed", id: other.id, conflictsWith: binding.id });
      } else if (other.sequence.length < binding.sequence.length && startsWith(binding.sequence, other.sequence)) {
        conflicts.push({ kind: "shadowed", id: binding.id, conflictsWith: other.id });
      }
    });
  });

  return conflicts;
}
