"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireStaffBrandOrThrow } from "@/lib/brands/staff";

function clean(value: FormDataEntryValue | null) {
  return typeof value === "string" ? value.trim() : "";
}

function folderIdFromForm(formData: FormData) {
  const value = clean(formData.get("folderId"));
  return value || null;
}

function revalidateMediaPaths() {
  revalidatePath("/media");
  revalidatePath("/offers/intro");
}

export async function createBrandMediaFolderAction(formData: FormData) {
  const { brand } = await requireStaffBrandOrThrow();
  const name = clean(formData.get("name"));
  if (!name) throw new Error("Folder name is required.");

  const maxOrder = await prisma.brandMediaFolder.aggregate({
    where: { brandId: brand.id },
    _max: { sortOrder: true },
  });

  const folder = await prisma.brandMediaFolder.create({
    data: {
      brandId: brand.id,
      name,
      sortOrder: (maxOrder._max.sortOrder ?? -1) + 1,
    },
    select: { id: true, name: true },
  });

  revalidateMediaPaths();
  return folder;
}

export async function renameBrandMediaFolderAction(id: string, formData: FormData) {
  const { brand } = await requireStaffBrandOrThrow();
  const name = clean(formData.get("name"));
  if (!name) throw new Error("Folder name is required.");

  await prisma.brandMediaFolder.updateMany({
    where: { id, brandId: brand.id },
    data: { name },
  });

  revalidateMediaPaths();
}

export async function deleteBrandMediaFolderAction(id: string) {
  const { brand } = await requireStaffBrandOrThrow();
  await prisma.brandMediaFolder.deleteMany({
    where: { id, brandId: brand.id },
  });
  revalidateMediaPaths();
}

export async function createBrandMediaAction(formData: FormData) {
  const { brand } = await requireStaffBrandOrThrow();

  const name = clean(formData.get("name"));
  const type = clean(formData.get("type"));
  const url = clean(formData.get("url"));
  const folderId = folderIdFromForm(formData);

  if (!name) throw new Error("Name is required.");
  if (type !== "video" && type !== "image") throw new Error("Type must be video or image.");
  if (!url) throw new Error("URL is required.");

  if (folderId) {
    const folder = await prisma.brandMediaFolder.findFirst({
      where: { id: folderId, brandId: brand.id },
      select: { id: true },
    });
    if (!folder) throw new Error("Folder not found.");
  }

  const maxOrder = await prisma.brandMedia.aggregate({
    where: { brandId: brand.id },
    _max: { sortOrder: true },
  });
  const sortOrder = (maxOrder._max.sortOrder ?? -1) + 1;

  await prisma.brandMedia.create({
    data: { brandId: brand.id, folderId, name, type, url, sortOrder },
  });

  revalidateMediaPaths();
}

export async function updateBrandMediaAction(id: string, formData: FormData) {
  const { brand } = await requireStaffBrandOrThrow();

  const name = clean(formData.get("name"));
  const url = clean(formData.get("url"));
  const folderId = folderIdFromForm(formData);

  if (!name) throw new Error("Name is required.");
  if (!url) throw new Error("URL is required.");

  if (folderId) {
    const folder = await prisma.brandMediaFolder.findFirst({
      where: { id: folderId, brandId: brand.id },
      select: { id: true },
    });
    if (!folder) throw new Error("Folder not found.");
  }

  await prisma.brandMedia.updateMany({
    where: { id, brandId: brand.id },
    data: { name, url, folderId },
  });

  revalidateMediaPaths();
}

export async function deleteBrandMediaAction(id: string) {
  const { brand } = await requireStaffBrandOrThrow();

  await prisma.brandMedia.deleteMany({
    where: { id, brandId: brand.id },
  });

  revalidateMediaPaths();
}
