import "server-only";

import { prisma } from "@/lib/prisma";
import { resolvePublicBrand } from "@/lib/brands/resolve";

export type PublicProposalCapability = "read" | "select" | "sign" | "pay" | "receipt";

export type ResolvedPublicBrand = NonNullable<Awaited<ReturnType<typeof resolvePublicBrand>>>;

export type PublicProposalQuote = {
  id: string;
  status: string;
  expiresAt: Date | null;
  engagement: { brandId: string; signedAt: Date | null } | null;
};

const WITHDRAWN_STATUSES = new Set(["archived", "completed", "rejected"]);

export async function findPublishedPublicQuote(input: {
  hostname: string | null;
  token: string | null;
  engagementId?: string;
}): Promise<{ brand: ResolvedPublicBrand; quote: PublicProposalQuote } | null> {
  const token = input.token?.trim() ?? "";
  if (!token) return null;

  const brand = await resolvePublicBrand(input.hostname);
  if (!brand) return null;

  const quote = await prisma.quote.findFirst({
    where: {
      brandId: brand.id,
      publicToken: token,
      publishedAt: { not: null },
      ...(input.engagementId ? { engagementId: input.engagementId } : {}),
    },
    select: {
      id: true,
      status: true,
      expiresAt: true,
      engagement: { select: { brandId: true, signedAt: true } },
    },
  });
  // Quote is already brand-scoped. A missing engagement is an unsigned live
  // offer (first-view self-heal). A loaded engagement on another brand is not.
  if (!quote) return null;
  if (quote.engagement?.brandId && quote.engagement.brandId !== brand.id) return null;
  return { brand, quote };
}

export function quoteAllowsPublicCapability(
  quote: PublicProposalQuote,
  capability: PublicProposalCapability,
): boolean {
  const withdrawn = WITHDRAWN_STATUSES.has(quote.status);
  const expired = quote.expiresAt !== null && quote.expiresAt.getTime() <= Date.now();
  const signed = Boolean(quote.engagement?.signedAt);

  switch (capability) {
    case "read":
      // A completed (paid) quote stays readable: the paid client's proposal
      // page must keep rendering (so the Spec 00 backfill self-fetch sees
      // the real page, not a receipt redirect that fails closed). Every
      // other withdrawn status still refuses. Paid implies signed in every
      // settlement flow, so an unsigned completed quote still fails closed.
      if (quote.status === "completed") return signed;
      return !withdrawn && (!expired || signed);
    case "select":
      return !withdrawn && !expired && !signed;
    case "sign":
      // A signed client retrying sign after expiry gets the existing
      // idempotent success — including on a completed (paid) quote, where the
      // sign route's signed early-return answers `ok`. Unsigned+expired and
      // unsigned completed are still refused.
      if (quote.status === "completed") return signed;
      return !withdrawn && (!expired || signed);
    case "pay":
      return !withdrawn && signed;
    case "receipt":
      return signed;
  }
}

export async function hasPublicProposalAccess(
  request: Request,
  engagementId: string,
  capability: PublicProposalCapability | readonly PublicProposalCapability[],
): Promise<boolean> {
  const token = request.headers.get("x-proposal-token")?.trim() ?? null;
  const hostname = request.headers.get("x-hostname") ?? new URL(request.url).hostname;
  const found = await findPublishedPublicQuote({ hostname, token, engagementId });
  if (!found) return false;
  const capabilities = typeof capability === "string" ? [capability] : capability;
  return capabilities.some((item) => quoteAllowsPublicCapability(found.quote, item));
}

export function publicProposalNotFound() {
  return Response.json({ error: "Proposal not found" }, { status: 404 });
}
