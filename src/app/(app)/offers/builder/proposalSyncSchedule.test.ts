import { describe, expect, it } from "vitest";
import {
  nextProposalSyncDelay,
  PROPOSAL_BUILDER_SYNC_DEBOUNCE_MS,
  PROPOSAL_BUILDER_SYNC_MAX_WAIT_MS,
} from "./useProposalBuilderStateSync";

/**
 * Simulate a burst of announcements arriving every `gapMs`, re-arming the timer
 * each time exactly as the hook does, and report when the flush actually fires.
 * Returns null if it never fires within the window — i.e. the mirror is starved.
 */
function firstFlushAt({
  gapMs,
  windowMs,
  debounceMs = PROPOSAL_BUILDER_SYNC_DEBOUNCE_MS,
  maxWaitMs = PROPOSAL_BUILDER_SYNC_MAX_WAIT_MS,
}: {
  gapMs: number;
  windowMs: number;
  debounceMs?: number;
  maxWaitMs?: number;
}) {
  const start = 0;
  let firstPendingAt: number | undefined;
  let scheduledFor = Infinity;

  for (let now = start; now <= windowMs; now += gapMs) {
    // A pending flush whose time arrived before this announcement wins.
    if (scheduledFor <= now) return scheduledFor;
    firstPendingAt ??= now;
    scheduledFor = now + nextProposalSyncDelay({ now, firstPendingAt, debounceMs, maxWaitMs });
  }
  return scheduledFor <= windowMs ? scheduledFor : null;
}

describe("nextProposalSyncDelay", () => {
  it("is a plain trailing debounce early in a burst", () => {
    expect(nextProposalSyncDelay({ now: 0, firstPendingAt: 0 })).toBe(
      PROPOSAL_BUILDER_SYNC_DEBOUNCE_MS,
    );
  });

  it("shrinks to zero once the ceiling is reached", () => {
    expect(
      nextProposalSyncDelay({ now: PROPOSAL_BUILDER_SYNC_MAX_WAIT_MS, firstPendingAt: 0 }),
    ).toBe(0);
  });

  it("never returns a negative delay past the ceiling", () => {
    expect(
      nextProposalSyncDelay({ now: PROPOSAL_BUILDER_SYNC_MAX_WAIT_MS * 5, firstPendingAt: 0 }),
    ).toBe(0);
  });
});

describe("sustained typing cannot starve the mirror", () => {
  // 60ms between keystrokes is well inside the 150ms debounce interval: this is
  // precisely the case a plain trailing debounce never flushes.
  it("still flushes within the ceiling while keystrokes keep arriving", () => {
    const flush = firstFlushAt({ gapMs: 60, windowMs: 5_000 });
    expect(flush).not.toBeNull();
    expect(flush).toBeLessThanOrEqual(PROPOSAL_BUILDER_SYNC_MAX_WAIT_MS);
  });

  it("holds for very fast input too", () => {
    for (const gapMs of [1, 5, 16, 30, 60, 100, 149]) {
      const flush = firstFlushAt({ gapMs, windowMs: 5_000 });
      expect(flush, `gap ${gapMs}ms starved the mirror`).not.toBeNull();
      expect(flush, `gap ${gapMs}ms flushed late`).toBeLessThanOrEqual(
        PROPOSAL_BUILDER_SYNC_MAX_WAIT_MS,
      );
    }
  });

  // The mutation guard: without a ceiling this same burst never flushes, which
  // is what makes the tests above meaningful rather than decorative.
  it("would starve with the ceiling disabled", () => {
    const flush = firstFlushAt({ gapMs: 60, windowMs: 5_000, maxWaitMs: Number.MAX_SAFE_INTEGER });
    expect(flush).toBeNull();
  });

  it("still debounces normally when input pauses", () => {
    // Gaps wider than the debounce interval never reach the ceiling: the flush
    // lands one debounce after the keystroke, not one ceiling after it.
    const flush = firstFlushAt({ gapMs: 500, windowMs: 5_000 });
    expect(flush).toBe(PROPOSAL_BUILDER_SYNC_DEBOUNCE_MS);
  });
});
