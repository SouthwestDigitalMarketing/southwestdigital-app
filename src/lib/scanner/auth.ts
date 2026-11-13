import { createHash, timingSafeEqual } from "node:crypto";

export type ScannerAuth = { ok: true; actorUserId: string } | { ok: false; status: 401 | 503 };

/** Shared bearer token for ripley workers. Only the SHA-256 is configured here. */
export function authenticateScannerRequest(
  authorization: string | null,
  env: Record<string, string | undefined> = process.env,
): ScannerAuth {
  const expected = env.SCANNER_API_TOKEN_SHA256?.trim().toLowerCase();
  const actorUserId = env.SCANNER_API_ACTOR_USER_ID?.trim();
  if (!expected || !/^[0-9a-f]{64}$/.test(expected) || !actorUserId) {
    return { ok: false, status: 503 };
  }
  const token = authorization?.match(/^Bearer\s+(\S+)$/i)?.[1];
  if (!token) return { ok: false, status: 401 };
  const presented = createHash("sha256").update(token).digest();
  const wanted = Buffer.from(expected, "hex");
  return timingSafeEqual(presented, wanted) ? { ok: true, actorUserId } : { ok: false, status: 401 };
}
