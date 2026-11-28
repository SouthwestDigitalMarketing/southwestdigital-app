import "server-only";
import { isQuoteFrozen, quoteFreezeSelect } from "./isQuoteFrozen";
import type { Prisma } from "@prisma/client";

export class QuoteMutationConflictError extends Error {}

/** Publication and signature use the same row lock, in quote -> engagement order. */
export async function lockQuoteMutation(
  tx: Prisma.TransactionClient,
  brandId: string,
  quoteId: string,
  intent: "publish" | "sign" | "send" | "edit" | "delete" | "restore" | "select" | "prepare" | "finishSend",
) {
  const rows = await tx.$queryRaw<Array<{ id: string }>>`
    SELECT id FROM quotes WHERE id = ${quoteId} AND "brandId" = ${brandId} FOR UPDATE
  `;
  if (rows.length !== 1) throw new QuoteMutationConflictError("Offer not found.");
  const quote = await tx.quote.findFirst({
    where: { id: quoteId, brandId },
    select: { id: true, ...quoteFreezeSelect, publishedAt: true, expiresAt: true, snapshotJson: true, firstSentAt: true },
  });
  if (!quote) throw new QuoteMutationConflictError("Offer not found.");
  if ((quote.status === "archived" && intent !== "delete" && intent !== "restore") || (quote.status === "completed" && (intent === "publish" || intent === "sign"))) throw new QuoteMutationConflictError("This offer is closed.");
  if (isQuoteFrozen(quote)) {
    throw new QuoteMutationConflictError("Signed offers and accepted or paid offers are frozen. Duplicate the offer to propose a new agreement.");
  }
  const snapshot = quote.snapshotJson as Record<string, unknown> | null;
  const claim = snapshot?.proposalSendClaim as { state?: string } | undefined;
  // A staff email glitch must never stop the client from choosing or signing.
  const clientIntent = intent === "sign" || intent === "select" || intent === "prepare";
  if (intent !== "finishSend" && !clientIntent && (claim?.state === "sending" || claim?.state === "unknown")) {
    throw new QuoteMutationConflictError("An email send is pending or needs staff delivery review. Resolve it before changing this offer.");
  }
  if ((intent === "sign" || intent === "select" || intent === "prepare") && (!quote.publishedAt || (quote.expiresAt && quote.expiresAt <= new Date()))) {
    throw new QuoteMutationConflictError("This offer is no longer available for signing.");
  }
  return quote;
}
