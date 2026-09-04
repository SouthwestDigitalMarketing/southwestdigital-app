import { cookies, headers } from "next/headers";
import { NextResponse } from "next/server";
import { requireStaffBrandOrThrow } from "@/lib/brands/staff";
import { requestOrigin } from "@/lib/stripe/requestOrigin";
import { parseZohoRegion } from "@/lib/emailConnections/providers";
import {
  ZOHO_OAUTH_STATE_COOKIE,
  buildZohoAuthorizationUrl,
  createZohoOAuthState,
  zohoOAuthCallbackOrigin,
} from "@/lib/emailConnections/zohoOAuth";

export async function POST(request: Request) {
  const clientId = process.env.ZOHO_MAIL_CLIENT_ID?.trim();
  if (!clientId) {
    return NextResponse.json(
      { error: "Zoho OAuth is not configured. Ask the platform administrator to set ZOHO_MAIL_CLIENT_ID and ZOHO_MAIL_CLIENT_SECRET." },
      { status: 500 },
    );
  }

  const form = await request.formData().catch(() => null);
  const region = parseZohoRegion(form?.get("region"));
  if (!region) {
    return NextResponse.json({ error: "Choose a Zoho region." }, { status: 400 });
  }

  const ctx = await requireStaffBrandOrThrow();
  if (!ctx.membership) {
    return NextResponse.json({ error: "Only brand members can connect a mailbox." }, { status: 403 });
  }

  const origin = requestOrigin(await headers());
  const callbackOrigin = zohoOAuthCallbackOrigin(origin);
  const redirectUri = `${callbackOrigin}/api/email-connections/zoho/callback`;

  const state = createZohoOAuthState({
    membershipId: ctx.membership.id,
    brandId: ctx.brand.id,
    region,
    returnOrigin: origin,
  });

  const cookieStore = await cookies();
  cookieStore.set(ZOHO_OAUTH_STATE_COOKIE, state, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 600,
  });

  const authorizationUrl = buildZohoAuthorizationUrl({
    region,
    clientId,
    redirectUri,
    state,
  });
  return NextResponse.redirect(authorizationUrl, { status: 303 });
}
