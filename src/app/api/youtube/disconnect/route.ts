import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { requireAdminBrandOrThrow } from "@/lib/brands/staff";
import { requestOrigin } from "@/lib/stripe/requestOrigin";
import { disconnectYouTube } from "@/lib/youtube/saveConnection";

export async function POST() {
  const { brand } = await requireAdminBrandOrThrow();
  const origin = requestOrigin(await headers());
  await disconnectYouTube(brand.id);
  return NextResponse.redirect(new URL("/settings?youtube=disconnected", origin), { status: 303 });
}
