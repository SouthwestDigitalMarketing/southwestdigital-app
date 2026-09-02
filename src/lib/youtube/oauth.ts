import "server-only";

import { createHmac, timingSafeEqual } from "node:crypto";

export const YOUTUBE_OAUTH_STATE_COOKIE = "swd-youtube-oauth-state";

type YouTubeOAuthState = {
  brandId: string;
  returnOrigin: string;
  exp: number;
};

function stateSecret() {
  const secret = process.env.AUTH_SECRET?.trim();
  if (!secret) throw new Error("AUTH_SECRET is not configured.");
  return secret;
}

export function youtubeOAuthCallbackOrigin(fallbackOrigin: string) {
  const configured = process.env.PLATFORM_BASE_URL?.trim();
  if (!configured) return fallbackOrigin;
  try {
    const url = new URL(configured);
    if (url.protocol !== "https:" && !(process.env.NODE_ENV !== "production" && url.protocol === "http:")) {
      throw new Error("PLATFORM_BASE_URL must use HTTPS for YouTube OAuth.");
    }
    return url.origin;
  } catch (error) {
    if (error instanceof Error && error.message.startsWith("PLATFORM_BASE_URL")) throw error;
    throw new Error("PLATFORM_BASE_URL must be a valid URL for YouTube OAuth.");
  }
}

export function createYouTubeOAuthState(brandId: string, returnOrigin: string) {
  const payload = Buffer.from(
    JSON.stringify({ brandId, returnOrigin: new URL(returnOrigin).origin, exp: Date.now() + 10 * 60 * 1000 }),
  ).toString("base64url");
  const signature = createHmac("sha256", stateSecret()).update(payload).digest("base64url");
  return `${payload}.${signature}`;
}

export function readYouTubeOAuthState(value: string): YouTubeOAuthState | null {
  const [payload, signature] = value.split(".");
  if (!payload || !signature) return null;
  const expected = createHmac("sha256", stateSecret()).update(payload).digest("base64url");
  const validSignature = signature.length === expected.length && timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
  if (!validSignature) return null;
  try {
    const parsed = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as Partial<YouTubeOAuthState>;
    if (
      typeof parsed.brandId !== "string" ||
      typeof parsed.returnOrigin !== "string" ||
      typeof parsed.exp !== "number" ||
      parsed.exp <= Date.now()
    ) return null;
    const returnUrl = new URL(parsed.returnOrigin);
    if (returnUrl.origin !== parsed.returnOrigin) return null;
    if (returnUrl.protocol !== "https:" && !(process.env.NODE_ENV !== "production" && returnUrl.protocol === "http:")) return null;
    return { brandId: parsed.brandId, returnOrigin: parsed.returnOrigin, exp: parsed.exp };
  } catch {
    return null;
  }
}

export function verifyYouTubeOAuthState(value: string, brandId: string, returnOrigin: string) {
  const parsed = readYouTubeOAuthState(value);
  return parsed?.brandId === brandId && parsed.returnOrigin === new URL(returnOrigin).origin;
}
