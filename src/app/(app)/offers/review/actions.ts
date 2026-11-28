"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireQuoteStaffOrThrow } from "@/lib/quotes/access";
import { assertQuoteNotFrozen, quoteFreezeSelect } from "@/lib/quotes/isQuoteFrozen";
import { lockQuoteMutation } from "@/lib/quotes/mutationLock";

/**
 * Expire selected old proposal links now. One click per batch, per-row
 * freeze guard: accepted, signed or paid quotes are refused and nothing else
 * in the batch is touched after the refusal.
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
  for (const [index, row] of rows.entries()) {
    if (!row) throw new Error(`Proposal not found: ${ids[index]}`);
    assertQuoteNotFrozen(row);
  }

  const now = new Date();
  const tokens: Array<string | null> = [];
  for (const row of rows) {
    if (!row) continue;
    await prisma.$transaction(async (tx) => {
      await lockQuoteMutation(tx, brand.id, row.id, "edit");
      await tx.quote.update({
        where: { id: row.id },
        data: { expiresAt: now, lastActivityAt: now },
      });
    });
    tokens.push(row.publicToken);
  }

  revalidatePath("/offers");
  revalidatePath("/offers/review");
  for (const token of tokens) {
    if (token) revalidatePath(`/proposal/${token}`);
  }
}
