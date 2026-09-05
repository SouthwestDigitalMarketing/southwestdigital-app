import { cookies, headers } from "next/headers";
import { NextResponse } from "next/server";
import { requireStaffBrandOrThrow } from "@/lib/brands/staff";
import { requestOrigin } from "@/lib/stripe/requestOrigin";
import { upsertZohoConnection } from "@/lib/emailConnections/repository";
import { isAuthorizedCallbackOrigin } from "@/lib/integrations/callbackOrigin";
import {
  ZOHO_OAUTH_STATE_COOKIE,
  readZohoOAuthState,
  verifyZohoOAuthState,
  zohoOAuthCallbackOrigin,
} from "@/lib/emailConnections/zohoOAuth";
import { exchangeZohoAuthorizationCode, fetchPrimaryZohoAccount } from "@/lib/emailConnections/zohoMail";

function result(value: string, origin: string) {
  return NextResponse.redirect(new URL(`/settings?email=${value}`, origin));
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const origin = requestOrigin(await headers());
  const callbackOrigin = zohoOAuthCallbackOrigin(origin);
  const cookieStore = await cookies();
  const state = url.searchParams.get("state");
  const code = url.searchParams.get("code");
  const signedState = state ? readZohoOAuthState(state) : null;
  if (!signedState || !await isAuthorizedCallbackOrigin(signedState.returnOrigin, signedState.brandId)) {
    return result("error", callbackOrigin);
  }

  // If Zoho hit the platform base URL but the user was signing in from a
  // different origin, relay the callback so the user's session cookies are
  // available for authorization.
  if (origin === callbackOrigin) {
    if (signedState.returnOrigin !== origin) {
      const relay = new URL("/api/email-connections/zoho/callback", signedState.returnOrigin);
      for (const key of ["code", "state", "error"] as const) {
        const value = url.searchParams.get(key);
        if (value) relay.searchParams.set(key, value);
      }
      return NextResponse.redirect(relay);
    }
  }

  const storedState = cookieStore.get(ZOHO_OAUTH_STATE_COOKIE)?.value;
  cookieStore.delete(ZOHO_OAUTH_STATE_COOKIE);

  const ctx = await requireStaffBrandOrThrow();
  if (!ctx.membership) return result("access-denied", origin);

  if (!state || !storedState || state !== storedState) return result("error", origin);
  const parsed = verifyZohoOAuthState(state, {
    membershipId: ctx.membership.id,
    brandId: ctx.brand.id,
    returnOrigin: origin,
  });
  if (!parsed) return result("error", origin);

  if (url.searchParams.get("error") || !code) return result("cancelled", origin);

  const clientId = process.env.ZOHO_MAIL_CLIENT_ID?.trim();
  const clientSecret = process.env.ZOHO_MAIL_CLIENT_SECRET?.trim();
  if (!clientId || !clientSecret) return result("not-configured", origin);

  const redirectUri = `${callbackOrigin}/api/email-connections/zoho/callback`;

  try {
    const token = await exchangeZohoAuthorizationCode({
      region: parsed.region,
      clientId,
      clientSecret,
      redirectUri,
      code,
    });
    if (!token.refreshToken) return result("missing-refresh-token", origin);

    const account = await fetchPrimaryZohoAccount({
      region: parsed.region,
      accessToken: token.accessToken,
    });

    await upsertZohoConnection({
      brandId: ctx.brand.id,
      membershipId: ctx.membership.id,
      region: parsed.region,
      emailAddress: account.primaryEmailAddress,
      displayName: account.displayName,
      accountIdentifier: account.accountId,
      accessToken: token.accessToken,
      refreshToken: token.refreshToken,
      expiresInSeconds: token.expiresInSeconds,
      scopes: token.scope,
    });

    return result("connected", origin);
  } catch (error) {
    console.error("[email-connections/zoho/callback] Failed:", error);
    return result("error", origin);
  }
}
