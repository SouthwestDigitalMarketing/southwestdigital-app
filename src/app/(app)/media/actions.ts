"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireStaffBrandOrThrow } from "@/lib/brands/staff";

function clean(value: FormDataEntryValue | null) {
  return typeof value === "string" ? value.trim() : "";
}

export async function createBrandMediaAction(formData: FormData) {
  const { brand } = await requireStaffBrandOrThrow();

  const name = clean(formData.get("name"));
  const type = clean(formData.get("type"));
  const url = clean(formData.get("url"));

  if (!name) throw new Error("Name is required.");
  if (type !== "video" && type !== "image") throw new Error("Type must be video or image.");
  if (!url) throw new Error("URL is required.");

  const maxOrder = await prisma.brandMedia.aggregate({
    where: { brandId: brand.id },
    _max: { sortOrder: true },
  });
  const sortOrder = (maxOrder._max.sortOrder ?? -1) + 1;

  await prisma.brandMedia.create({
    data: { brandId: brand.id, name, type, url, sortOrder },
  });

  revalidatePath("/media");
}

export async function updateBrandMediaAction(id: string, formData: FormData) {
  const { brand } = await requireStaffBrandOrThrow();

  const name = clean(formData.get("name"));
  const url = clean(formData.get("url"));

  if (!name) throw new Error("Name is required.");
  if (!url) throw new Error("URL is required.");

  await prisma.brandMedia.updateMany({
    where: { id, brandId: brand.id },
    data: { name, url },
  });

  revalidatePath("/media");
}

export async function deleteBrandMediaAction(id: string) {
  const { brand } = await requireStaffBrandOrThrow();

  await prisma.brandMedia.deleteMany({
    where: { id, brandId: brand.id },
  });

  revalidatePath("/media");
}
