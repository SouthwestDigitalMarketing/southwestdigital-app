import "server-only";

import { createHmac, timingSafeEqual } from "node:crypto";
import { ZOHO_REGIONS, type ZohoRegionKey } from "./providers";

export const ZOHO_OAUTH_STATE_COOKIE = "swd-zoho-oauth-state";
export const ZOHO_MAIL_SCOPES = ["ZohoMail.messages.CREATE", "ZohoMail.accounts.READ"];

type ZohoOAuthState = {
  membershipId: string;
  brandId: string;
  region: ZohoRegionKey;
  returnOrigin: string;
  exp: number;
};

function stateSecret() {
  const secret = process.env.AUTH_SECRET?.trim();
  if (!secret) throw new Error("AUTH_SECRET is not configured.");
  return secret;
}

export function zohoOAuthCallbackOrigin(fallbackOrigin: string) {
  const configured = process.env.PLATFORM_BASE_URL?.trim();
  if (!configured) return fallbackOrigin;
  try {
    const url = new URL(configured);
    const isDev = process.env.NODE_ENV !== "production";
    if (url.protocol !== "https:" && !(isDev && url.protocol === "http:")) {
      throw new Error("PLATFORM_BASE_URL must use HTTPS for Zoho OAuth.");
    }
    return url.origin;
  } catch (error) {
    if (error instanceof Error && error.message.startsWith("PLATFORM_BASE_URL")) throw error;
    throw new Error("PLATFORM_BASE_URL must be a valid URL for Zoho OAuth.");
  }
}

export function createZohoOAuthState(input: {
  membershipId: string;
  brandId: string;
  region: ZohoRegionKey;
  returnOrigin: string;
}) {
  const payload = Buffer.from(
    JSON.stringify({
      membershipId: input.membershipId,
      brandId: input.brandId,
      region: input.region,
      returnOrigin: new URL(input.returnOrigin).origin,
      exp: Date.now() + 10 * 60 * 1000,
    }),
  ).toString("base64url");
  const signature = createHmac("sha256", stateSecret()).update(payload).digest("base64url");
  return `${payload}.${signature}`;
}

export function readZohoOAuthState(value: string): ZohoOAuthState | null {
  const [payload, signature] = value.split(".");
  if (!payload || !signature) return null;
  const expected = createHmac("sha256", stateSecret()).update(payload).digest("base64url");
  const validSignature =
    signature.length === expected.length && timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
  if (!validSignature) return null;
  try {
    const parsed = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as Partial<ZohoOAuthState>;
    if (
      typeof parsed.membershipId !== "string" ||
      typeof parsed.brandId !== "string" ||
      typeof parsed.region !== "string" ||
      typeof parsed.returnOrigin !== "string" ||
      typeof parsed.exp !== "number" ||
      parsed.exp <= Date.now() ||
      !ZOHO_REGIONS[parsed.region as ZohoRegionKey]
    ) {
      return null;
    }
    return {
      membershipId: parsed.membershipId,
      brandId: parsed.brandId,
      region: parsed.region as ZohoRegionKey,
      returnOrigin: parsed.returnOrigin,
      exp: parsed.exp,
    };
  } catch {
    return null;
  }
}

export function verifyZohoOAuthState(
  value: string,
  expected: { membershipId: string; brandId: string; returnOrigin: string },
) {
  const parsed = readZohoOAuthState(value);
  if (!parsed) return null;
  if (parsed.membershipId !== expected.membershipId) return null;
  if (parsed.brandId !== expected.brandId) return null;
  if (parsed.returnOrigin !== new URL(expected.returnOrigin).origin) return null;
  return parsed;
}

export function buildZohoAuthorizationUrl(input: {
  region: ZohoRegionKey;
  clientId: string;
  redirectUri: string;
  state: string;
}) {
  const region = ZOHO_REGIONS[input.region];
  const params = new URLSearchParams({
    client_id: input.clientId,
    response_type: "code",
    scope: ZOHO_MAIL_SCOPES.join(","),
    redirect_uri: input.redirectUri,
    access_type: "offline",
    prompt: "consent",
    state: input.state,
  });
  return `https://${region.accountsHost}/oauth/v2/auth?${params.toString()}`;
}

export function zohoTokenEndpoint(region: ZohoRegionKey) {
  return `https://${ZOHO_REGIONS[region].accountsHost}/oauth/v2/token`;
}

export function zohoRevokeEndpoint(region: ZohoRegionKey) {
  return `https://${ZOHO_REGIONS[region].accountsHost}/oauth/v2/token/revoke`;
}
