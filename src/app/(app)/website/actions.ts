"use server";

import { prisma } from "@/lib/prisma";
import { requireStaffBrandOrThrow } from "@/lib/brands/staff";
import { revalidatePath } from "next/cache";

export async function updateWebsiteGoal(brandId: string, value: number) {
  const { brand } = await requireStaffBrandOrThrow();
  if (brand.id !== brandId) throw new Error("Unauthorized");

  await prisma.brandTheme.update({
    where: { brandId },
    data: { websiteEngagedSessionsGoal: value },
  });

  revalidatePath("/website");
}
