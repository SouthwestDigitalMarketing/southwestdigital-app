import { cookies, headers } from "next/headers";
import { NextResponse } from "next/server";
import { IntegrationProvider, IntegrationStatus } from "@prisma/client";
import { requireAdminBrandOrThrow } from "@/lib/brands/staff";
import { prisma } from "@/lib/prisma";
import { requestOrigin } from "@/lib/stripe/requestOrigin";
import { encryptSecret } from "@/lib/secrets/encryption";
import {
  readYouTubeOAuthState,
  verifyYouTubeOAuthState,
  youtubeOAuthCallbackOrigin,
  YOUTUBE_OAUTH_STATE_COOKIE,
} from "@/lib/youtube/oauth";
import { YOUTUBE_INTEGRATION_KEY } from "@/lib/youtube/credentials";
import { isAuthorizedCallbackOrigin } from "@/lib/integrations/callbackOrigin";

function result(value: string, origin: string) {
  return NextResponse.redirect(new URL(`/settings?youtube=${value}`, origin));
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const origin = requestOrigin(await headers());
  const callbackOrigin = youtubeOAuthCallbackOrigin(origin);
  const state = url.searchParams.get("state");
  const code = url.searchParams.get("code");
  const parsedState = state ? readYouTubeOAuthState(state) : null;
  if (!parsedState || !await isAuthorizedCallbackOrigin(parsedState.returnOrigin, parsedState.brandId)) {
    return result("error", callbackOrigin);
  }

  if (origin === callbackOrigin && parsedState?.returnOrigin !== origin) {
    if (!parsedState) return result("error", origin);
    const relay = new URL("/api/youtube/callback", parsedState.returnOrigin);
    for (const key of ["code", "state", "error"] as const) {
      const value = url.searchParams.get(key);
      if (value) relay.searchParams.set(key, value);
    }
    return NextResponse.redirect(relay);
  }

  const cookieStore = await cookies();
  const storedState = cookieStore.get(YOUTUBE_OAUTH_STATE_COOKIE)?.value;
  cookieStore.delete(YOUTUBE_OAUTH_STATE_COOKIE);
  const { brand } = await requireAdminBrandOrThrow();
  if (!state || !storedState || state !== storedState || !verifyYouTubeOAuthState(state, brand.id, origin)) return result("error", origin);
  if (url.searchParams.get("error") || !code) return result("cancelled", origin);

  const clientId = process.env.YOUTUBE_OAUTH_CLIENT_ID?.trim();
  const clientSecret = process.env.YOUTUBE_OAUTH_CLIENT_SECRET?.trim();
  if (!clientId || !clientSecret) return result("not-configured", origin);
  const redirectUri = `${callbackOrigin}/api/youtube/callback`;
  const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ code, client_id: clientId, client_secret: clientSecret, redirect_uri: redirectUri, grant_type: "authorization_code" }),
  });
  if (!tokenResponse.ok) return result("error", origin);
  const token = (await tokenResponse.json()) as { access_token?: string; refresh_token?: string };
  if (!token.access_token || !token.refresh_token) return result("missing-refresh-token", origin);

  const channelResponse = await fetch("https://www.googleapis.com/youtube/v3/channels?part=id,snippet&mine=true", {
    headers: { Authorization: `Bearer ${token.access_token}` },
  });
  if (!channelResponse.ok) return result("error", origin);
  const channels = (await channelResponse.json()) as { items?: Array<{ id?: string; snippet?: { title?: string } }> };
  const channel = channels.items?.[0];
  if (!channel?.id) return result("no-channel", origin);

  await prisma.$transaction([
    prisma.brandIntegration.upsert({
      where: { brandId_key: { brandId: brand.id, key: YOUTUBE_INTEGRATION_KEY } },
      create: { brandId: brand.id, key: YOUTUBE_INTEGRATION_KEY, provider: IntegrationProvider.YOUTUBE, status: IntegrationStatus.ACTIVE, displayName: "YouTube", externalAccountId: channel.id, publicIdentifier: channel.snippet?.title ?? null, secretCiphertext: encryptSecret(token.refresh_token), secretKeyVersion: 1, lastVerifiedAt: new Date(), lastErrorAt: null, lastErrorCode: null },
      update: { provider: IntegrationProvider.YOUTUBE, status: IntegrationStatus.ACTIVE, displayName: "YouTube", externalAccountId: channel.id, publicIdentifier: channel.snippet?.title ?? null, secretCiphertext: encryptSecret(token.refresh_token), secretKeyVersion: 1, lastVerifiedAt: new Date(), lastErrorAt: null, lastErrorCode: null },
    }),
    prisma.brandTheme.update({ where: { brandId: brand.id }, data: { youtubeChannelId: channel.id } }),
  ]);
  return result("connected", origin);
}
