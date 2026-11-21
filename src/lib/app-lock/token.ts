/**
 * Signed, expiring values for the app lock: the unlock cookie and the
 * WebAuthn challenge cookie. HMAC-SHA256 with AUTH_SECRET; no server state.
 */
import { createHmac, timingSafeEqual } from "node:crypto";

export const UNLOCK_COOKIE = "swapp_unlock";
export const CHALLENGE_COOKIE = "swapp_passkey_challenge";
export const RESET_COOKIE = "swapp_pin_reset";
export const RESET_MINUTES = 15;
export const UNLOCK_HOURS = 8;
export const CHALLENGE_MINUTES = 5;

function sign(payload: string, secret: string) {
  return createHmac("sha256", secret).update(payload).digest("base64url");
}

/** `parts` must not contain "."; returns "<parts joined by .>.<expires>.<mac>". */
export function signValue(parts: string[], expiresAt: number, secret: string): string {
  const payload = [...parts, String(expiresAt)].join(".");
  return `${payload}.${sign(payload, secret)}`;
}

/** The signed parts when the value is genuine and unexpired; otherwise null. */
export function readValue(value: string | undefined, now: number, secret: string): string[] | null {
  if (!value) return null;
  const cut = value.lastIndexOf(".");
  if (cut < 0) return null;
  const payload = value.slice(0, cut);
  const mac = Buffer.from(value.slice(cut + 1));
  const expected = Buffer.from(sign(payload, secret));
  if (mac.length !== expected.length || !timingSafeEqual(mac, expected)) return null;
  const parts = payload.split(".");
  const expiresAt = Number(parts.pop());
  if (!Number.isFinite(expiresAt) || expiresAt <= now) return null;
  return parts;
}

/**
 * Unlock cookie for one user. `pinVersion` is pinChangedAt in ms, so changing
 * the PIN ends every other device's unlock.
 */
export function signUnlock(userId: string, pinVersion: number, now: number, secret: string) {
  return signValue([userId, String(pinVersion)], now + UNLOCK_HOURS * 3_600_000, secret);
}

export function unlockIsValid(
  value: string | undefined,
  userId: string,
  pinVersion: number,
  now: number,
  secret: string,
): boolean {
  const parts = readValue(value, now, secret);
  return parts !== null && parts[0] === userId && parts[1] === String(pinVersion);
}

/** "Forgot PIN?" request: valid for RESET_MINUTES, for one user. */
export function signReset(userId: string, now: number, secret: string) {
  return signValue([userId, String(now)], now + RESET_MINUTES * 60_000, secret);
}

/**
 * A reset is allowed only for the user who asked, and only on a session
 * signed in after the request (proves a fresh Google / email sign-in).
 */
export function resetAllowed(
  value: string | undefined,
  userId: string,
  signedInAt: number,
  now: number,
  secret: string,
): boolean {
  const parts = readValue(value, now, secret);
  return parts !== null && parts[0] === userId && signedInAt > Number(parts[1]);
}
