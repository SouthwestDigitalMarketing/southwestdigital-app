import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { requireAdminBrandOrThrow } from "@/lib/brands/staff";
import { prisma } from "@/lib/prisma";
import { requestOrigin } from "@/lib/stripe/requestOrigin";
import { decryptSecret } from "@/lib/secrets/encryption";
import { YOUTUBE_INTEGRATION_KEY } from "@/lib/youtube/credentials";

export async function POST() {
  const { brand } = await requireAdminBrandOrThrow();
  const origin = requestOrigin(await headers());

  const integration = await prisma.brandIntegration.findUnique({
    where: { brandId_key: { brandId: brand.id, key: YOUTUBE_INTEGRATION_KEY } },
    select: { secretCiphertext: true },
  });

  if (integration?.secretCiphertext) {
    try {
      const token = decryptSecret(integration.secretCiphertext);
      await fetch("https://oauth2.googleapis.com/revoke", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({ token }),
      });
    } catch {
      // best-effort revocation; local delete proceeds regardless
    }
  }

  await prisma.$transaction([
    prisma.brandIntegration.deleteMany({
      where: { brandId: brand.id, key: YOUTUBE_INTEGRATION_KEY },
    }),
    prisma.brandTheme.update({
      where: { brandId: brand.id },
      data: { youtubeChannelId: null },
    }),
  ]);

  return NextResponse.redirect(new URL("/settings?youtube=disconnected", origin), { status: 303 });
}
