import { timingSafeEqual } from "node:crypto";

/** The push token ripley's scan poller uses, compared in constant time. 503 when unset. */
export function checkScanToken(
  header: string | null,
  env: Record<string, string | undefined> = process.env,
): { ok: true; actorUserId: string } | { ok: false; status: 401 | 503 } {
  const token = env.SCAN_STATUS_TOKEN ?? "";
  // No database policy reads the actor; it only names who wrote the row.
  const actorUserId = env.SCAN_STATUS_ACTOR_USER_ID || "scan-ripley";
  if (token.length < 32) return { ok: false, status: 503 };
  const given = header?.startsWith("Bearer ") ? header.slice(7) : "";
  const a = Buffer.from(given);
  const b = Buffer.from(token);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return { ok: false, status: 401 };
  return { ok: true, actorUserId };
}
