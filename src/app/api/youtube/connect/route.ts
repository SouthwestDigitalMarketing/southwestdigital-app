import { cookies, headers } from "next/headers";
import { NextResponse } from "next/server";
import { requireStaffBrandOrThrow } from "@/lib/brands/staff";
import { requestOrigin } from "@/lib/stripe/requestOrigin";
import { createYouTubeOAuthState, YOUTUBE_OAUTH_STATE_COOKIE } from "@/lib/youtube/oauth";

const scopes = ["https://www.googleapis.com/auth/yt-analytics.readonly", "https://www.googleapis.com/auth/youtube.readonly"];

export async function GET() {
  const { brand } = await requireStaffBrandOrThrow();
  const clientId = process.env.YOUTUBE_OAUTH_CLIENT_ID?.trim();
  if (!clientId) return NextResponse.redirect(new URL("/settings?youtube=not-configured", requestOrigin(await headers())));

  const state = createYouTubeOAuthState(brand.id);
  const redirectUri = `${requestOrigin(await headers())}/api/youtube/callback`;
  const url = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  url.search = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: "code",
    access_type: "offline",
    prompt: "consent",
    scope: scopes.join(" "),
    state,
  }).toString();

  (await cookies()).set(YOUTUBE_OAUTH_STATE_COOKIE, state, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: 600,
    path: "/api/youtube",
  });
  return NextResponse.redirect(url);
}
