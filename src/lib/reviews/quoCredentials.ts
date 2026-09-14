import "server-only";

import { IntegrationProvider, IntegrationStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { decryptSecret } from "@/lib/secrets/encryption";

/** BrandIntegration.key for this brand's Quo SMS identity. */
export const QUO_INTEGRATION_KEY = "quo";

export type QuoSmsCredentials = {
  apiKey: string;
  /** E.164 from-number. Stored on BrandIntegration.publicIdentifier, with externalAccountId as fallback. */
  from: string;
  /** Optional Quo phoneNumberId, stored on BrandIntegration.externalPropertyId. */
  phoneNumberId?: string;
};

const NOT_CONFIGURED = "SMS is not configured for this brand.";

export async function getQuoSmsCredentials(brandId: string): Promise<QuoSmsCredentials> {
  const integration = await prisma.brandIntegration.findUnique({
    where: { brandId_key: { brandId, key: QUO_INTEGRATION_KEY } },
    select: {
      provider: true,
      status: true,
      secretCiphertext: true,
      publicIdentifier: true,
      externalAccountId: true,
      externalPropertyId: true,
    },
  });

  if (
    !integration ||
    integration.provider !== IntegrationProvider.QUO ||
    integration.status !== IntegrationStatus.ACTIVE ||
    !integration.secretCiphertext
  ) {
    throw new Error(NOT_CONFIGURED);
  }

  let apiKey = "";
  try {
    apiKey = decryptSecret(integration.secretCiphertext).trim();
  } catch {
    throw new Error(NOT_CONFIGURED);
  }

  const from = (integration.publicIdentifier?.trim() || integration.externalAccountId?.trim() || "");
  if (!apiKey || !from) throw new Error(NOT_CONFIGURED);

  const phoneNumberId = integration.externalPropertyId?.trim() || undefined;
  return phoneNumberId ? { apiKey, from, phoneNumberId } : { apiKey, from };
}
