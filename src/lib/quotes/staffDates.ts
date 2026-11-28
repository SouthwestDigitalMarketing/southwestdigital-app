/**
 * Staff-facing proposal date labels (Spec 08 fix round 2: MINOR-6).
 *
 * No brand timezone exists in the app; the only timezone columns are the
 * optional staff onboarding-profile fields, which are not session-plumbed.
 * So every staff label uses the firm default America/Chicago unless the
 * caller passes an explicit IANA zone (e.g. a staff member's profile zone).
 * Never UTC slices: an expiry at 2026-09-01T02:00Z is still Aug 31 in
 * Chicago, and a UTC date would read a day early for evening expiries.
 */
export const STAFF_TIME_ZONE = "America/Chicago";

/** "YYYY-MM-DD" of `value` in the staff timezone (firm Chicago default). */
export function staffDateKey(value: Date, timeZone: string = STAFF_TIME_ZONE): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(value);
}
