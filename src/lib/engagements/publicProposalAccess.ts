import "server-only";

import { prisma } from "@/lib/prisma";
import { resolvePublicBrand } from "@/lib/brands/resolve";

export async function hasPublicProposalAccess(
  request: Request,
  engagementId: string,
  capability: "checkout" | "agreement" | "reconcile" = "checkout",
) {
  const token = request.headers.get("x-proposal-token")?.trim();
  if (!token) return false;
  const brand = await resolvePublicBrand(request.headers.get("x-hostname") ?? new URL(request.url).hostname);
  if (!brand) return false;
  const quote = await prisma.quote.findFirst({
    where: {
      brandId: brand.id,
      engagementId,
      publicToken: token,
      publishedAt: { not: null },
    },
    select: { id: true, status: true, expiresAt: true, engagement: { select: { brandId: true, signedAt: true } } },
  });
  if (!quote || quote.engagement?.brandId !== brand.id) return false;
  // Expiration ends new checkout, not access to already signed evidence or
  // reconciliation of a payment that was submitted before expiry.
  if (capability !== "checkout" && quote.engagement.signedAt) return true;
  return quote.status !== "archived" && quote.status !== "completed" &&
    (!quote.expiresAt || quote.expiresAt.getTime() > Date.now());
}

export function publicProposalNotFound() {
  return Response.json({ error: "Proposal not found" }, { status: 404 });
}
