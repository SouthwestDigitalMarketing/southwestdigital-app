"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireQuoteStaffOrThrow } from "@/lib/quotes/access";
import { isQuoteFrozen, quoteFreezeSelect } from "@/lib/quotes/isQuoteFrozen";
import { lockQuoteMutation } from "@/lib/quotes/mutationLock";

/**
 * Expire selected old proposal links now. One click per batch; per-row
 * freeze guard: accepted, signed or paid quotes are skipped and reported
 * (the engagement may have been accepted after the review list rendered),
 * never expired — and the rest of the batch still goes through.
 */
export async function expireReviewQuotesAction(formData: FormData): Promise<void> {
  const { brand } = await requireQuoteStaffOrThrow();
  const ids = [
    ...new Set(
      formData
        .getAll("ids")
        .filter(
          (value): value is string => typeof value === "string" && value.trim().length > 0,
        )
        .map((value) => value.trim()),
    ),
  ];
  if (ids.length === 0) throw new Error("Select at least one proposal.");

  const rows = await Promise.all(
    ids.map((id) =>
      prisma.quote.findFirst({
        where: { id, brandId: brand.id },
        select: { id: true, publicToken: true, ...quoteFreezeSelect },
      }),
    ),
  );

  const now = new Date();
  const tokens: Array<string | null> = [];
  let expired = 0;
  let skipped = 0;
  for (const [index, row] of rows.entries()) {
    if (!row) throw new Error(`Proposal not found: ${ids[index]}`);
    if (isQuoteFrozen(row)) {
      skipped += 1;
      continue;
    }
    await prisma.$transaction(async (tx) => {
      await lockQuoteMutation(tx, brand.id, row.id, "edit");
      await tx.quote.update({
        where: { id: row.id },
        data: { expiresAt: now, lastActivityAt: now },
      });
    });
    expired += 1;
    tokens.push(row.publicToken);
  }

  revalidatePath("/offers");
  revalidatePath("/offers/review");
  for (const token of tokens) {
    if (token) revalidatePath(`/proposal/${token}`);
  }
  redirect(`/offers/review?expired=${expired}&skipped=${skipped}`);
}
