import "server-only";

import { IntegrationProvider, IntegrationStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { decryptSecret, encryptSecret } from "@/lib/secrets/encryption";
import { YOUTUBE_INTEGRATION_KEY } from "@/lib/youtube/credentials";

export async function siblingYouTubeBrandIds(brandId: string, channelId: string) {
  const [themeSiblings, integrationSiblings] = await Promise.all([
    prisma.brandTheme.findMany({
      where: { youtubeChannelId: channelId, brandId: { not: brandId } },
      select: { brandId: true },
    }),
    prisma.brandIntegration.findMany({
      where: {
        key: YOUTUBE_INTEGRATION_KEY,
        brandId: { not: brandId },
        externalAccountId: channelId,
      },
      select: { brandId: true },
    }),
  ]);
  return [...new Set([...themeSiblings, ...integrationSiblings].map((row) => row.brandId))];
}

export async function saveYouTubeConnection({
  brandId,
  channelId,
  channelTitle,
  refreshToken,
}: {
  brandId: string;
  channelId: string;
  channelTitle: string | null;
  refreshToken: string;
}) {
  const secretCiphertext = encryptSecret(refreshToken);
  const now = new Date();
  const payload = {
    provider: IntegrationProvider.YOUTUBE,
    status: IntegrationStatus.ACTIVE,
    displayName: "YouTube",
    externalAccountId: channelId,
    publicIdentifier: channelTitle,
    secretCiphertext,
    secretKeyVersion: 1,
    lastVerifiedAt: now,
    lastErrorAt: null,
    lastErrorCode: null,
  };
  const extraBrandIds = await siblingYouTubeBrandIds(brandId, channelId);

  await prisma.$transaction([
    prisma.brandIntegration.upsert({
      where: { brandId_key: { brandId, key: YOUTUBE_INTEGRATION_KEY } },
      create: { brandId, key: YOUTUBE_INTEGRATION_KEY, ...payload },
      update: payload,
    }),
    ...extraBrandIds.map((id) =>
      prisma.brandIntegration.upsert({
        where: { brandId_key: { brandId: id, key: YOUTUBE_INTEGRATION_KEY } },
        create: { brandId: id, key: YOUTUBE_INTEGRATION_KEY, ...payload },
        update: payload,
      }),
    ),
    prisma.brandTheme.update({
      where: { brandId },
      data: { youtubeChannelId: channelId },
    }),
  ]);
}

export async function disconnectYouTube(brandId: string) {
  const integration = await prisma.brandIntegration.findUnique({
    where: { brandId_key: { brandId, key: YOUTUBE_INTEGRATION_KEY } },
    select: { secretCiphertext: true, externalAccountId: true },
  });

  const siblings = integration?.externalAccountId
    ? await prisma.brandIntegration.count({
        where: {
          key: YOUTUBE_INTEGRATION_KEY,
          brandId: { not: brandId },
          externalAccountId: integration.externalAccountId,
        },
      })
    : 0;

  if (integration?.secretCiphertext && siblings === 0) {
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
      where: { brandId, key: YOUTUBE_INTEGRATION_KEY },
    }),
    prisma.brandTheme.update({
      where: { brandId },
      data: { youtubeChannelId: null },
    }),
  ]);
}

export async function markYouTubeAuthError(brandId: string, code: string) {
  await prisma.brandIntegration.updateMany({
    where: { brandId, key: YOUTUBE_INTEGRATION_KEY },
    data: {
      status: IntegrationStatus.ERROR,
      lastErrorAt: new Date(),
      lastErrorCode: code.slice(0, 80),
    },
  });
}
