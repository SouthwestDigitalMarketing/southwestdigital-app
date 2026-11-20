/**
 * App-lock PIN (Tom, 2026-11-20): six digits, stored only as a scrypt hash.
 * Signing in still goes through Auth.js; the PIN (or a passkey) unlocks the
 * staff screens on a device that is already signed in.
 */
import { randomBytes, scrypt as scryptCb, timingSafeEqual, type ScryptOptions } from "node:crypto";

export const PIN_LENGTH = 6;
export const MAX_PIN_ATTEMPTS = 5;
export const PIN_LOCKOUT_MINUTES = 15;

const SCRYPT = { N: 32768, r: 8, p: 1, keyLength: 32 };

function scrypt(pin: string, salt: Buffer, keyLength: number, options: ScryptOptions): Promise<Buffer> {
  return new Promise((resolve, reject) =>
    scryptCb(pin, salt, keyLength, options, (err, key) => (err ? reject(err) : resolve(key))),
  );
}

/** Plain-words reason the PIN is not allowed, or null when it is fine. */
export function pinProblem(pin: string): string | null {
  if (!new RegExp(`^\\d{${PIN_LENGTH}}$`).test(pin)) return `Use exactly ${PIN_LENGTH} digits.`;
  if (/^(\d)\1+$/.test(pin)) return "Do not use the same digit six times.";
  const ascending = "0123456789012345"; // wraps, so 890123 counts too
  const descending = "9876543210987654";
  if (ascending.includes(pin) || descending.includes(pin)) return "Do not use a straight run like 123456.";
  return null;
}

export async function hashPin(pin: string): Promise<string> {
  const salt = randomBytes(16);
  const { N, r, p, keyLength } = SCRYPT;
  const key = await scrypt(pin, salt, keyLength, { N, r, p, maxmem: 64 * 1024 * 1024 });
  return ["scrypt", N, r, p, salt.toString("base64url"), key.toString("base64url")].join("$");
}

export async function verifyPin(pin: string, stored: string): Promise<boolean> {
  const [kind, n, r, p, saltText, keyText] = stored.split("$");
  if (kind !== "scrypt" || !saltText || !keyText) return false;
  const expected = Buffer.from(keyText, "base64url");
  const key = await scrypt(pin, Buffer.from(saltText, "base64url"), expected.length, {
    N: Number(n),
    r: Number(r),
    p: Number(p),
    maxmem: 64 * 1024 * 1024,
  });
  return key.length === expected.length && timingSafeEqual(key, expected);
}

/** After a wrong PIN: the new failure count and, at the limit, when the lock lifts. */
export function afterFailedPin(failedCount: number, now: Date): { failedCount: number; lockedUntil: Date | null } {
  const next = failedCount + 1;
  if (next < MAX_PIN_ATTEMPTS) return { failedCount: next, lockedUntil: null };
  return { failedCount: 0, lockedUntil: new Date(now.getTime() + PIN_LOCKOUT_MINUTES * 60_000) };
}
