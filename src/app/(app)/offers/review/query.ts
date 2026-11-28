import type { Prisma } from "@prisma/client";

/**
 * One-time old-links review: sent, unaccepted, unfrozen quotes that never
 * got an expiry stamp, oldest first. Nothing expires without a staff click —
 * the expire action below handles the writes.
 */
export function oldLinksReviewWhere(brandId: string): Prisma.QuoteWhereInput {
  return {
    brandId,
    status: "sent",
    expiresAt: null,
    OR: [{ engagementId: null }, { engagement: { signedAt: null } }],
  };
}

export const oldLinksReviewOrderBy: Prisma.QuoteOrderByWithRelationInput[] = [
  { sentAt: "asc" },
  { id: "asc" },
];
