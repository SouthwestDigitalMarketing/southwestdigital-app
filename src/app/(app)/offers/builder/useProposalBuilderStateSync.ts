"use client";

import { useEffect, useRef } from "react";
import { subscribeToProposalBuilderState } from "./ProposalBuilderStorage";

/**
 * The live preview re-renders a very large tree, so coalesce bursts of
 * keystroke-level writes instead of reacting to every single one.
 */
export const PROPOSAL_BUILDER_SYNC_DEBOUNCE_MS = 150;

/**
 * Ceiling on how long coalescing may delay an update.
 *
 * The builder announces on every keystroke, so a purely trailing debounce would
 * never fire while someone types steadily — the preview would freeze for the
 * whole of a long field and only catch up on pause. This guarantees a flush.
 */
export const PROPOSAL_BUILDER_SYNC_MAX_WAIT_MS = 400;

/**
 * How long to wait before applying, given a burst that started at
 * `firstPendingAt`.
 *
 * Plain trailing debounce until the ceiling is in sight, then whatever is left
 * of it — so a burst can never delay an update past `maxWaitMs`, however fast
 * the announcements arrive. Extracted so the ceiling is testable without a DOM.
 */
export function nextProposalSyncDelay({
  now,
  firstPendingAt,
  debounceMs = PROPOSAL_BUILDER_SYNC_DEBOUNCE_MS,
  maxWaitMs = PROPOSAL_BUILDER_SYNC_MAX_WAIT_MS,
}: {
  now: number;
  firstPendingAt: number;
  debounceMs?: number;
  maxWaitMs?: number;
}) {
  return Math.min(debounceMs, Math.max(0, firstPendingAt + maxWaitMs - now));
}

/**
 * Mirror another tab's builder edits into this surface.
 *
 * Re-reads `storageKey` from localStorage whenever builder state is announced,
 * and only invokes `onExternalValue` when the stored string actually differs
 * from what was last applied. That raw-string guard is what keeps a mirror from
 * echoing: re-reading an identical value never produces a new object, so it
 * cannot retrigger a write effect.
 *
 * `onExternalValue` receives null when the key has been removed, so the mirror
 * can fall back to defaults rather than displaying a draft that no longer
 * exists.
 */
export function useProposalBuilderStateSync({
  storageKey,
  enabled,
  onExternalValue,
  debounceMs = PROPOSAL_BUILDER_SYNC_DEBOUNCE_MS,
  maxWaitMs = PROPOSAL_BUILDER_SYNC_MAX_WAIT_MS,
}: {
  storageKey: string;
  enabled: boolean;
  onExternalValue: (raw: string | null) => void;
  debounceMs?: number;
  maxWaitMs?: number;
}) {
  const onExternalValueRef = useRef(onExternalValue);

  useEffect(() => {
    onExternalValueRef.current = onExternalValue;
  }, [onExternalValue]);

  useEffect(() => {
    if (!enabled || typeof window === "undefined") return;

    function readStoredValue() {
      try {
        return window.localStorage.getItem(storageKey);
      } catch {
        // Browsers configured to block site data throw on access.
        return null;
      }
    }

    // Seed from what is already stored so the first announcement after mount
    // is compared against the value this surface actually hydrated with.
    let lastAppliedRaw = readStoredValue();
    let timeoutId: number | undefined;
    let firstPendingAt: number | undefined;

    function applyLatestStoredValue() {
      firstPendingAt = undefined;
      const raw = readStoredValue();
      if (raw === lastAppliedRaw) return;
      lastAppliedRaw = raw;
      onExternalValueRef.current(raw);
    }

    const unsubscribe = subscribeToProposalBuilderState((changedKey) => {
      // An announcement without a key means "something changed" — re-read and
      // let the raw-value guard decide whether it was ours.
      if (changedKey !== undefined && changedKey !== storageKey) return;

      const now = Date.now();
      firstPendingAt ??= now;
      // Never let continuous announcements push the flush past the ceiling.
      const wait = nextProposalSyncDelay({ now, firstPendingAt, debounceMs, maxWaitMs });
      window.clearTimeout(timeoutId);
      timeoutId = window.setTimeout(applyLatestStoredValue, wait);
    });

    return () => {
      window.clearTimeout(timeoutId);
      unsubscribe();
    };
  }, [debounceMs, enabled, maxWaitMs, storageKey]);
}
