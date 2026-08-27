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
  if (quote.status !== "draft" && quote.status !== "completed") {
    throw new Error("Only unsent offers can be marked sent");
  }

  await prisma.quote.update({
    where: { id: quote.id },
    data: { status: "sent", sentAt: new Date() },
  });

  revalidatePath("/offers");
  redirect(`/offers/${id}?sent=1`);
}

export async function setOfferStatusAction(formData: FormData) {
  const { brand } = await requireQuoteStaffOrThrow();
  const id = (formData.get("id") as string | null)?.trim() ?? "";
  const status = (formData.get("status") as string | null)?.trim() ?? "";
  if (!id) throw new Error("Offer ID required");
  if (
    status !== "draft" &&
    status !== "completed" &&
    status !== "archived" &&
    status !== "sent" &&
    status !== "accepted" &&
    status !== "rejected"
  ) {
    throw new Error("Invalid offer status.");
  }

  const quote = await prisma.quote.findFirst({
    where: { id, brandId: brand.id },
    select: { id: true, sentAt: true },
  });
  if (!quote) throw new Error("Not found");

  await prisma.quote.update({
    where: { id: quote.id },
    data: {
      status,
      ...(status === "sent" && !quote.sentAt ? { sentAt: new Date() } : {}),
    },
  });

  revalidatePath("/offers");
  revalidatePath(`/offers/${id}`);
}
