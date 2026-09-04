"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireStaffBrandOrThrow } from "@/lib/brands/staff";
import { isDiscountDeadlineMode, isDiscountKind, parseDiscountActivationMode } from "@/lib/discounts/kinds";

function clean(value: FormDataEntryValue | null) {
  return typeof value === "string" ? value.trim() : "";
}

function parseDiscountInput(formData: FormData) {
  const name = clean(formData.get("name"));
  const kind = clean(formData.get("kind"));
  const deadlineMode = clean(formData.get("deadlineMode")) || "relative";
  const showOnFirstOpen =
    formData.get("showOnFirstOpen") === "on" || clean(formData.get("activationMode")) === "immediate";
  const activationMode = parseDiscountActivationMode(showOnFirstOpen ? "immediate" : "held");
  const title = clean(formData.get("title"));
  const details = clean(formData.get("details"));
  const percent = Math.min(100, Math.max(1, Number(formData.get("percent")) || 10));
  const amount = Math.max(1, Number(formData.get("amount")) || 250);
  const durationDays = Math.min(365, Math.max(1, Number(formData.get("durationDays")) || 14));
  const deadlineDateRaw = clean(formData.get("deadlineDate"));
  const deadlineDate = /^\d{4}-\d{2}-\d{2}$/.test(deadlineDateRaw)
    ? new Date(`${deadlineDateRaw}T00:00:00`)
    : null;
  const contactIdRaw = clean(formData.get("contactId"));
  const contactId = contactIdRaw || null;
  const offerIds = [...new Set(formData.getAll("offerIds").filter((value): value is string => typeof value === "string" && value.trim().length > 0).map((value) => value.trim()))];

  if (!name) throw new Error("Name is required.");
  if (!isDiscountKind(kind)) throw new Error("Choose a valid benefit type.");
  if (!isDiscountDeadlineMode(deadlineMode)) throw new Error("Choose a valid deadline.");
  if (deadlineMode === "date" && !deadlineDate) throw new Error("Choose a deadline date.");

  return {
    name,
    kind,
    title,
    details,
    percent,
    amount,
    activationMode,
    activationDelayDays: 0,
    deadlineMode,
    durationDays,
    deadlineDate,
    contactId,
    offerIds,
  };
}

async function validateContactBelongsToBrand(contactId: string | null, brandId: string) {
  if (!contactId) return;
  const contact = await prisma.contact.findFirst({
    where: { id: contactId, brandId },
    select: { id: true },
  });
  if (!contact) throw new Error("That contact was not found for this brand.");
}

async function validateOffersBelongToBrand(offerIds: string[], brandId: string) {
  if (offerIds.length === 0) return;
  const count = await prisma.quote.count({ where: { id: { in: offerIds }, brandId } });
  if (count !== offerIds.length) throw new Error("One or more selected offers was not found for this brand.");
}

async function syncDiscountOffers(discountId: string, brandId: string, offerIds: string[]) {
  await prisma.$transaction([
    prisma.brandDiscountQuote.deleteMany({ where: { discountId, brandId } }),
    prisma.brandDiscountQuote.createMany({ data: offerIds.map((quoteId) => ({ brandId, discountId, quoteId })) }),
  ]);
}

export async function createBrandDiscountAction(formData: FormData) {
  const { brand } = await requireStaffBrandOrThrow();
  const data = parseDiscountInput(formData);
  const { offerIds, ...discountData } = data;
  await validateContactBelongsToBrand(data.contactId, brand.id);
  await validateOffersBelongToBrand(offerIds, brand.id);
  const maxOrder = await prisma.brandDiscount.aggregate({
    where: { brandId: brand.id },
    _max: { sortOrder: true },
  });

  const created = await prisma.brandDiscount.create({
    data: {
      brandId: brand.id,
      sortOrder: (maxOrder._max.sortOrder ?? -1) + 1,
      presentedAt: data.activationMode === "immediate" ? new Date() : null,
      ...discountData,
    },
  });
  await syncDiscountOffers(created.id, brand.id, offerIds);

  revalidatePath("/discounts");
  revalidatePath("/offers/intro");
}

export async function updateBrandDiscountAction(id: string, formData: FormData) {
  const { brand } = await requireStaffBrandOrThrow();
  const data = parseDiscountInput(formData);
  const { offerIds, ...discountData } = data;
  await validateContactBelongsToBrand(data.contactId, brand.id);
  await validateOffersBelongToBrand(offerIds, brand.id);
  const existing = await prisma.brandDiscount.findFirst({
    where: { id, brandId: brand.id },
    select: { activationMode: true, presentedAt: true },
  });
  if (!existing) throw new Error("Discount not found.");

  const turningOn = data.activationMode === "immediate" && existing.activationMode !== "immediate";
  const turningOff = data.activationMode !== "immediate";

  await prisma.brandDiscount.updateMany({
    where: { id, brandId: brand.id },
    data: {
      ...discountData,
      presentedAt: turningOff ? null : turningOn ? new Date() : existing.presentedAt,
    },
  });
  await syncDiscountOffers(id, brand.id, offerIds);

  revalidatePath("/discounts");
  revalidatePath("/offers/intro");
}

export async function archiveBrandDiscountAction(id: string) {
  const { brand } = await requireStaffBrandOrThrow();
  await prisma.brandDiscount.updateMany({
    where: { id, brandId: brand.id },
    data: { active: false },
  });
  revalidatePath("/discounts");
}

export async function restoreBrandDiscountAction(id: string) {
  const { brand } = await requireStaffBrandOrThrow();
  await prisma.brandDiscount.updateMany({
    where: { id, brandId: brand.id },
    data: { active: true },
  });
  revalidatePath("/discounts");
}
