import "server-only";

import { EmailConnectionProvider, EmailConnectionStatus, type EmailConnection } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { decryptSecret, encryptSecret } from "@/lib/secrets/encryption";
import { parseZohoRegion, type ZohoRegionKey } from "./providers";
import { refreshZohoAccessToken, ZohoApiError } from "./zohoMail";

export type PublicEmailConnection = {
  id: string;
  provider: EmailConnectionProvider;
  region: string | null;
  emailAddress: string;
  displayName: string | null;
  status: EmailConnectionStatus;
  lastError: string | null;
  lastVerifiedAt: Date | null;
  connectedAt: Date;
};

export function toPublicConnection(row: EmailConnection): PublicEmailConnection {
  return {
    id: row.id,
    provider: row.provider,
    region: row.region,
    emailAddress: row.emailAddress,
    displayName: row.displayName,
    status: row.status,
    lastError: row.lastError,
    lastVerifiedAt: row.lastVerifiedAt,
    connectedAt: row.createdAt,
  };
}

export async function getMembershipEmailConnection(membershipId: string) {
  return prisma.emailConnection.findUnique({ where: { membershipId } });
}

export async function upsertZohoConnection(input: {
  brandId: string;
  membershipId: string;
  region: ZohoRegionKey;
  emailAddress: string;
  displayName: string | null;
  accountIdentifier: string;
  accessToken: string;
  refreshToken: string;
  expiresInSeconds: number;
  scopes: string | null;
}) {
  const accessTokenExpiresAt = new Date(Date.now() + Math.max(60, input.expiresInSeconds - 60) * 1000);
  const encryptedAccess = encryptSecret(input.accessToken);
  const encryptedRefresh = encryptSecret(input.refreshToken);
  const base = {
    brandId: input.brandId,
    provider: EmailConnectionProvider.ZOHO,
    region: input.region,
    emailAddress: input.emailAddress,
    displayName: input.displayName,
    accountIdentifier: input.accountIdentifier,
    accessTokenCiphertext: encryptedAccess,
    refreshTokenCiphertext: encryptedRefresh,
    accessTokenExpiresAt,
    scopes: input.scopes,
    status: EmailConnectionStatus.ACTIVE,
    lastError: null,
    lastVerifiedAt: new Date(),
  };
  return prisma.emailConnection.upsert({
    where: { membershipId: input.membershipId },
    create: { ...base, membershipId: input.membershipId },
    update: base,
  });
}

export async function deleteEmailConnection(input: { id: string; brandId: string; membershipId: string }) {
  return prisma.emailConnection.deleteMany({
    where: { id: input.id, brandId: input.brandId, membershipId: input.membershipId },
  });
}

export async function markEmailConnectionError(id: string, message: string) {
  await prisma.emailConnection.update({
    where: { id },
    data: { status: EmailConnectionStatus.ERROR, lastError: message.slice(0, 500) },
  });
}

// Return a live access token, refreshing via the provider if the stored one is
// expired or within the safety window. Rotates the stored refresh token when
// the provider issues a new one. Marks the connection as REVOKED if the
// provider refuses the refresh token (only 400/401 responses — network errors
// leave the connection alone so a transient outage doesn't wipe access).
export async function getFreshAccessToken(connection: EmailConnection): Promise<string> {
  if (connection.provider !== EmailConnectionProvider.ZOHO) {
    throw new Error(`Provider ${connection.provider} is not yet supported for sending.`);
  }
  const region = parseZohoRegion(connection.region);
  if (!region) throw new Error("Zoho region on this connection is invalid.");

  const now = Date.now();
  const stillFresh = connection.accessTokenExpiresAt && connection.accessTokenExpiresAt.getTime() - 60_000 > now;
  if (stillFresh) return decryptSecret(connection.accessTokenCiphertext);

  const clientId = process.env.ZOHO_MAIL_CLIENT_ID?.trim();
  const clientSecret = process.env.ZOHO_MAIL_CLIENT_SECRET?.trim();
  if (!clientId || !clientSecret) throw new Error("Zoho OAuth is not configured on this server.");

  const refreshToken = decryptSecret(connection.refreshTokenCiphertext);
  let refreshed;
  try {
    refreshed = await refreshZohoAccessToken({ region, clientId, clientSecret, refreshToken });
  } catch (error) {
    if (error instanceof ZohoApiError && (error.status === 400 || error.status === 401)) {
      await prisma.emailConnection.update({
        where: { id: connection.id },
        data: {
          status: EmailConnectionStatus.REVOKED,
          lastError: `Refresh rejected: ${error.body.slice(0, 400)}`,
        },
      });
    }
    throw error;
  }

  const accessTokenExpiresAt = new Date(Date.now() + Math.max(60, refreshed.expiresInSeconds - 60) * 1000);
  await prisma.emailConnection.update({
    where: { id: connection.id },
    data: {
      accessTokenCiphertext: encryptSecret(refreshed.accessToken),
      refreshTokenCiphertext: refreshed.refreshToken
        ? encryptSecret(refreshed.refreshToken)
        : connection.refreshTokenCiphertext,
      accessTokenExpiresAt,
      status: EmailConnectionStatus.ACTIVE,
      lastError: null,
      lastVerifiedAt: new Date(),
    },
  });
  return refreshed.accessToken;
}
