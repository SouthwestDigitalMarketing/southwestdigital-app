"use server";

import { revalidatePath } from "next/cache";
import { requireQuoteStaffOrThrow } from "@/lib/quotes/access";
import { saveAcceptedCopy } from "@/lib/quotes/acceptedCopy";

export async function saveAcceptedCopyAction(formData: FormData): Promise<void> {
  const { brand } = await requireQuoteStaffOrThrow();
  const id = formData.get("id");
  if (typeof id !== "string" || !id.trim()) throw new Error("Offer ID required.");
  await saveAcceptedCopy({ brandId: brand.id, quoteId: id.trim(), source: "backfill" });
  revalidatePath(`/offers/${id.trim()}`);
}
