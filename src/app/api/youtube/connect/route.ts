import { cookies, headers } from "next/headers";
import { NextResponse } from "next/server";
import { requireAdminBrandOrThrow } from "@/lib/brands/staff";
import { requestOrigin } from "@/lib/stripe/requestOrigin";
import {
  createYouTubeOAuthState,
  youtubeOAuthCallbackOrigin,
  YOUTUBE_OAUTH_STATE_COOKIE,
} from "@/lib/youtube/oauth";

const scopes = ["https://www.googleapis.com/auth/yt-analytics.readonly", "https://www.googleapis.com/auth/youtube.readonly"];

export async function GET() {
  const origin = requestOrigin(await headers());
  try {
    const { brand } = await requireAdminBrandOrThrow();
    const clientId = process.env.YOUTUBE_OAUTH_CLIENT_ID?.trim();
    if (!clientId) return NextResponse.redirect(new URL("/settings?youtube=not-configured", origin));

    const state = createYouTubeOAuthState(brand.id, origin);
    const redirectUri = `${youtubeOAuthCallbackOrigin(origin)}/api/youtube/callback`;
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
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("[youtube/connect] failed:", message, error);
    const target = new URL("/settings", origin);
    target.searchParams.set("youtube", "error");
    target.searchParams.set("reason", message.slice(0, 200));
    return NextResponse.redirect(target);
  }
}
