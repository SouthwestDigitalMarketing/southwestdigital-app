"use server";

import { revalidatePath } from "next/cache";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireQuoteStaffOrThrow } from "@/lib/quotes/access";
import { saveAcceptedCopy } from "@/lib/quotes/acceptedCopy";
import { assertQuoteNotFrozen, quoteFreezeSelect } from "@/lib/quotes/isQuoteFrozen";
import { lockQuoteMutation } from "@/lib/quotes/mutationLock";
import { MAX_PROPOSAL_VALIDITY_DAYS } from "@/lib/quotes/proposalValidity";

export async function saveAcceptedCopyAction(formData: FormData): Promise<void> {
  const { brand } = await requireQuoteStaffOrThrow();
  const id = formData.get("id");
  if (typeof id !== "string" || !id.trim()) throw new Error("Offer ID required.");
  await saveAcceptedCopy({ brandId: brand.id, quoteId: id.trim(), source: "backfill" });
  revalidatePath(`/offers/${id.trim()}`);
}

/** Staff edit of the per-proposal validity window (days, snapshot only). */
export async function updateProposalValidityAction(formData: FormData): Promise<void> {
  const { brand } = await requireQuoteStaffOrThrow();
  const id = formData.get("id");
  if (typeof id !== "string" || !id.trim()) throw new Error("Offer ID required.");
  const days = Math.floor(Number(formData.get("validityDays")));
  if (!Number.isFinite(days) || days < 1 || days > MAX_PROPOSAL_VALIDITY_DAYS) {
    throw new Error(`Validity must be 1–${MAX_PROPOSAL_VALIDITY_DAYS} days.`);
  }
  const quote = await prisma.quote.findFirst({
    where: { id: id.trim(), brandId: brand.id },
    select: { id: true, ...quoteFreezeSelect, snapshotJson: true },
  });
  if (!quote) throw new Error("Not found");
  assertQuoteNotFrozen(quote);
  if (!quote.snapshotJson || typeof quote.snapshotJson !== "object" || Array.isArray(quote.snapshotJson)) {
    throw new Error("Offer snapshot is malformed.");
  }
  const snapshot = { ...(quote.snapshotJson as Record<string, unknown>), proposalValidityDays: days };
  await prisma.$transaction(async (tx) => {
    await lockQuoteMutation(tx, brand.id, quote.id, "edit");
    await tx.quote.update({
      where: { id: quote.id },
      data: { snapshotJson: snapshot as Prisma.InputJsonValue },
    });
  });
  revalidatePath(`/offers/${quote.id}`);
}
