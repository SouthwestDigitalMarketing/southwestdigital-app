"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireQuoteStaffOrThrow } from "@/lib/quotes/access";

export async function markQuoteSentAction(formData: FormData) {
  const { brand } = await requireQuoteStaffOrThrow();
  const id = (formData.get("id") as string | null)?.trim() ?? "";
  if (!id) throw new Error("Quote ID required");

  const quote = await prisma.quote.findFirst({
    where: { id, brandId: brand.id },
    select: { id: true, status: true },
  });
  if (!quote) throw new Error("Not found");
  if (quote.status !== "draft") throw new Error("Only draft quotes can be marked sent");

  await prisma.quote.update({
    where: { id: quote.id },
    data: { status: "sent" },
  });

  revalidatePath("/quotes");
  redirect(`/quotes/${id}?sent=1`);
}
