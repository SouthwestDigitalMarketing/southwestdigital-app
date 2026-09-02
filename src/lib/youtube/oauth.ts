import "server-only";

import { createHmac, timingSafeEqual } from "node:crypto";

export const YOUTUBE_OAUTH_STATE_COOKIE = "swd-youtube-oauth-state";

function stateSecret() {
  const secret = process.env.AUTH_SECRET?.trim();
  if (!secret) throw new Error("AUTH_SECRET is not configured.");
  return secret;
}

export function createYouTubeOAuthState(brandId: string) {
  const payload = Buffer.from(JSON.stringify({ brandId, exp: Date.now() + 10 * 60 * 1000 })).toString("base64url");
  const signature = createHmac("sha256", stateSecret()).update(payload).digest("base64url");
  return `${payload}.${signature}`;
}

export function verifyYouTubeOAuthState(value: string, brandId: string) {
  const [payload, signature] = value.split(".");
  if (!payload || !signature) return false;
  const expected = createHmac("sha256", stateSecret()).update(payload).digest("base64url");
  const validSignature = signature.length === expected.length && timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
  if (!validSignature) return false;
  try {
    const parsed = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as { brandId?: string; exp?: number };
    return parsed.brandId === brandId && typeof parsed.exp === "number" && parsed.exp > Date.now();
  } catch {
    return false;
  }
}
