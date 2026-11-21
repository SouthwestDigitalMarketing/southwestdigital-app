import { firmDateKey } from "@/lib/operations/schedule";

/**
 * Monthly PIN change (Tom, 2026-11-20): due from the 1st of each firm-local
 * month until the PIN has been changed during that month.
 */
export function pinChangeDue(pinChangedAt: Date | null, now: Date): boolean {
  if (!pinChangedAt) return false; // no PIN yet: the unlock screen asks for one
  return firmDateKey(pinChangedAt).slice(0, 7) < firmDateKey(now).slice(0, 7);
}
