import "server-only";

import { IntegrationStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";

/** BrandIntegration.key for this brand's public Google review URL. Provider is OTHER. */
export const GOOGLE_REVIEW_INTEGRATION_KEY = "google-review";

export function parseGoogleReviewUrl(raw: string): string {
  let url: URL;
  try {
    url = new URL(raw.trim());
  } catch {
    throw new Error("Enter a valid https Google review URL.");
  }
  if (url.protocol !== "https:") throw new Error("The Google review URL must use https.");
  if (url.username || url.password) throw new Error("The Google review URL cannot include credentials.");
  return url.href;
}

export async function resolveGoogleReviewUrl(brandId: string): Promise<string | null> {
  const integration = await prisma.brandIntegration.findUnique({
    where: { brandId_key: { brandId, key: GOOGLE_REVIEW_INTEGRATION_KEY } },
    select: { status: true, publicIdentifier: true },
  });
  if (!integration || integration.status !== IntegrationStatus.ACTIVE) return null;
  const stored = integration.publicIdentifier?.trim();
  if (!stored) return null;
  try {
    return parseGoogleReviewUrl(stored);
  } catch {
    return null;
  }
}
