import "server-only";
import type { Prisma } from "@prisma/client";

export class QuoteMutationConflictError extends Error {}

/** Publication and signature use the same row lock, in quote -> engagement order. */
export async function lockQuoteMutation(
  tx: Prisma.TransactionClient,
  brandId: string,
  quoteId: string,
  intent: "publish" | "sign",
) {
  const rows = await tx.$queryRaw<Array<{ id: string }>>`
    SELECT id FROM quotes WHERE id = ${quoteId} AND "brandId" = ${brandId} FOR UPDATE
  `;
  if (rows.length !== 1) throw new QuoteMutationConflictError("Offer not found.");
  const quote = await tx.quote.findFirst({
    where: { id: quoteId, brandId },
    select: { id: true, status: true, publishedAt: true, expiresAt: true, engagement: { select: { signedAt: true } } },
  });
  if (!quote) throw new QuoteMutationConflictError("Offer not found.");
  if (quote.status === "archived" || quote.status === "completed") throw new QuoteMutationConflictError("This offer is closed.");
  if (intent === "publish" && (quote.engagement?.signedAt || quote.status === "accepted")) {
    throw new QuoteMutationConflictError("Signed offers cannot be republished or reassigned. Duplicate the offer to propose a new agreement.");
  }
  if (intent === "sign" && (!quote.publishedAt || (quote.expiresAt && quote.expiresAt <= new Date()))) {
    throw new QuoteMutationConflictError("This offer is no longer available for signing.");
  }
  return quote;
}
