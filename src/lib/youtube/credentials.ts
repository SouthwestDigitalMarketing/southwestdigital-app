import "server-only";

import { IntegrationProvider, IntegrationStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { decryptSecret } from "@/lib/secrets/encryption";

export const YOUTUBE_INTEGRATION_KEY = "youtube";

export function youtubeRefreshTokenEnvKey(slug: string) {
  return `YOUTUBE_REFRESH_TOKEN_${slug.toUpperCase().replace(/-/g, "_")}`;
}

export async function getYouTubeRefreshToken(brandId: string, slug: string) {
  const integration = await prisma.brandIntegration.findUnique({
    where: { brandId_key: { brandId, key: YOUTUBE_INTEGRATION_KEY } },
    select: { secretCiphertext: true },
  });
  if (integration?.secretCiphertext) return decryptSecret(integration.secretCiphertext);
  return process.env[youtubeRefreshTokenEnvKey(slug)]?.trim() || null;
}

export async function getYouTubeIntegration(brandId: string) {
  return prisma.brandIntegration.findUnique({
    where: { brandId_key: { brandId, key: YOUTUBE_INTEGRATION_KEY } },
    select: { status: true, externalAccountId: true, publicIdentifier: true, lastVerifiedAt: true },
  });
}

export const youtubeIntegrationDefaults = {
  key: YOUTUBE_INTEGRATION_KEY,
  provider: IntegrationProvider.YOUTUBE,
  status: IntegrationStatus.ACTIVE,
};
