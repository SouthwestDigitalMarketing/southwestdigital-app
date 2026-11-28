/** Spec 08: staff-only expiry badges for the offers list. Frozen
 *  (accepted/signed/paid) quotes never expire, so they never show a badge. */
export type ExpiryBadge = { label: string; expired: boolean };

const DAY_MS = 24 * 60 * 60 * 1000;

export function expiryBadgeForQuote(
  expiresAt: Date | null | undefined,
  frozen: boolean,
  now: Date = new Date(),
): ExpiryBadge | null {
  if (frozen || !expiresAt) return null;
  const diffMs = expiresAt.getTime() - now.getTime();
  if (diffMs <= 0) return { label: "Expired", expired: true };
  const days = Math.ceil(diffMs / DAY_MS);
  if (days > 5) return null;
  return { label: `Expires in ${days} ${days === 1 ? "day" : "days"}`, expired: false };
}
